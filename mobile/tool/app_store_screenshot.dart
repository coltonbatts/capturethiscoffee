// Non-shipping App Store screenshot harness.
//
// Run with one of:
//   --dart-define=APP_STORE_SCREEN=link
//   --dart-define=APP_STORE_SCREEN=queue
//   --dart-define=APP_STORE_SCREEN=recovery
//
// The production entry point remains lib/main.dart and exposes no fixture mode.

import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/ctc_api.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:flutter/widgets.dart';

// Dev harness only; both files live outside lib/.
import '../test/support/board_fixture.dart';

const _screen = String.fromEnvironment(
  'APP_STORE_SCREEN',
  defaultValue: 'link',
);

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

List<PrintRecoveryRecord> _recoveries() {
  if (_screen != 'recovery') return const [];
  return [
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
  ];
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  if (_screen == 'link') {
    runApp(PrinterApp(
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
    ));
    return;
  }

  runApp(PrinterApp(
    sessionRepository: MemorySessionRepository(_session),
    boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(_recoveries()),
    apiFactory: _ScreenshotApi.new,
  ));
}
