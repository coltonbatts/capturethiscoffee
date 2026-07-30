import 'package:ctc_printer/app_runtime.dart';
import 'package:ctc_printer/auth_repository.dart';
import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/ctc_api.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/printer_controller.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/screens/days_screen.dart';
import 'package:ctc_printer/screens/configuration_screen.dart';
import 'package:ctc_printer/screens/home_screen.dart';
import 'package:ctc_printer/screens/sign_in_screen.dart';
import 'package:ctc_printer/session_controller.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:ctc_printer/setup_controller.dart';
import 'package:ctc_printer/setup_repository.dart';
import 'package:ctc_printer/supabase_config.dart';
import 'package:ctc_printer/workspace_controller.dart';
import 'package:ctc_printer/workspace_models.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

const _configuration = SupabaseConfiguration(
  url: 'https://capture-this.supabase.co',
  anonKey: 'public-anon-key-for-tests-123456',
);

const _userA = AuthSession(
  userId: 'user-a',
  email: 'a@example.com',
  isExpired: false,
);

const _userB = AuthSession(
  userId: 'user-b',
  email: 'b@example.com',
  isExpired: false,
);

final _dayA = DaySummary(
  id: 'day-a',
  name: 'Day A',
  clientName: 'Northstar',
  shootDate: DateTime(2026, 7, 25),
  status: 'active',
  total: 1,
  captured: 1,
  skipped: 0,
  printed: 0,
);

final _dayB = DaySummary(
  id: 'day-b',
  name: 'Day B',
  clientName: 'Southstar',
  shootDate: DateTime(2026, 7, 26),
  status: 'active',
  total: 1,
  captured: 1,
  skipped: 0,
  printed: 0,
);

final _boardA = boardFixture(
  productionId: 'day-a',
  name: 'Direct Supabase Day',
  status: 'active',
  roster: [
    boardEntry(
      orderId: 'order-a',
      personName: 'Maya Rodriguez',
      drink: 'Oat flat white',
      group: 'Camera',
    ),
  ],
);

