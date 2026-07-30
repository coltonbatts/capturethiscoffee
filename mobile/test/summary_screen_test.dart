import 'package:ctc_printer/auth_repository.dart';
import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/screens/summary_screen.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:ctc_printer/supabase_config.dart';
import 'package:ctc_printer/workspace_models.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

const _configuration = SupabaseConfiguration(
  url: 'https://capture-this.supabase.co',
  anonKey: 'public-anon-key-for-tests-123456',
);

final _readyBoard = boardFixture(
  productionId: 'summary-day',
  name: 'Fictional Summary Day',
  status: 'active',
  roster: [
    boardEntry(
      orderId: 'printed',
      personName: 'Avery Stone',
      drink: 'Iced oat latte',
      group: 'Camera',
      labelPrinted: true,
    ),
  ],
);

final _day = DaySummary(
  id: 'summary-day',
  name: 'Fictional Summary Day',
  clientName: 'Northstar',
  shootDate: DateTime(2026, 7, 30),
  status: 'active',
  total: 1,
  captured: 1,
  skipped: 0,
  printed: 1,
);

PrinterApp _app(MemoryWorkspaceRepository repository) => PrinterApp(
      configuration: _configuration,
      authRepository: MemoryAuthRepository(
        restoredSession: const AuthSession(
          userId: 'fictional-reviewer',
          email: 'review.operator@example.com',
          isExpired: false,
        ),
      ),
      workspaceRepository: repository,
      authenticatedBoardCacheRepository:
          MemoryAuthenticatedBoardCacheRepository(),
      selectedDayRepository:
          MemorySelectedDayRepository({'fictional-reviewer': 'summary-day'}),
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      legacyTestMode: false,
    );

Future<void> _openAndConfirm(WidgetTester tester) async {
  final navigator = tester.state<NavigatorState>(find.byType(Navigator).first);
  navigator.pushNamed(SummaryScreen.route);
  await tester.pumpAndSettle();
  expect(find.byType(SummaryScreen), findsOneWidget);
  await tester.ensureVisible(find.byKey(summaryCloseoutButtonKey));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(summaryCloseoutButtonKey));
  await tester.pumpAndSettle();
  expect(find.text('Complete this day?'), findsOneWidget);
  await tester.tap(
    find.descendant(
      of: find.byType(AlertDialog),
      matching: find.text('Complete day'),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('server rejection never renders optimistic completion',
      (tester) async {
    final repository = MemoryWorkspaceRepository(
      days: [_day],
      boards: {'summary-day': _readyBoard},
      completeDayFailure: const WorkspaceRepositoryException(
        'The server rejected this closeout.',
        kind: WorkspaceFailureKind.unauthorized,
      ),
    );

    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();
    await _openAndConfirm(tester);

    expect(repository.completeDayCalls, 1);
    expect(repository.boards['summary-day']!.production.status, 'active');
    expect(find.text('Day complete'), findsNothing);
    expect(find.text('The server rejected this closeout.'), findsOneWidget);
    expect(find.byKey(summaryCloseoutButtonKey), findsOneWidget);
  });

  testWidgets('confirmed server closeout refreshes to permanent Complete state',
      (tester) async {
    final repository = MemoryWorkspaceRepository(
      days: [_day],
      boards: {'summary-day': _readyBoard},
    );

    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();
    await _openAndConfirm(tester);

    expect(repository.completeDayCalls, 1);
    expect(repository.boards['summary-day']!.production.status, 'complete');
    expect(find.text('Day complete'), findsOneWidget);
    expect(find.byKey(summaryCloseoutButtonKey), findsNothing);
  });
}
