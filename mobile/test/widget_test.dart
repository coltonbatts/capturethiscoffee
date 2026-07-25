import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/ctc_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/session_store.dart';

import 'support/board_fixture.dart';

const _planningSession = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'planning-production',
  token: 'fixture-token',
);

class _PlanningApi extends CtcApi {
  _PlanningApi(super.session);

  @override
  Future<ProductionBoard> fetchBoard() async => boardFixture(
        name: 'Tomorrow’s Shoot',
        status: 'planning',
        roster: [
          boardEntry(
            orderId: 'order-1',
            personName: 'Jamie Example',
            drink: 'Iced oat latte',
            group: 'Crew',
          ),
        ],
      );

  @override
  void close() {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Printer app renders link screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
    ));
    await tester.pump();
    expect(find.text('Link production'), findsOneWidget);
  });

  testWidgets('in-app quick start is available before linking',
      (WidgetTester tester) async {
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
    ));
    await tester.pump();
    await tester.tap(find.byTooltip('How to use Capture This'));
    await tester.pumpAndSettle();
    expect(find.text('How to use Capture This'), findsOneWidget);
    expect(find.text('Link an active production'), findsOneWidget);
  });

  testWidgets('planning productions visibly pause physical printing',
      (WidgetTester tester) async {
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_planningSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _PlanningApi.new,
    ));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Printing paused'),
      300,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Printing paused'), findsOneWidget);
    expect(find.text('Production planning'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.widgetWithText(FilledButton, 'Print'),
      300,
      scrollable: find.byType(Scrollable).last,
    );
    final printButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Print'),
    );
    expect(printButton.onPressed, isNull);
  });

  test('parseProductionShareUrl accepts the canonical runner link', () {
    final session = parseProductionShareUrl(
      'https://capturethis.coffee/run/prod-1?token=abc123',
    );
    expect(session?.productionId, 'prod-1');
    expect(session?.token, 'abc123');
    expect(session?.apiBase, 'https://capturethis.coffee');
  });

  test('parseProductionShareUrl retains legacy link compatibility', () {
    final session = parseProductionShareUrl(
      'https://capturethis.coffee/productions/prod-1?token=abc123',
    );
    expect(session?.productionId, 'prod-1');
    expect(session?.token, 'abc123');
    expect(session?.apiBase, 'https://capturethis.coffee');
  });

  test('parseProductionShareUrl rejects unrelated nested production APIs', () {
    final session = parseProductionShareUrl(
      'https://capturethis.coffee/api/public/productions/prod-1/labels?token=abc123',
    );
    expect(session, isNull);
  });

  test('parseProductionShareUrl rejects insecure public and credentialed URLs',
      () {
    expect(
      parseProductionShareUrl(
        'http://coffee.capturethis.com/run/prod-1?token=abc123',
      ),
      isNull,
    );
    expect(
      parseProductionShareUrl(
        'https://user:pass@coffee.capturethis.com/run/prod-1?token=abc123',
      ),
      isNull,
    );
  });

  test('parseProductionShareUrl permits local HTTP development', () {
    final session = parseProductionShareUrl(
      'http://192.168.1.69:3000/run/prod-1?token=abc123',
    );
    expect(session?.apiBase, 'http://192.168.1.69:3000');
  });

  test('decodeSession rejects malformed and insecure saved sessions', () {
    expect(decodeSession('{"apiBase":42}'), isNull);
    expect(
      decodeSession(
        '{"apiBase":"http://example.com","productionId":"p","token":"t"}',
      ),
      isNull,
    );
  });
}
