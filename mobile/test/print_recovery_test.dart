import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:flutter_test/flutter_test.dart';

const _session = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'production-1',
  token: 'token',
);

PrintRecoveryRecord record(PrintRecoveryState state) => PrintRecoveryRecord(
      apiBase: _session.apiBase,
      productionId: _session.productionId,
      orderId: 'order-1',
      personName: 'Jamie Example',
      drink: 'Iced oat latte',
      createdAt: DateTime.utc(2026, 7, 15, 18),
      state: state,
    );

void main() {
  test('uncertain print transitions to sync-only and then clears', () async {
    final repository = MemoryPrintRecoveryRepository();
    final ledger = PrintRecoveryLedger(repository);

    await ledger.record(record(PrintRecoveryState.uncertain));
    expect(ledger['order-1']?.state, PrintRecoveryState.uncertain);

    await ledger.markPhysicalPrintConfirmed('order-1');
    expect(ledger['order-1']?.state, PrintRecoveryState.printedNeedsSync);

    await ledger.clear('order-1');
    expect(ledger['order-1'], isNull);
    expect(repository.records, isEmpty);
  });

  test('confirmed physical print cannot regress to uncertain', () async {
    final ledger = PrintRecoveryLedger(MemoryPrintRecoveryRepository());
    await ledger.record(record(PrintRecoveryState.printedNeedsSync));

    await expectLater(
      ledger.record(record(PrintRecoveryState.uncertain)),
      throwsStateError,
    );
  });

  test('server-confirmed printed state clears durable recovery', () async {
    final repository = MemoryPrintRecoveryRepository([
      record(PrintRecoveryState.printedNeedsSync),
    ]);
    final ledger = await PrintRecoveryLedger.load(repository);

    await ledger.clearServerConfirmed(['order-1']);
    expect(ledger.forSession(_session), isEmpty);
    expect(repository.records, isEmpty);
  });

  test('recovery records round-trip and stay production scoped', () {
    final original = record(PrintRecoveryState.uncertain);
    final decoded = PrintRecoveryRecord.tryFromJson(original.toJson());

    expect(decoded?.orderId, original.orderId);
    expect(decoded?.state, PrintRecoveryState.uncertain);
    expect(decoded?.belongsTo(_session), isTrue);
    expect(
      decoded?.belongsTo(const ProductionSession(
        apiBase: 'https://coffee.capturethis.com',
        productionId: 'another-production',
        token: 'token',
      )),
      isFalse,
    );
  });
}
