import 'dart:async';
import 'dart:convert';

import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/ctc_api.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/printer_controller.dart';
import 'package:ctc_printer/printer_transport.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:niim_blue_flutter/niim_blue_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/board_fixture.dart';

const session = ProductionSession(
    apiBase: 'https://example.com', productionId: 'day', token: 'token');
final board = boardFixture(
    name: 'Day',
    productionId: 'day',
    status: 'active',
    roster: [
      boardEntry(
          orderId: 'order', personName: 'Jamie', drink: 'Latte', group: 'Crew')
    ]);
PrintRecoveryRecord recovery(PrintRecoveryState state) => PrintRecoveryRecord(
    apiBase: session.apiBase,
    productionId: 'day',
    orderId: 'order',
    personName: 'Jamie',
    drink: 'Latte',
    createdAt: DateTime.utc(2026),
    state: state);

class Storage extends MemoryPrintRecoveryRepository {
  Storage([super.initial]);
  int writes = 0;
  int? failAt;
  @override
  Future<void> writeAll(List<PrintRecoveryRecord> records) async {
    if (++writes == failAt) throw StateError('disk full');
    await super.writeAll(records);
  }
}

class HeldStorage extends Storage {
  final entered = Completer<void>();
  final gate = Completer<void>();
  @override
  Future<void> writeAll(List<PrintRecoveryRecord> records) async {
    if (!entered.isCompleted) {
      entered.complete();
      await gate.future;
    }
    await super.writeAll(records);
  }
}

class Transport implements PrinterTransport {
  @override
  void Function()? onDisconnect;
  int packets = 0;
  int verifies = 0;
  final started = Completer<void>();
  Completer<void>? completion;
  bool fail = false;
  @override
  Future<String?> connect() async => 'M2_H';
  @override
  Future<void> disconnect() async {
    onDisconnect?.call();
  }

  @override
  Future<void> verifyConnection() async {
    verifies++;
  }

  @override
  Future<void> printPage(PrintPage page) async {
    packets++;
    if (!started.isCompleted) started.complete();
    if (fail) throw StateError('Bluetooth write failed');
    await completion?.future;
  }
}

class Api extends CtcApi {
  Api() : super(session);
  ProductionBoard response = board;
  int syncs = 0;
  bool fail = false;
  @override
  Future<ProductionBoard> fetchBoard() async => response;
  @override
  Future<void> markLabelPrinted(String orderId) async {
    syncs++;
    if (fail) throw StateError('offline');
  }

  @override
  void close() {}
}

