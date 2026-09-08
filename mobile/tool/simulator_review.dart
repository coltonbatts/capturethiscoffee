import 'package:ctc_printer/setup_models.dart';
import 'package:ctc_printer/setup_repository.dart';
import 'package:ctc_printer/screens/setup_roster_screen.dart';
import 'dart:io';

import 'package:ctc_printer/auth_repository.dart';
import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:ctc_printer/supabase_config.dart';
import 'package:ctc_printer/workspace_models.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../test/support/board_fixture.dart';
import 'package:ctc_printer/screens/day_editor_screen.dart';

const _configuration = SupabaseConfiguration(
  url: 'https://fictional-review.supabase.co',
  anonKey: 'fictional-public-review-key-not-used-for-network-access',
);

const _user = AuthSession(
  userId: 'apple-review-user',
  email: 'reviewer@example.invalid',
  isExpired: false,
);

const _productionId = 'apple-review-coffee-run';
const _scopeKey = 'user:apple-review-user';
final _days = [
  DaySummary(
    id: _productionId,
    name: 'Apple Review Coffee Run — Fictional',
    clientName: 'Northstar Studio',
    shootDate: DateTime(2026, 8, 3),
    status: 'active',
    total: 6,
    captured: 4,
    skipped: 1,
    printed: 1,
  ),
  DaySummary(
    id: 'planning-day',
    name: 'Harbor Lookbook — Fictional',
    clientName: 'Harbor Goods',
    shootDate: DateTime(2026, 8, 8),
    status: 'planning',
    total: 12,
    captured: 0,
    skipped: 0,
    printed: 0,
  ),
  DaySummary(
    id: 'complete-day',
    name: 'Juniper Campaign — Fictional',
    clientName: 'Juniper House',
    shootDate: DateTime(2026, 7, 22),
    status: 'complete',
    total: 9,
    captured: 8,
    skipped: 1,
    printed: 8,
  ),
];

final _board = boardFixture(
  name: 'Apple Review Coffee Run — Fictional',
  status: 'active',
  clientName: 'Northstar Studio',
  productionId: _productionId,
  roster: [
    boardEntry(
      orderId: 'order-alex',
      personName: 'Alex North',
      drink: 'Black coffee',
      group: 'Crew',
      labelPrinted: true,
      sortOrder: 1,
    ),
    boardEntry(
      orderId: 'order-cameron',
      personName: 'Cameron Ellington-Smythe',
      drink: 'Iced americano',
      group: 'Camera',
      sortOrder: 2,
    ),
    boardEntry(
      orderId: 'order-taylor',
      personName: 'Taylor Quinn',
      drink: 'Half-caf oat milk vanilla latte, extra hot',
      group: 'Production',
      sortOrder: 3,
    ),
    boardEntry(
      orderId: 'order-morgan',
      personName: 'Morgan Lee',
      drink: 'Iced decaf caramel latte with oat milk, light ice',
      group: 'Agency',
      sortOrder: 4,
    ),
    boardEntry(
      orderId: 'order-riley',
      personName: 'Riley Park',
      drink: '',
      group: 'Art',
      status: 'not_asked',
      sortOrder: 5,
    ),
    boardEntry(
      orderId: 'order-jordan',
      personName: 'Jordan Vale',
      drink: '',
      group: 'Wardrobe',
      status: 'no_order',
      sortOrder: 6,
    ),
  ],
);

final _conflictedOrder = _board.orderById('order-cameron')!;

OrderMutationRecord _conflictRecord() => OrderMutationRecord(
      scopeKey: _scopeKey,
      productionId: _productionId,
      orderId: _conflictedOrder.id,
      personId: 'person-order-cameron',
      personName: 'Cameron Ellington-Smythe',
      drink: 'Oat cappuccino',
      createdAt: DateTime.utc(2026, 7, 27, 18),
      observedUpdatedAt: _conflictedOrder.updatedAt,
      baseValues: OrderPatch.snapshot(_conflictedOrder),
      patch: OrderPatch({OrderField.drinkType: 'Oat cappuccino'}),
      updateUsualOrder: false,
      observedUsualOrder: '',
      desiredUsualOrder: '',
      orderApplied: false,
      conflict: OrderMutationConflict(
        kind: OrderMutationConflictKind.order,
        message:
            'This order changed on another device. Choose which version to keep.',
        serverOrder: _conflictedOrder.copyWith(
          drinkType: 'Iced americano, light ice',
          updatedAt: '2026-07-27T18:01:00.000Z',
        ),
      ),
      printState: null,
    );

OrderMutationRecord _uncertainPrintRecord() => OrderMutationRecord(
      scopeKey: _scopeKey,
      productionId: _productionId,
      orderId: 'order-cameron',
      personId: 'person-order-cameron',
      personName: 'Cameron Ellington-Smythe',
      drink: 'Iced americano',
      createdAt: DateTime.utc(2026, 7, 27, 18, 2),
      observedUpdatedAt: _conflictedOrder.updatedAt,
      baseValues: const {},
      patch: null,
      updateUsualOrder: false,
      observedUsualOrder: '',
      desiredUsualOrder: '',
      orderApplied: false,
      conflict: null,
      printState: PrintRecoveryState.uncertain,
    );

