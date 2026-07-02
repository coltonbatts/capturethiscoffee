import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/production_session.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Printer app renders link screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const PrinterApp());
    await tester.pump();
    expect(find.text('Link production'), findsOneWidget);
  });

  test('parseProductionShareUrl extracts session fields', () {
    final session = parseProductionShareUrl(
      'https://capturethis.coffee/productions/prod-1?token=abc123',
    );
    expect(session?.productionId, 'prod-1');
    expect(session?.token, 'abc123');
    expect(session?.apiBase, 'https://capturethis.coffee');
  });
}
