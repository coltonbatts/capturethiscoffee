import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/ctc_api.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

const _session = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'fictional-apple-review',
  token: 'screenshot-fixture-not-a-live-token',
);

final _board = boardFixture(
  name: 'Apple Review Coffee Run',
  status: 'active',
  productionId: 'fictional-apple-review',
  roster: [
    boardEntry(
      orderId: 'order-alex',
      personName: 'Alex North',
      drink: 'Black coffee',
      group: 'Crew',
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
  ],
);

class _ScreenshotApi extends CtcApi {
  _ScreenshotApi(super.session);

  @override
  Future<ProductionBoard> fetchBoard() async => _board;

  @override
  void close() {}
}

Future<void> _renderAppStoreScreenshot(
  WidgetTester tester, {
  required Widget app,
  required String golden,
}) async {
  tester.view.devicePixelRatio = 3;
  tester.view.physicalSize = const Size(1320, 2868);
  addTearDown(tester.view.reset);

  const boundaryKey = Key('app-store-screenshot-boundary');
  await tester.pumpWidget(
    RepaintBoundary(key: boundaryKey, child: app),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));

  await expectLater(
    find.byKey(boundaryKey),
    matchesGoldenFile('goldens/app-store/$golden'),
  );
}

PrinterApp _fixtureApp({List<PrintRecoveryRecord> recoveries = const []}) {
  return PrinterApp(
    sessionRepository: MemorySessionRepository(_session),
    boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(recoveries),
    apiFactory: _ScreenshotApi.new,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('App Store screenshot — link production', (tester) async {
    await _renderAppStoreScreenshot(
      tester,
      app: PrinterApp(
        sessionRepository: MemorySessionRepository(),
        boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
      ),
      golden: '01-link-production.png',
    );
  });

  testWidgets('App Store screenshot — fictional pending queue', (tester) async {
    await _renderAppStoreScreenshot(
      tester,
      app: _fixtureApp(),
      golden: '02-pending-queue.png',
    );
  });

  testWidgets('App Store screenshot — print sync recovery', (tester) async {
    await _renderAppStoreScreenshot(
      tester,
      app: _fixtureApp(recoveries: [
        PrintRecoveryRecord(
          apiBase: _session.apiBase,
          productionId: _session.productionId,
          orderId: 'order-alex',
          personName: 'Alex North',
          drink: 'Black coffee',
          createdAt: DateTime.utc(2026, 7, 15, 18),
          state: PrintRecoveryState.printedNeedsSync,
        ),
        PrintRecoveryRecord(
          apiBase: _session.apiBase,
          productionId: _session.productionId,
          orderId: 'order-cameron',
          personName: 'Cameron Ellington-Smythe',
          drink: 'Iced americano',
          createdAt: DateTime.utc(2026, 7, 15, 18, 1),
          state: PrintRecoveryState.uncertain,
        ),
      ]),
      golden: '03-print-sync-recovery.png',
    );
  });

  testWidgets('App Store screenshot — in-app operating guide', (tester) async {
    tester.view.devicePixelRatio = 3;
    tester.view.physicalSize = const Size(1320, 2868);
    addTearDown(tester.view.reset);

    const boundaryKey = Key('app-store-screenshot-boundary');
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundaryKey,
        child: PrinterApp(
          sessionRepository: MemorySessionRepository(),
          boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.byTooltip('How to use Capture This'));
    await tester.pumpAndSettle();

    await expectLater(
      find.byKey(boundaryKey),
      matchesGoldenFile('goldens/app-store/04-in-app-guide.png'),
    );
  });
}