MemorySetupRepository _setup() {
  final people = [
    for (final entry in _board.roster)
      SetupPerson(
          id: entry.person.id,
          name: entry.person.name,
          type: SetupPersonType.crew,
          role: entry.person.role,
          department: entry.group,
          company: 'Fictional Studio',
          photoUrl: '',
          usualOrder: entry.person.usualOrder,
          dietaryNotes: '',
          notes: '',
          active: true)
  ];
  return MemorySetupRepository(people: people, days: [
    const SetupDay(
        id: _productionId,
        name: 'Apple Review Coffee Run — Fictional',
        clientId: 'fictional-client',
        clientName: 'Northstar Studio',
        shootDate: null,
        location: 'Stage 2',
        runnerName: 'Taylor Fiction',
        notes: '',
        status: 'active')
  ], rosters: {
    _productionId: [
      for (var i = 0; i < people.length; i++)
        SetupRosterMember(
            rosterId: _board.roster[i].rosterId,
            productionId: _productionId,
            person: people[i],
            orderId: _board.roster[i].order!.id,
            groupLabel: _board.roster[i].group,
            onSetToday: true,
            sortOrder: i)
    ]
  });
}

PrinterApp _signInApp() => PrinterApp(
      key: UniqueKey(),
      configuration: _configuration,
      authRepository: MemoryAuthRepository(signInSession: _user),
      workspaceRepository: MemoryWorkspaceRepository(
          days: _days, boards: {_productionId: _board}),
      setupRepository: _setup(),
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      legacyTestMode: false,
    );

PrinterApp _authenticatedApp({
  bool selected = true,
  bool offline = false,
  bool withPeople = true,
  List<OrderMutationRecord> mutations = const [],
  ProductionBoard? board,
}) {
  final selectedBoard = board ?? _board;
  final repository = MemoryWorkspaceRepository(
    days: _days,
    boards: {_productionId: selectedBoard},
    fetchDaysFailure: offline
        ? const WorkspaceRepositoryException(
            'Could not reach the workspace.',
            kind: WorkspaceFailureKind.unreachable,
          )
        : null,
    fetchBoardFailure: offline
        ? const WorkspaceRepositoryException(
            'Could not reach the workspace.',
            kind: WorkspaceFailureKind.unreachable,
          )
        : null,
  );
  final cache = MemoryAuthenticatedBoardCacheRepository(
    selected
        ? [
            AuthenticatedCachedBoard(
              userId: _user.userId,
              productionId: _productionId,
              syncedAt: DateTime.now().subtract(const Duration(minutes: 42)),
              board: selectedBoard,
            ),
          ]
        : const [],
  );
  return PrinterApp(
    key: UniqueKey(),
    configuration: _configuration,
    authRepository: MemoryAuthRepository(restoredSession: _user),
    workspaceRepository: repository,
    setupRepository: withPeople ? _setup() : MemorySetupRepository(),
    authenticatedBoardCacheRepository: cache,
    selectedDayRepository: MemorySelectedDayRepository(
      selected ? {_user.userId: _productionId} : const {},
    ),
    orderMutationOutboxRepository:
        MemoryOrderMutationOutboxRepository(mutations),
    sessionRepository: MemorySessionRepository(),
    boardCacheRepository: MemoryBoardCacheRepository(),
    legacyTestMode: false,
  );
}

// Explicit local simulator entrypoint; never imported by lib/main.dart.
// Memory repositories only. No real authentication, network data, or print.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!kDebugMode) throw StateError('Simulator review is debug-only');
  runApp(_signInApp());
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 8877);
  await for (final request in server) {
    final scenario = request.uri.path.substring(1);
    runApp(scenario == 'sign-in'
        ? _signInApp()
        : _authenticatedApp(
            selected: scenario != 'days',
            withPeople: scenario != 'people-empty',
            offline: scenario == 'print' ||
                scenario == 'recovery' ||
                scenario == 'conflict',
            mutations: scenario == 'recovery'
                ? [_uncertainPrintRecord()]
                : scenario == 'conflict'
                    ? [_conflictRecord()]
                    : [],
          ));
    await Future<void>.delayed(const Duration(milliseconds: 800));
    NavigatorState? navigator;
    void visit(Element element) {
      if (element is StatefulElement && element.state is NavigatorState) {
        navigator ??= element.state as NavigatorState;
      }
      element.visitChildren(visit);
    }

    WidgetsBinding.instance.rootElement!.visitChildren(visit);
    if (scenario == 'roster-setup') {
      navigator?.push(MaterialPageRoute<void>(
          builder: (_) =>
              const SetupRosterScreen(productionId: _productionId)));
    } else if (scenario == 'setup') {
      navigator?.push(
          MaterialPageRoute<void>(builder: (_) => const DayEditorScreen()));
    } else if ([
      'collect',
      'print',
      'recovery',
      'summary',
      'people',
      'people-empty',
      'conflict'
    ].contains(scenario)) {
      navigator?.pushNamed(scenario == 'conflict'
          ? '/collect'
          : scenario == 'people-empty'
              ? '/people'
              : '/$scenario');
    }
    request.response.write('Fictional simulator scenario: $scenario');
    await request.response.close();
  }
}
