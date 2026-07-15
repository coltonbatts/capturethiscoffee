import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Printer app renders link screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
    ));
    await tester.pump();
    expect(find.text('Link production'), findsOneWidget);
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
