import 'package:ctc_printer/auth_repository.dart';
import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/screens/bulk_roster_screen.dart';
import 'package:ctc_printer/screens/day_editor_screen.dart';
import 'package:ctc_printer/screens/home_screen.dart';
import 'package:ctc_printer/screens/setup_roster_screen.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:ctc_printer/setup_models.dart';
import 'package:ctc_printer/setup_repository.dart';
import 'package:ctc_printer/supabase_config.dart';
import 'package:ctc_printer/workspace_models.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

const _configuration = SupabaseConfiguration(
  url: 'https://fictional.supabase.co',
  anonKey: 'fictional-public-anon-key-for-tests-123456',
);

const _session = AuthSession(
  userId: 'fictional-operator',
  email: 'operator@example.test',
  isExpired: false,
);

final _summary = DaySummary(
  id: 'day-1',
  name: 'Fictional Shoot Day',
  clientName: 'Northstar Fictional',
  shootDate: DateTime(2026, 8, 4),
  status: 'planning',
  total: 1,
  captured: 0,
  skipped: 0,
  printed: 0,
);

final _board = boardFixture(
  name: 'Fictional Shoot Day',
  status: 'planning',
  productionId: 'day-1',
  roster: [
    boardEntry(
      orderId: 'order-1',
      personName: 'Avery Stone',
      drink: '',
      group: 'Camera',
      status: 'not_asked',
    ),
  ],
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('operator creates a planning day and reaches native roster setup',
      (tester) async {
    final setup = MemorySetupRepository();
    await _pumpApp(tester, setup: setup);

    await tester.tap(find.byKey(const Key('create-day')));
    await _pumpFrames(tester);
    expect(find.byType(DayEditorScreen), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('day-name')),
      'Fictional Build 12 Day',
    );
    await tester.enterText(
      find.byKey(const Key('day-client')),
      'Northstar Fictional',
    );
    await tester.tap(find.byKey(const Key('save-day')));
    await _pumpFrames(tester);

    expect(find.byType(SetupRosterScreen), findsOneWidget);
    expect(find.text('Fictional Build 12 Day'), findsOneWidget);
    expect(setup.days.values.single.status, 'planning');
  });

  testWidgets('online-only create failure remains on screen with retry state',
      (tester) async {
    final setup = MemorySetupRepository();
    await _pumpApp(tester, setup: setup);
    await tester.tap(find.byKey(const Key('create-day')));
    await _pumpFrames(tester);
    await tester.enterText(
      find.byKey(const Key('day-name')),
      'Will Not Save',
    );
    setup.failNextMutation = const SetupRepositoryException(
      'Setup needs a connection. Check Wi-Fi or signal, then retry.',
      kind: SetupFailureKind.onlineRequired,
    );

    await tester.tap(find.byKey(const Key('save-day')));
    await _pumpFrames(tester);

    expect(find.byType(DayEditorScreen), findsOneWidget);
    expect(find.byKey(const Key('setup-failure')), findsOneWidget);
    expect(find.text('Online setup required'), findsOneWidget);
    expect(find.byKey(const Key('setup-retry')), findsOneWidget);
    expect(setup.days, isEmpty);
  });

  testWidgets('bulk paste is reviewed before its atomic commit',
      (tester) async {
    final setup = MemorySetupRepository(
      days: [_setupDay],
      people: [_person],
      rosters: {
        _setupDay.id: [_member],
      },
    );
    await _pumpApp(
      tester,
      setup: setup,
      days: [_summary],
      boards: {'day-1': _board},
    );

    await tester.tap(find.byKey(const Key('setup-day-day-1')));
    await _pumpFrames(tester);
    expect(find.text('1 person · drag to set service order'), findsOneWidget);
    await tester.tap(find.byKey(const Key('bulk-roster')));
    await _pumpFrames(tester);
    expect(find.byType(BulkRosterScreen), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('bulk-paste')),
      '  New   Person  , New Person\nAnother Person',
    );
    expect(find.text('New Person'), findsNothing);
    await tester.tap(find.byKey(const Key('preview-bulk')));
    await _pumpFrames(tester);

    await tester.scrollUntilVisible(
      find.text('New Person'),
      180,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('New Person'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Duplicate in paste'),
      180,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Duplicate in paste'), findsOneWidget);
    expect(find.text('Add 2 atomically'), findsOneWidget);
    expect(setup.rosters['day-1'], hasLength(1));

    await tester.tap(find.byKey(const Key('commit-bulk')));
    await _pumpFrames(tester);
    expect(find.byType(SetupRosterScreen), findsOneWidget);
    expect(setup.rosters['day-1'], hasLength(3));
    expect(
      setup.rosters['day-1']!.map((member) => member.orderId).toSet(),
      hasLength(3),
    );
  });

  testWidgets('prepared day selection returns to existing Collect and Print',
      (tester) async {
    final setup = MemorySetupRepository(
      days: [_setupDay],
      people: [_person],
      rosters: {
        _setupDay.id: [_member],
      },
    );
    await _pumpApp(
      tester,
      setup: setup,
      days: [_summary],
      boards: {'day-1': _board},
    );
    await tester.tap(find.byKey(const Key('setup-day-day-1')));
    await _pumpFrames(tester);

    await tester.tap(find.byKey(const Key('continue-to-operations')));
    await _pumpFrames(tester);

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byKey(collectEntryKey), findsOneWidget);
    expect(find.byKey(printEntryKey), findsOneWidget);
    expect(find.text('Fictional Shoot Day'), findsWidgets);
  });
}

Future<void> _pumpApp(
  WidgetTester tester, {
  required MemorySetupRepository setup,
  List<DaySummary> days = const [],
  Map<String, ProductionBoard> boards = const {},
}) async {
  final auth = MemoryAuthRepository(restoredSession: _session);
  addTearDown(auth.dispose);
  await tester.pumpWidget(PrinterApp(
    configuration: _configuration,
    authRepository: auth,
    workspaceRepository: MemoryWorkspaceRepository(
      days: days,
      boards: boards,
    ),
    setupRepository: setup,
    authenticatedBoardCacheRepository:
        MemoryAuthenticatedBoardCacheRepository(),
    selectedDayRepository: MemorySelectedDayRepository(),
    sessionRepository: MemorySessionRepository(),
    boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
    legacyTestMode: false,
  ));
  await _pumpFrames(tester);
}

Future<void> _pumpFrames(WidgetTester tester) async {
  for (var index = 0; index < 8; index += 1) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

const _setupDay = SetupDay(
  id: 'day-1',
  name: 'Fictional Shoot Day',
  clientId: 'client-1',
  clientName: 'Northstar Fictional',
  shootDate: null,
  location: 'Stage 12',
  runnerName: 'Taylor Fiction',
  notes: '',
  status: 'planning',
);

const _person = SetupPerson(
  id: 'person-1',
  name: 'Avery Stone',
  type: SetupPersonType.crew,
  role: 'Camera operator',
  department: 'Camera',
  company: 'Fictional Unit',
  photoUrl: '',
  usualOrder: 'Oat cortado',
  dietaryNotes: '',
  notes: '',
  active: true,
);

const _member = SetupRosterMember(
  rosterId: 'roster-1',
  productionId: 'day-1',
  person: _person,
  orderId: 'order-1',
  groupLabel: 'Camera',
  onSetToday: true,
  sortOrder: 1,
);
