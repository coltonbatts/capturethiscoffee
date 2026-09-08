import 'package:ctc_printer/print_recovery.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('plugins.flutter.io/shared_preferences');
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      if (call.method.startsWith('getAll')) return <String, Object>{};
      return false; // Native storage explicitly rejects the write.
    });
  });
  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });
  test('legacy preferences false return rejects both recording and cleanup',
      () async {
    final repository = PreferencesPrintRecoveryRepository();
    final record = PrintRecoveryRecord(
        apiBase: 'https://example.com',
        productionId: 'day',
        orderId: 'order',
        personName: 'Jamie',
        drink: 'Latte',
        createdAt: DateTime.utc(2026),
        state: PrintRecoveryState.uncertain);
    await expectLater(repository.writeAll([record]), throwsStateError);
    await expectLater(repository.writeAll([]), throwsStateError);
  });
  test('shared outbox preferences false return rejects cleanup', () async {
    await expectLater(PreferencesOrderMutationOutboxRepository().writeAll([]),
        throwsStateError);
  });
}
