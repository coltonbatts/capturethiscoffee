// Golden coverage for the on-device label renderer.
//
// These goldens are the label the operator physically prints. Regenerate with:
//   flutter test test/label_golden_test.dart --update-goldens
//
// Review the regenerated PNGs by eye before committing — a golden that changed
// because the design changed and a golden that changed because the renderer
// broke look identical in a diff stat.
//
// The paired server renderer lives in src/lib/niimbot-m2-draw.ts (`drawGrid01`).
// Compare the two with:
//   node scripts/compare-label-renderers.mjs

import 'package:ctc_printer/label_content.dart';
import 'package:ctc_printer/label_painter.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _loadLabelFonts() async {
  final loader = FontLoader(labelFontFamily)
    ..addFont(rootBundle.load('assets/fonts/Arial.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Arial-Bold.ttf'));
  await loader.load();
}

/// The fixtures are chosen to exercise every branch `drawGrid01` can take:
/// short vs long name (the 18-character threshold flips font size and baseline),
/// one-line vs wrapped vs ellipsised drink, and missing optional fields.
const _fixtures =
    <String, ({String name, String drink, String group, String client})>{
  'grid-01-short-name': (
    name: 'Jordan Lee',
    drink: 'Iced oat latte',
    group: 'Camera',
    client: 'Capture This',
  ),
  'grid-01-long-name': (
    name: 'Alexandra Constantinopolous-Whitfield',
    drink: 'Flat white',
    group: 'Second Unit',
    client: 'Capture This',
  ),
  'grid-01-regression-long-name': (
    name: 'Cameron Ellington-Smythe',
    drink: 'Iced oat latte',
    group: 'Camera',
    client: 'Capture This',
  ),
  'grid-01-long-drink': (
    name: 'Sam Okafor',
    drink:
        'Large iced quad-shot oat milk latte, two pumps vanilla, light ice, extra hot lid',
    group: 'Production',
    client: 'Capture This',
  ),
  'grid-01-minimal': (
    name: 'Al',
    drink: 'Tea',
    group: '',
    client: '',
  ),
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(_loadLabelFonts);

  _fixtures.forEach((golden, fixture) {
    test(
      'renders $golden',
      () async {
        final image = await renderLabelImage(LabelContent.fromQueue(
          orderId: 'order-a1b2c3d4',
          personName: fixture.name,
          drink: fixture.drink,
          group: fixture.group,
          productionName: 'Review Day',
          clientName: fixture.client,
        ));
        addTearDown(image.dispose);

        await expectLater(
          image,
          matchesGoldenFile('goldens/labels/$golden.png'),
        );
      },
      tags: 'golden',
    );
  });
}
