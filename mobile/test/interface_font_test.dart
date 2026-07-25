// Guards the interface typeface.
//
// Two things here cannot be caught by the App Store screenshot goldens, which
// is why this file exists: `flutter test` does not load bundled fonts unless a
// test asks it to, so those goldens render placeholder box glyphs and would
// pass unchanged if Geist vanished from the bundle entirely.
//
// The failure this is really aimed at: someone replaces the variable TTF with
// a static instance. Nothing throws, nothing looks obviously broken, and every
// off-scale weight the design depends on (460, 650, 750) silently collapses to
// the nearest static face. The splash headline quietly stops being a splash
// headline.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ctc_printer/theme.dart';

Future<void> _loadInterfaceFonts() async {
  await (FontLoader(kInterfaceFont)
        ..addFont(rootBundle.load('assets/fonts/Geist-Variable.ttf')))
      .load();
  await (FontLoader(kInterfaceMonoFont)
        ..addFont(rootBundle.load('assets/fonts/GeistMono-Variable.ttf')))
      .load();
}

double _widthOf(String text, TextStyle style) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
  )..layout();
  return painter.width;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(_loadInterfaceFonts);

  const sample = 'Coffee, ready for set.';

  test('the interface font is not the label font', () {
    // The invariant that protects physical output. Interface type and label
    // type must never be the same family, in either direction.
    expect(kInterfaceFont, isNot(equals('Arial')));
    expect(kInterfaceMonoFont, isNot(equals('Arial')));
  });

  test('Geist renders differently from the fallback font', () {
    final geist =
        _widthOf(sample, const TextStyle(fontFamily: kInterfaceFont, fontSize: 32));
    final fallback = _widthOf(sample, const TextStyle(fontSize: 32));

    // If the family failed to register, Flutter falls back silently and these
    // measure identically.
    expect(
      geist,
      isNot(closeTo(fallback, 0.01)),
      reason: 'Geist did not load — the app is silently rendering in the '
          'fallback font. Check assets/fonts/Geist-Variable.ttf and its '
          'pubspec.yaml registration.',
    );
  });

  test('the weight axis responds across the range the design uses', () {
    // Each of these weights is load-bearing somewhere: 460 in the splash
    // supporting line, 600 across the type scale, 650 on the hero action,
    // 750 in the splash headline.
    final widths = <double, double>{
      for (final w in <double>[400, 460, 600, 650, 750])
        w: _widthOf(
          sample,
          TextStyle(
            fontFamily: kInterfaceFont,
            fontSize: 32,
            fontVariations: [FontVariation('wght', w)],
          ),
        ),
    };

    // A variable face gets wider as it gets heavier. A static instance returns
    // one width for every request.
    final distinct = widths.values.map((w) => w.toStringAsFixed(2)).toSet();
    expect(
      distinct.length,
      greaterThan(1),
      reason: 'Every weight measured identically, so the wght axis is not '
          'responding. assets/fonts/Geist-Variable.ttf has probably been '
          'replaced with a static instance.',
    );

    expect(
      widths[750]!,
      greaterThan(widths[400]!),
      reason: 'wght 750 should render wider than wght 400.',
    );
  });

  test('GeistMono is monospaced and distinct from Geist', () {
    const mono = TextStyle(fontFamily: kInterfaceMonoFont, fontSize: 16);

    // Every glyph advances by the same amount, which is the entire reason the
    // activity log uses it.
    expect(
      _widthOf('iiii', mono),
      closeTo(_widthOf('WWWW', mono), 0.01),
      reason: 'GeistMono is not advancing uniformly — it is not the mono face.',
    );

    expect(
      _widthOf('WWWW', mono),
      isNot(closeTo(
        _widthOf('WWWW', const TextStyle(fontFamily: kInterfaceFont, fontSize: 16)),
        0.01,
      )),
    );
  });

  test('the type scale keeps tracking proportional to size', () {
    // letterSpacing is in logical pixels here while the web specifies em, so
    // every value is size * em. This is the one arithmetic trap in theme.dart:
    // change a font size without recomputing tracking and the headline
    // silently drifts off the web's -0.055em.
    void expectEm(TextStyle style, double em, String name) {
      expect(
        style.letterSpacing! / style.fontSize!,
        closeTo(em, 0.002),
        reason: '$name tracking should be ${em}em of its font size.',
      );
    }

    expectEm(CaptureType.hero, -0.075, 'hero');
    expectEm(CaptureType.pageTitle, -0.055, 'pageTitle');
    expectEm(CaptureType.textTheme.headlineLarge!, -0.055, 'headlineLarge');
    expectEm(CaptureType.textTheme.headlineMedium!, -0.055, 'headlineMedium');
    expectEm(CaptureType.rowName, -0.035, 'rowName');
    expectEm(CaptureType.statNumber, -0.04, 'statNumber');
  });

  test('the animated count uses tabular figures', () {
    // The deck counts this number downward. Proportional digits make it jitter
    // as the glyphs change width mid-animation.
    expect(
      CaptureType.statNumber.fontFeatures,
      contains(const FontFeature.tabularFigures()),
    );
  });
}
