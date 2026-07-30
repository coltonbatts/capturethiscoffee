import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/ctc_api.dart';
import 'package:ctc_printer/label_painter.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/printer_controller.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/screens/home_screen.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

import 'support/board_fixture.dart';

const _session = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'test-label-day',
  token: 'fictional-test-token',
);

final _board = boardFixture(
  productionId: 'test-label-day',
  name: 'Fictional Test Day',
  status: 'active',
  roster: [
    boardEntry(
      orderId: 'order-1',
      personName: 'Jamie Example',
      drink: 'Iced oat latte',
      group: 'Camera',
    ),
  ],
);

class _TestLabelApi extends CtcApi {
  _TestLabelApi(super.session);

  @override
  Future<ProductionBoard> fetchBoard() async => _board;

  @override
  void close() {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('fictional test rendering cannot alter order or printed facts',
      () async {
    final controller = PrinterController(
      sessionRepository: MemorySessionRepository(_session),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      apiFactory: _TestLabelApi.new,
    );
    addTearDown(controller.dispose);
    await controller.start();
    final before = controller.queue!.labels
        .map((label) => (label.orderId, label.labelPrinted))
        .toList();

    final bytes = await controller.renderFictionalTestLabel();
    final decoded = img.decodeImage(bytes);

    expect(decoded, isNotNull);
    expect(decoded!.width, labelPixelWidth);
    expect(decoded.height, labelPixelHeight);
    expect(
      controller.queue!.labels
          .map((label) => (label.orderId, label.labelPrinted))
          .toList(),
      before,
    );
    expect(controller.currentRecoveryRecords, isEmpty);
  });

  testWidgets('home exposes template identity, status, and safe test action',
      (tester) async {
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_session),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _TestLabelApi.new,
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(templateEntryKey), findsOneWidget);
    expect(find.text('Grid 01 · v1'), findsOneWidget);
    expect(find.text('Bundled Grid 01 fallback'), findsOneWidget);
    expect(
      find.text(
        'Uses this exact template and changes no order or printed facts.',
      ),
      findsOneWidget,
    );
    final action = tester.widget<OutlinedButton>(
      find.byKey(testLabelActionKey),
    );
    expect(action.onPressed, isNull);
    expect(
      find.text('Connect printer to print a test label'),
      findsOneWidget,
    );
  });
}
