import 'package:ctc_printer/label_content.dart';
import 'package:ctc_printer/label_painter.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

/// Loads the bundled label faces.
///
/// `flutter_test` does not honour pubspec font declarations — without this the
/// renderer falls back to the test placeholder face and every metric-dependent
/// assertion below becomes meaningless.
Future<void> _loadLabelFonts() async {
  final loader = FontLoader(labelFontFamily)
    ..addFont(rootBundle.load('assets/fonts/Arial.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Arial-Bold.ttf'));
  await loader.load();
}

LabelContent _label({
  String orderId = 'order-a1b2c3d4e5',
  String personName = 'Jamie Example',
  String drink = 'Iced oat latte',
  String group = 'Camera',
  String productionName = 'Review Day',
  String clientName = 'Capture This',
}) =>
    LabelContent.fromQueue(
      orderId: orderId,
      personName: personName,
      drink: drink,
      group: group,
      productionName: productionName,
      clientName: clientName,
    );

/// Counts dark pixels right of the point the print path samples.
///
/// Mirrors `_countTextSideInk` in main.dart, which triggers the emergency
/// name/drink overlay when a label looks blank. If a render ever falls below
/// that threshold the operator gets a fallback label instead of the design.
int _textSideInk(img.Image decoded) {
  final startX = (decoded.width * 0.44).round();
  var count = 0;
  for (var y = 0; y < decoded.height; y += 1) {
    for (var x = startX; x < decoded.width; x += 1) {
      final pixel = decoded.getPixel(x, y);
      if (pixel.a.toInt() == 0) continue;
      final luminance =
          (pixel.r.toInt() + pixel.g.toInt() + pixel.b.toInt()) ~/ 3;
      if (luminance < 180) count += 1;
    }
  }
  return count;
}

img.Image _decode(Uint8List bytes) {
  final decoded = img.decodeImage(bytes);
  expect(decoded, isNotNull, reason: 'rendered bytes must decode as PNG');
  return decoded!;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(_loadLabelFonts);

  group('label geometry', () {
    test('renders exactly the NIIMBOT M2 preset size', () async {
      final decoded = _decode(await renderLabelPng(_label()));

      // 50x30mm at 300 DPI, per src/lib/niimbot-m2-preset.json. The printer
      // downscales to the 567-dot printhead; getting this wrong distorts every
      // physical label.
      expect(decoded.width, 591);
      expect(decoded.height, 354);
    });

    test('paints the left index rail', () async {
      final decoded = _decode(await renderLabelPng(_label()));

      // drawGrid01 fills x < 34 solid black for the full height.
      final railPixel = decoded.getPixel(10, 177);
      expect(railPixel.r.toInt(), lessThan(64));

      // Immediately right of the rail is bare stock.
      final fieldPixel = decoded.getPixel(50, 177);
      expect(fieldPixel.r.toInt(), greaterThan(192));
    });
  });

  group('ink coverage', () {
    test('a normal label never trips the blank-label overlay', () async {
      final decoded = _decode(await renderLabelPng(_label()));

      // kMinimumTextSideInkPixels in main.dart is 300.
      expect(_textSideInk(decoded), greaterThan(300));
    });

    test('a long name and long drink still render ink', () async {
      final decoded = _decode(await renderLabelPng(_label(
        personName: 'Alexandra Constantinopolous-Whitfield',
        drink:
            'Large iced quad-shot oat milk latte, two pumps vanilla, light ice',
        group: 'Second Unit Camera Department',
      )));

      expect(_textSideInk(decoded), greaterThan(300));
    });

    test('the shortest survivable label still renders ink', () async {
      final decoded = _decode(await renderLabelPng(_label(
        personName: 'Al',
        drink: 'Tea',
        group: '',
        clientName: '',
      )));

      expect(_textSideInk(decoded), greaterThan(300));
    });
  });

  group('label content', () {
    test('builds the brand line from production and client', () {
      expect(_label().displayProduction, 'Review Day / Capture This');
    });

    test('drops the separator when there is no client', () {
      expect(
        _label(clientName: '').displayProduction,
        'Review Day',
      );
    });

    test('falls back to the app name when nothing is known', () {
      expect(
        _label(productionName: '', clientName: '').displayProduction,
        'Capture This Coffee',
      );
    });

    test('an empty group matches the server default, not ON SET', () {
      // buildPrinterQueue resolves group_label -> department -> "Set", so the
      // server renders "SET" here. The app rendering "ON SET" would be a
      // visible mismatch between two labels for the same person.
      expect(_label(group: '').displayGroup, 'Set');
      expect(_label(group: 'Camera').displayGroup, 'Camera');
    });

    test('ON SET remains the fallback for a hand-built label', () {
      const bare = LabelContent(
        personName: 'Jamie Example',
        drink: 'Tea',
        group: '',
        productionClient: 'Review Day',
        orderNumber: 'A1B2C3',
      );

      expect(bare.displayGroup, 'ON SET');
    });

    test('order number matches the web shortOrderId stub', () {
      // src/lib/label-copy.ts takes six characters, uppercased.
      expect(shortOrderNumber('order-a1b2c3d4e5'), 'A1B2C3');
      expect(shortOrderNumber('a1b2c3d4e5'), 'A1B2C3');
      expect(shortOrderNumber('abc'), 'ABC');
    });

    test('order number treats placeholder ids as absent', () {
      expect(shortOrderNumber('manual'), '');
      expect(shortOrderNumber('order-'), '');
      expect(shortOrderNumber(''), '');
      expect(shortOrderNumber(null), '');
    });

    test('an absent order number renders the em-dash fallback', () {
      expect(_label(orderId: 'manual').displayOrderNumber, '—');
      expect(_label(orderId: 'order-a1b2c3').displayOrderNumber, 'A1B2C3');
    });
  });

  group('rendering robustness', () {
    test('renders without throwing for hostile content', () async {
      final cases = <LabelContent>[
        _label(personName: '', drink: '', group: '', productionName: ''),
        _label(personName: 'A' * 200, drink: 'B' * 400),
        _label(personName: 'Zoë Ólafsdóttir-Nakamura', drink: 'Café crème'),
        _label(personName: '     ', drink: '   '),
      ];

      for (final content in cases) {
        final decoded = _decode(await renderLabelPng(content));
        expect(decoded.width, 591);
        expect(decoded.height, 354);
      }
    });

    test('is deterministic for the same content', () async {
      final first = await renderLabelPng(_label());
      final second = await renderLabelPng(_label());

      expect(first, equals(second));
    });
  });
}
