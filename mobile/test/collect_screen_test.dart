import 'package:ctc_printer/app_scope.dart';
import 'package:ctc_printer/auth_repository.dart';
import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/screens/collect_screen.dart';
import 'package:ctc_printer/screens/home_screen.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:ctc_printer/supabase_config.dart';
import 'package:ctc_printer/workspace_models.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _configuration = SupabaseConfiguration(
  url: 'https://capture-this.supabase.co',
  anonKey: 'public-anon-key-for-tests-123456',
);

BoardRosterEntry _entry({
  required String id,
  required String name,
  required String status,
  required String drink,
  String usual = '',
}) =>
    BoardRosterEntry(
      rosterId: 'roster-$id',
      groupLabel: 'Camera',
      onSetToday: true,
      sortOrder: int.parse(id),
      person: BoardPerson(
        id: 'person-$id',
        name: name,
        role: 'Crew',
        department: 'Camera',
        company: '',
        photoUrl: '',
        usualOrder: usual,
      ),
      order: BoardOrder(
        id: 'order-$id',
        drinkType: drink,
        size: '',
        temperature: '',
        milkType: '',
        sweetener: '',
        caffeine: 'Regular',
        specialNotes: '',
        vendor: '',
        status: status,
        labelPrinted: false,
        updatedAt: '2026-07-25T12:00:0$id.000Z',
      ),
    );

final _board = ProductionBoard(
  production: const BoardProduction(
    id: 'day-a',
    name: 'Collect Day',
    shootDate: '2026-07-25',
    location: 'Stage',
    runnerName: 'Alex',
    status: 'active',
    clientName: 'Northstar',
  ),
  roster: [
    _entry(
      id: '1',
      name: 'Maya Needs',
      status: 'not_asked',
      drink: '',
      usual: 'Large, Iced latte, Oat milk',
    ),
    _entry(
      id: '2',
      name: 'Jon Captured',
      status: 'confirmed',
      drink: 'Americano',
    ),
    _entry(
      id: '3',
      name: 'Ari No Drink',
      status: 'no_order',
      drink: '',
    ),
    const BoardRosterEntry(
      rosterId: 'roster-missing',
      groupLabel: 'Set',
      onSetToday: true,
      sortOrder: 4,
      person: BoardPerson(
        id: 'person-missing',
        name: 'Setup Needed',
        role: '',
        department: '',
        company: '',
        photoUrl: '',
        usualOrder: '',
      ),
      order: null,
    ),
  ],
);

void main() {
  testWidgets(
      'Collect shows every state and optimistic changes feed the print queue',
      (tester) async {
    final repository = MemoryWorkspaceRepository(
      days: [
        DaySummary(
          id: 'day-a',
          name: 'Collect Day',
          clientName: 'Northstar',
          shootDate: DateTime(2026, 7, 25),
          status: 'active',
          total: 4,
          captured: 1,
          skipped: 1,
          printed: 0,
        ),
      ],
      boards: {'day-a': _board},
    );
    final durable = MemoryOrderMutationOutboxRepository();

    await tester.pumpWidget(PrinterApp(
      configuration: _configuration,
      authRepository: MemoryAuthRepository(
        restoredSession: const AuthSession(
          userId: 'user-a',
          email: 'a@example.com',
          isExpired: false,
        ),
      ),
      workspaceRepository: repository,
      authenticatedBoardCacheRepository:
          MemoryAuthenticatedBoardCacheRepository(),
      selectedDayRepository: MemorySelectedDayRepository({'user-a': 'day-a'}),
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      orderMutationOutboxRepository: durable,
      legacyTestMode: false,
    ));
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byKey(collectEntryKey), findsOneWidget);
    await tester.tap(find.byKey(collectEntryKey));
    await tester.pumpAndSettle();

    expect(find.byType(CollectScreen), findsOneWidget);
    expect(find.text('Needs order'), findsWidgets);
    expect(find.text('Captured'), findsWidgets);
    expect(find.text('No drink'), findsWidgets);
    expect(find.textContaining('Usual: Large, Iced latte'), findsOneWidget);
    final collectScroll = find
        .descendant(
          of: find.byType(CollectScreen),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.byKey(const Key('collect-roster-missing')),
      250,
      scrollable: collectScroll,
    );
    expect(find.text('Setup needed'), findsOneWidget);

    repository
      ..fetchBoardFailure = const WorkspaceRepositoryException(
        'offline',
        kind: WorkspaceFailureKind.unreachable,
      )
      ..updateOrderFailure = const WorkspaceRepositoryException(
        'offline',
        kind: WorkspaceFailureKind.unreachable,
      );
    await tester.scrollUntilVisible(
      find.byKey(const Key('accept-usual-order-1')),
      -250,
      scrollable: collectScroll,
    );
    await tester.tap(find.byKey(const Key('accept-usual-order-1')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(find.text('Pending sync'), findsWidgets);
    final runtime = PrinterScope.runtimeOf(
      tester.element(find.byType(CollectScreen)),
    );
    expect(
      runtime.board.board!.orderById('order-1')!.status,
      'confirmed',
    );
    expect(
      runtime.printer.queue!.labels.map((label) => label.orderId),
      contains('order-1'),
    );
    expect(durable.records, hasLength(1));

    await tester.scrollUntilVisible(
      find.byKey(const Key('edit-order-order-2')),
      200,
      scrollable: collectScroll,
    );
    await tester.tap(find.byKey(const Key('edit-order-order-2')));
    await tester.pumpAndSettle();
    expect(find.text('Save as usual order'), findsOneWidget);
    await tester.enterText(
      find.byKey(const Key('order-drink')),
      'Cold brew',
    );
    await tester.tap(find.byKey(const Key('order-update-usual')));
    await tester.ensureVisible(find.byKey(const Key('order-save')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('order-save')));
    await tester.pumpAndSettle();

    expect(runtime.board.board!.orderById('order-2')!.drinkType, 'Cold brew');
    expect(durable.records, hasLength(2));
    expect(
      durable.records
          .singleWhere((record) => record.orderId == 'order-2')
          .updateUsualOrder,
      isTrue,
    );

    final competing = _board.orderById('order-1')!.copyWith(
          drinkType: 'Web espresso',
          status: 'confirmed',
          updatedAt: '2026-07-25T23:00:00.000Z',
        );
    repository.boards['day-a'] = _board.replaceOrder(competing);
    repository
      ..fetchBoardFailure = null
      ..updateOrderFailure = null;
    await runtime.board.refresh();
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byKey(const Key('collect-roster-1')),
      -250,
      scrollable: collectScroll,
    );

    expect(find.text('Review conflict'), findsOneWidget);
    expect(runtime.board.conflictCount, 1);
    expect(
      repository.boards['day-a']!.orderById('order-1')!.drinkType,
      'Web espresso',
    );
    expect(
      repository.boards['day-a']!.entryByOrderId('order-2')!.person.usualOrder,
      contains('Cold brew'),
    );
  });
}