Future<PrinterController> controller(
    Storage storage, Transport transport, Api api,
    {Duration timeout = const Duration(seconds: 2)}) async {
  final result = PrinterController(
      sessionRepository: MemorySessionRepository(session),
      printRecoveryRepository: storage,
      boardCacheRepository: MemoryBoardCacheRepository(),
      apiFactory: (_) => api,
      transport: transport,
      printOperationTimeout: timeout);
  addTearDown(result.dispose);
  await result.start();
  await result.connectPrinter();
  return result;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('day closure during preflight persistence prevents transmission',
      () async {
    final storage = HeldStorage();
    final transport = Transport();
    final api = Api();
    final c = await controller(storage, transport, api);
    final pending = c.printLabel(c.queue!.labels.first);
    await storage.entered.future;
    api.response = ProductionBoard(
        production: board.production.copyWith(status: 'complete'),
        roster: board.roster);
    await c.workspace.refreshBoard();
    storage.gate.complete();
    expect(await pending, false);
    expect(transport.packets, 0);
    expect(c.recoveryFor('order')?.state, PrintRecoveryState.uncertain);
  });
  test('workspace switch during printing cannot sync into another day',
      () async {
    final transport = Transport()..completion = Completer<void>();
    final api = Api();
    final c = await controller(Storage(), transport, api);
    final first = c.printLabel(c.queue!.labels.first);
    await transport.started.future;
    c.workspace.leaveLegacy();
    transport.completion!.complete();
    expect(await first, false);
    expect(api.syncs, 0);
    expect(c.recoveryFor('order'), isNotNull);
  });
  test(
      'restart with an uncertain reprint preserves evidence despite old server printed fact',
      () async {
    final api = Api()
      ..response = boardFixture(
          name: 'Day',
          productionId: 'day',
          status: 'active',
          roster: [
            boardEntry(
                orderId: 'order',
                personName: 'Jamie',
                drink: 'Latte',
                group: 'Crew',
                labelPrinted: true)
          ]);
    final c = await controller(
        Storage([recovery(PrintRecoveryState.uncertain)]), Transport(), api);
    expect(c.recoveryFor('order')!.state, PrintRecoveryState.uncertain);
    expect(await c.printLabel(c.queue!.labels.first), false);
  });
  test('dispose during rendering sends no printer task', () async {
    final transport = Transport();
    final c = PrinterController(
        sessionRepository: MemorySessionRepository(session),
        printRecoveryRepository: Storage(),
        boardCacheRepository: MemoryBoardCacheRepository(),
        apiFactory: (_) => Api(),
        transport: transport);
    await c.start();
    await c.connectPrinter();
    final first = c.printLabel(c.queue!.labels.first);
    c.dispose();
    expect(await first, false);
    expect(transport.packets, 0);
  });
  test('failed explicit retry cleanup retains uncertainty and sends nothing',
      () async {
    final storage = Storage([recovery(PrintRecoveryState.uncertain)])
      ..failAt = 1;
    final transport = Transport();
    final c = await controller(storage, transport, Api());
    await c.retryUncertainPrint(c.queue!.labels.first);
    expect(transport.packets, 0);
    expect(c.recoveryFor('order')!.state, PrintRecoveryState.uncertain);
  });
  test('shared outbox failed writes preserve the previous durable state',
      () async {
    final repository = FailingOutbox();
    final outbox = OrderMutationOutbox(repository);
    await outbox.start();
    final ledger = SharedPrintRecoveryLedger(outbox);
    repository.fail = true;
    await expectLater(ledger.record(recovery(PrintRecoveryState.uncertain)),
        throwsStateError);
    expect(ledger['order'], null);
    repository.fail = false;
    await ledger.record(recovery(PrintRecoveryState.uncertain));
    repository.fail = true;
    await expectLater(
        ledger.markPhysicalPrintConfirmed('order'), throwsStateError);
    expect(ledger['order']!.state, PrintRecoveryState.uncertain);
    await expectLater(ledger.clear('order'), throwsStateError);
    final restarted = OrderMutationOutbox(repository);
    await restarted.start();
    expect(restarted['order']!.printState, PrintRecoveryState.uncertain);
  });
  test('failed preflight persistence sends zero print packets', () async {
    final storage = Storage()..failAt = 1;
    final transport = Transport();
    final api = Api();
    final c = await controller(storage, transport, api);
    expect(await c.printLabel(c.queue!.labels.first), false);
    expect(transport.packets, 0);
    expect(api.syncs, 0);
    expect(c.recoveryFor('order'), null);
  });
  for (final boundary in [2, 3]) {
    test('failed write $boundary retains durable evidence across restart',
        () async {
      final storage = Storage()..failAt = boundary;
      final transport = Transport();
      final api = Api();
      final c = await controller(storage, transport, api);
      expect(await c.printLabel(c.queue!.labels.first), false);
      expect(transport.packets, 1);
      expect(c.recoveryFor('order'), isNotNull);
      final restarted = await controller(storage, Transport(), Api());
      expect(restarted.recoveryFor('order'), isNotNull);
      expect(await restarted.printLabel(restarted.queue!.labels.first), false);
    });
  }
  test('Bluetooth failure remains uncertain and never automatically retries',
      () async {
    final storage = Storage();
    final transport = Transport()..fail = true;
    final api = Api();
    final c = await controller(storage, transport, api);
    expect(await c.printLabel(c.queue!.labels.first), false);
    expect(c.recoveryFor('order')!.state, PrintRecoveryState.uncertain);
    await c.connectPrinter();
    expect(await c.printLabel(c.queue!.labels.first), false);
    expect(transport.packets, 1);
    expect(api.syncs, 0);
  });
  test('timeout, late completion and double taps cannot sync or retransmit',
      () async {
    final storage = Storage();
    final transport = Transport()..completion = Completer<void>();
    final api = Api();
    final c = await controller(storage, transport, api,
        timeout: const Duration(milliseconds: 20));
    final item = c.queue!.labels.first;
    final first = c.printLabel(item);
    expect(await c.printLabel(item), false);
    await transport.started.future;
    await c.retryUncertainPrint(item);
    await c.confirmUncertainLabelPrinted(item);
    expect(await first, false);
    expect(await c.connectPrinter(), false);
    transport.completion!.complete();
    await Future<void>.delayed(Duration.zero);
    expect(api.syncs, 0);
    expect(transport.packets, 1);
    expect(c.recoveryFor('order')!.state, PrintRecoveryState.uncertain);
  });
  for (final background in [false, true]) {
    test(
        '${background ? 'background/resume' : 'disconnect'} during transmission retains uncertainty',
        () async {
      final transport = Transport()..completion = Completer<void>();
      final api = Api();
      final c = await controller(Storage(), transport, api);
      final first = c.printLabel(c.queue!.labels.first);
      await transport.started.future;
      if (background) {
        c.didChangeAppLifecycleState(AppLifecycleState.paused);
        c.didChangeAppLifecycleState(AppLifecycleState.resumed);
      } else {
        transport.onDisconnect!();
      }
      transport.completion!.complete();
      expect(await first, false);
      expect(c.recoveryFor('order')!.state, PrintRecoveryState.uncertain);
      expect(api.syncs, 0);
      expect(transport.verifies, 0);
    });
  }
  test('server failure and sync-only retry send exactly one physical task',
      () async {
    final transport = Transport();
    final api = Api()..fail = true;
    final c = await controller(Storage(), transport, api);
    final item = c.queue!.labels.first;
    expect(await c.printLabel(item), false);
    expect(c.recoveryFor('order')!.state, PrintRecoveryState.printedNeedsSync);
    await c.retryUncertainPrint(item);
    expect(transport.packets, 1);
    api.fail = false;
    expect(await c.syncPrintedLabel(item), true);
    expect(transport.packets, 1);
    expect(c.recoveryFor('order'), null);
  });
  test('physical confirmation after restart is sync-only even disconnected',
      () async {
    final transport = Transport();
    final api = Api();
    final c = await controller(
        Storage([recovery(PrintRecoveryState.uncertain)]), transport, api);
    await c.disconnectPrinter();
    await c.confirmUncertainLabelPrinted(c.queue!.labels.first);
    expect(transport.packets, 0);
    expect(api.syncs, 1);
    expect(c.recoveryFor('order'), null);
  });
  for (final key in ['ctc_print_recovery_v1', 'ctc_order_mutation_outbox_v2']) {
    for (final raw in [
      '',
      '{',
      '{}',
      '[{}]',
      jsonEncode([recovery(PrintRecoveryState.uncertain).toJson(), {}])
    ]) {
      test('corrupt $key $raw fails closed and preserves original bytes',
          () async {
        SharedPreferences.setMockInitialValues({key: raw});
        final repository =
            key.endsWith('v1') ? PreferencesPrintRecoveryRepository() : null;
        await expectLater(
            repository != null
                ? repository.readAll()
                : PreferencesOrderMutationOutboxRepository().readAll(),
            throwsFormatException);
        expect((await SharedPreferences.getInstance()).getString(key), raw);
      });
    }
  }
  test('concurrent legacy ledger writes serialize without dropping evidence',
      () async {
    final storage = Storage();
    final ledger = PrintRecoveryLedger(storage);
    await Future.wait([
      ledger.record(recovery(PrintRecoveryState.uncertain)),
      ledger.markPhysicalPrintConfirmed('order')
    ]);
    expect(storage.records.single.state, PrintRecoveryState.printedNeedsSync);
    storage.failAt = storage.writes + 1;
    await expectLater(ledger.clear('order'), throwsStateError);
    expect(ledger['order'], isNotNull);
    await ledger.clear('order');
    expect(storage.records, isEmpty);
  });
}

class FailingOutbox extends MemoryOrderMutationOutboxRepository {
  bool fail = false;
  @override
  Future<void> writeAll(List<OrderMutationRecord> records) async {
    if (fail) throw StateError('disk full');
    await super.writeAll(records);
  }
}