final _boardB = boardFixture(
  productionId: 'day-b',
  name: 'Other Account Day',
  status: 'active',
  roster: [
    boardEntry(
      orderId: 'order-b',
      personName: 'Jonah Bell',
      drink: 'Iced americano',
      group: 'Grip',
    ),
  ],
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('missing Supabase configuration shows sanitized setup state',
      (tester) async {
    await tester.pumpWidget(PrinterApp(
      configuration: const SupabaseConfiguration(url: '', anonKey: ''),
      authRepository: MemoryAuthRepository(),
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      legacyTestMode: false,
    ));
    await tester.pumpAndSettle();

    expect(find.byType(ConfigurationScreen), findsOneWidget);
    expect(find.textContaining('SUPABASE_URL'), findsOneWidget);
    expect(find.text('Legacy link'), findsOneWidget);
  });

  testWidgets('fresh sign-in opens Days and the selected board drives Build 8',
      (tester) async {
    final auth = MemoryAuthRepository(signInSession: _userA);
    addTearDown(auth.dispose);
    final selected = MemorySelectedDayRepository();
    final cache = MemoryAuthenticatedBoardCacheRepository();
    final workspace = MemoryWorkspaceRepository(
      days: [_dayA],
      boards: {'day-a': _boardA},
    );

    await tester.pumpWidget(PrinterApp(
      configuration: _configuration,
      authRepository: auth,
      workspaceRepository: workspace,
      authenticatedBoardCacheRepository: cache,
      selectedDayRepository: selected,
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      legacyTestMode: false,
    ));
    await tester.pumpAndSettle();

    expect(find.byType(SignInScreen), findsOneWidget);
    await tester.enterText(
      find.byKey(const Key('sign-in-email')),
      'a@example.com',
    );
    await tester.enterText(
      find.byKey(const Key('sign-in-password')),
      'correct horse battery staple',
    );
    await tester.tap(find.byKey(const Key('sign-in-submit')));
    await tester.pumpAndSettle();

    expect(find.byType(DaysScreen), findsOneWidget);
    expect(find.text('ACTIVE'), findsOneWidget);
    expect(find.text('1 of 1 decided'), findsOneWidget);
    await tester.tap(find.byKey(const Key('day-day-a')));
    await tester.pumpAndSettle();

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.text('Direct Supabase Day'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byKey(rosterEntryKey),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.byKey(rosterEntryKey), findsOneWidget);
    expect(selected.values['user-a'], 'day-a');
    expect(cache.records.single.userId, 'user-a');
  });

  test('offline authenticated cold start restores the cached selected day',
      () async {
    final cache = MemoryAuthenticatedBoardCacheRepository([
      AuthenticatedCachedBoard(
        userId: 'user-a',
        productionId: 'day-a',
        syncedAt: DateTime.utc(2026, 7, 25, 12),
        board: _boardA,
      ),
    ]);
    final repository = MemoryWorkspaceRepository(
      fetchDaysFailure: const WorkspaceRepositoryException(
        'offline',
        kind: WorkspaceFailureKind.unreachable,
      ),
      fetchBoardFailure: const WorkspaceRepositoryException(
        'offline',
        kind: WorkspaceFailureKind.unreachable,
      ),
    );
    final controller = WorkspaceController(
      repository: repository,
      authenticatedCacheRepository: cache,
      selectedDayRepository: MemorySelectedDayRepository({'user-a': 'day-a'}),
      legacySessionRepository: MemorySessionRepository(),
      legacyCacheRepository: MemoryBoardCacheRepository(),
    );
    addTearDown(controller.dispose);

    await controller.activateUser('user-a');

    expect(controller.selectedDayId, 'day-a');
    expect(controller.board?.production.name, 'Direct Supabase Day');
    expect(controller.queue?.labels.single.personName, 'Maya Rodriguez');
    expect(controller.servingCachedBoard, isTrue);
    expect(controller.syncStatusLabel, startsWith('Offline · synced'));
  });

  test('sign-out hides one account cache before another account activates',
      () async {
    final auth = MemoryAuthRepository(
      restoredSession: _userA,
      signInSession: _userB,
    );
    addTearDown(auth.dispose);
    final cache = MemoryAuthenticatedBoardCacheRepository([
      AuthenticatedCachedBoard(
        userId: 'user-a',
        productionId: 'day-a',
        syncedAt: DateTime.utc(2026, 7, 25),
        board: _boardA,
      ),
      AuthenticatedCachedBoard(
        userId: 'user-b',
        productionId: 'day-b',
        syncedAt: DateTime.utc(2026, 7, 26),
        board: _boardB,
      ),
    ]);
    final workspaceRepository = MemoryWorkspaceRepository(
      days: [_dayA, _dayB],
      boards: {'day-a': _boardA, 'day-b': _boardB},
    );
    final workspace = WorkspaceController(
      repository: workspaceRepository,
      authenticatedCacheRepository: cache,
      selectedDayRepository: MemorySelectedDayRepository({
        'user-a': 'day-a',
        'user-b': 'day-b',
      }),
      legacySessionRepository: MemorySessionRepository(),
      legacyCacheRepository: MemoryBoardCacheRepository(),
    );
    final recoveryRepository = MemoryPrintRecoveryRepository([
      PrintRecoveryRecord(
        apiBase: 'user:user-a',
        productionId: 'day-a',
        orderId: 'order-a',
        personName: 'Maya Rodriguez',
        drink: 'Oat flat white',
        createdAt: DateTime.utc(2026, 7, 25),
        state: PrintRecoveryState.printedNeedsSync,
      ),
    ]);
    final printer = PrinterController(
      workspaceController: workspace,
      printRecoveryRepository: recoveryRepository,
    );
    final runtime = AppRuntime(
      configuration: _configuration,
      session: SessionController(auth),
      workspace: workspace,
      printer: printer,
      setup: SetupController(MemorySetupRepository()),
    );
    addTearDown(runtime.dispose);
    await runtime.start();
    expect(workspace.board?.production.name, 'Direct Supabase Day');
    expect(printer.currentRecoveryRecords, hasLength(1));

    expect(await runtime.signOut(), isTrue);
    expect(workspace.board, isNull);
    expect(printer.queue, isNull);
    expect(printer.currentRecoveryRecords, isEmpty);
    expect(recoveryRepository.records, hasLength(1));

    expect(await runtime.signIn('b@example.com', 'password'), isTrue);
    expect(workspace.userId, 'user-b');
    expect(workspace.board?.production.name, 'Other Account Day');
    expect(
      workspace.board?.production.name,
      isNot('Direct Supabase Day'),
    );
    expect(printer.currentRecoveryRecords, isEmpty);
    expect(recoveryRepository.records, hasLength(1));
  });

  testWidgets('signed-in board loading never constructs the public API',
      (tester) async {
    var publicApiConstructions = 0;
    final auth = MemoryAuthRepository(restoredSession: _userA);
    addTearDown(auth.dispose);
    await tester.pumpWidget(PrinterApp(
      configuration: _configuration,
      authRepository: auth,
      workspaceRepository: MemoryWorkspaceRepository(
        days: [_dayA],
        boards: {'day-a': _boardA},
      ),
      authenticatedBoardCacheRepository:
          MemoryAuthenticatedBoardCacheRepository(),
      selectedDayRepository: MemorySelectedDayRepository({'user-a': 'day-a'}),
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: (session) {
        publicApiConstructions += 1;
        return CtcApi(session);
      },
      legacyTestMode: false,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Direct Supabase Day'), findsOneWidget);
    expect(publicApiConstructions, 0);
  });

  testWidgets('Legacy link remains a working secondary Build 8 flow',
      (tester) async {
    var legacyFetches = 0;
    final auth = MemoryAuthRepository();
    addTearDown(auth.dispose);
    await tester.pumpWidget(PrinterApp(
      configuration: _configuration,
      authRepository: auth,
      workspaceRepository: MemoryWorkspaceRepository(),
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      legacyTestMode: false,
      apiFactory: (session) => _LegacyApi(session, () => legacyFetches += 1),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Legacy link'));
    await tester.pumpAndSettle();
    expect(find.text('Link production'), findsWidgets);
    await tester.enterText(
      find.byType(TextField),
      'https://coffee.capturethis.com/run/legacy-day?token=test-token',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Link production'));
    await tester.pumpAndSettle();

    expect(find.text('Legacy Production'), findsOneWidget);
    expect(legacyFetches, 1);
  });
}

class _LegacyApi extends CtcApi {
  _LegacyApi(super.session, this.onFetch);

  final void Function() onFetch;

  @override
  Future<ProductionBoard> fetchBoard() async {
    onFetch();
    return boardFixture(
      productionId: session.productionId,
      name: 'Legacy Production',
      status: 'active',
      roster: const [],
    );
  }

  @override
  void close() {}
}
