import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

import 'label_content.dart';

/// 50x30mm at 300 DPI, matching `src/lib/niimbot-m2-preset.json`.
///
/// These are asserted in `mobile/test/label_render_test.dart`. The printer
/// pipeline downscales to the 567-dot printhead, so this is the render size,
/// not the print size.
const int labelPixelWidth = 591;
const int labelPixelHeight = 354;

/// The label face. Matches the fonts the server registers in
/// `src/lib/niimbot-m2-export-server.ts` from `public/fonts/`.
///
/// Named `Arial` on purpose: if the bundled asset ever fails to load, iOS falls
/// back to its own Arial, which is the closest possible match. A private family
/// name would fall back to the system UI face and silently change every metric.
const String labelFontFamily = 'Arial';

/// Paints the `grid-01` design — the default in `src/lib/label-designs.ts`.
///
/// This is a direct port of `drawGrid01` in `src/lib/niimbot-m2-draw.ts`,
/// including its helpers. Coordinates are copied verbatim; if the web design
/// moves, this must move with it.
///
/// Only `grid-01` is ported. The other seven designs are a web-side design
/// playground and are not part of the on-set print path.
void paintGrid01Label(Canvas canvas, LabelContent label) {
  final ctx = _LabelCanvas(canvas);
  const left = 62.0;
  const right = 563.0;
  const width = right - left;

  ctx.reset();
  ctx.fillColor = const Color(0xFF000000);
  ctx.fillRect(0, 0, 34, labelPixelHeight.toDouble());
  ctx.rotatedRailText('01', 23, labelPixelHeight - 24, const Color(0xFFFFFFFF));

  ctx.metaRow(
    'CAPTURE THIS COFFEE',
    'NO. ${label.displayOrderNumber}',
    left,
    right,
    40,
  );
  ctx.fillRect(left, 57, width, 2);

  ctx.setFont(FontWeight.w700, 16);
  ctx.fillText('FOR', left, 94);
  ctx.responsiveName(
    label.displayName,
    left,
    151,
    width,
    shortSize: 92,
    longSize: 62,
    longY: 139,
    lineHeight: 57,
    minSize: 29,
  );

  ctx.setFont(FontWeight.w700, 28);
  ctx.fittedWrappedText(label.displayDrink, left, 263, width, 29, 2, 18);
  ctx.fillRect(left, 293, width, 2);
  ctx.metaRow(label.displayProduction, label.displayGroup, left, right, 327);
}

/// A Canvas-2D-shaped wrapper over Flutter's `Canvas`.
///
/// The web renderer is written against the 2D context's stateful model — a
/// current font, fill colour, and text alignment that helpers mutate and
/// restore. Porting that shape directly keeps the two renderers diffable
/// against each other, which matters more here than idiomatic Dart: the web
/// version is the design source of truth and will keep changing.
///
/// Two conversions carry all the risk:
///   * `fillText` places `y` at the alphabetic baseline; `TextPainter.paint`
///     places its offset at the top of the line box. Every draw subtracts the
///     measured baseline distance.
///   * `measureText().width` becomes `TextPainter.width` after an unbounded
///     layout.
class _LabelCanvas {
  _LabelCanvas(this.canvas);

  final Canvas canvas;

  double _fontSize = 16;
  FontWeight _fontWeight = FontWeight.w400;
  Color fillColor = const Color(0xFF000000);
  _TextAlign _textAlign = _TextAlign.start;

  /// `resetCanvas` in the web renderer.
  void reset() {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, labelPixelWidth.toDouble(), labelPixelHeight.toDouble()),
      Paint()..color = const Color(0xFFFFFFFF),
    );
    fillColor = const Color(0xFF000000);
    _textAlign = _TextAlign.start;
  }

  void setFont(FontWeight weight, double size) {
    _fontWeight = weight;
    _fontSize = size;
  }

  void fillRect(double x, double y, double w, double h) {
    canvas.drawRect(Rect.fromLTWH(x, y, w, h), Paint()..color = fillColor);
  }

  TextPainter _painter(String text) => TextPainter(
        text: TextSpan(
          text: text,
          style: TextStyle(
            fontFamily: labelFontFamily,
            fontSize: _fontSize,
            fontWeight: _fontWeight,
            color: fillColor,
          ),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 1,
      )..layout();

  /// `ctx.measureText(text).width`.
  double measure(String text) => _painter(text).width;

  /// `ctx.fillText(text, x, y)` with an alphabetic baseline.
  void fillText(String text, double x, double y) {
    if (text.isEmpty) return;
    final painter = _painter(text);
    final baseline = painter.computeDistanceToActualBaseline(
      TextBaseline.alphabetic,
    );
    final dx = switch (_textAlign) {
      _TextAlign.start => x,
      _TextAlign.right => x - painter.width,
      _TextAlign.center => x - painter.width / 2,
    };
    painter.paint(canvas, Offset(dx, y - baseline));
    painter.dispose();
  }

  /// `drawMetaRow`.
  void metaRow(
    String leftText,
    String rightText,
    double left,
    double right,
    double y,
  ) {
    final width = right - left;
    setFont(FontWeight.w700, 14);
    _textAlign = _TextAlign.start;
    ellipsisText(leftText.toUpperCase(), left, y, width * 0.68);
    _textAlign = _TextAlign.right;
    ellipsisText(rightText.toUpperCase(), right, y, width * 0.28);
    _textAlign = _TextAlign.start;
  }

  /// `drawRotatedRailText`.
  void rotatedRailText(
    String value,
    double x,
    double y,
    Color color, [
    double rotation = -math.pi / 2,
  ]) {
    final previousColor = fillColor;
    final previousWeight = _fontWeight;
    final previousSize = _fontSize;

    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(rotation);
    fillColor = color;
    setFont(FontWeight.w900, 18);
    fillText(value, 0, 0);
    canvas.restore();

    fillColor = previousColor;
    setFont(previousWeight, previousSize);
  }

  /// `drawResponsiveName`.
  void responsiveName(
    String value,
    double x,
    double shortY,
    double maxWidth, {
    required double shortSize,
    required double longSize,
    required double longY,
    required double lineHeight,
    required double minSize,
  }) {
    final name = value.toUpperCase();
    final isLong = name.length > 18;
    setFont(FontWeight.w900, isLong ? longSize : shortSize);
    fittedWrappedText(
      name,
      x,
      isLong ? longY : shortY,
      maxWidth,
      isLong ? lineHeight : shortSize,
      isLong ? 2 : 1,
      minSize,
    );
  }

  /// `drawFittedWrappedText`.
  ///
  /// Shrinks the font one pixel at a time until the text fits, then draws at
  /// most `maxLines` lines, ellipsising the last one if content was dropped.
  void fittedWrappedText(
    String text,
    double x,
    double y,
    double maxWidth,
    double lineHeight,
    int maxLines,
    double minFontSize,
  ) {
    final originalSize = _fontSize;
    final originalWeight = _fontWeight;
    var nextLineHeight = lineHeight;
    var lines = wrappedLines(text, maxWidth, maxLines);

    bool overflowing() =>
        lines.any((line) => measure(line) > maxWidth) ||
        wrappedLines(text, maxWidth, maxLines + 1).length > maxLines;

    while (_fontSize > minFontSize && overflowing()) {
      _fontSize -= 1;
      nextLineHeight = math.max(nextLineHeight - 0.8, minFontSize * 0.9);
      lines = wrappedLines(text, maxWidth, maxLines);
    }

    final truncated =
        wrappedLines(text, maxWidth, maxLines + 1).length > maxLines;
    final visible = lines.take(maxLines).toList();
    final lastIndex = math.min(lines.length, maxLines) - 1;

    for (var index = 0; index < visible.length; index += 1) {
      final line = truncated && index == lastIndex
          ? '${visible[index]}...'
          : visible[index];
      ellipsisText(line, x, y + index * nextLineHeight, maxWidth);
    }

    setFont(originalWeight, originalSize);
  }

  /// `wrappedLines`.
  List<String> wrappedLines(String text, double maxWidth, int maxLines) {
    final words =
        text.split(RegExp(r'\s+')).where((word) => word.isNotEmpty).toList();
    final lines = <String>[];
    var line = '';

    for (final word in words) {
      final next = line.isEmpty ? word : '$line $word';
      if (measure(next) <= maxWidth || line.isEmpty) {
        line = next;
        continue;
      }
      lines.add(line);
      line = word;
      if (lines.length == maxLines) break;
    }
    if (line.isNotEmpty && lines.length < maxLines) lines.add(line);
    return lines.length > maxLines ? lines.sublist(0, maxLines) : lines;
  }

  /// `drawEllipsisText`.
  void ellipsisText(String text, double x, double y, double maxWidth) {
    final value = ellipsize(text, maxWidth);
    if (value.isNotEmpty) fillText(value, x, y);
  }

  /// `ellipsizeToWidth`.
  String ellipsize(String text, double maxWidth) {
    if (text.isEmpty) return '';
    if (measure(text) <= maxWidth) return text;
    if (measure('...') > maxWidth) return '';

    var low = 0;
    var high = text.length;
    var best = '';
    while (low <= high) {
      final mid = (low + high) ~/ 2;
      final candidate = '${text.substring(0, mid).trimRight()}...';
      if (measure(candidate) <= maxWidth) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }
}

enum _TextAlign { start, right, center }

/// Rasterises a label at the preset size. The caller owns the returned image.
Future<ui.Image> renderLabelImage(LabelContent label) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(
    recorder,
    Rect.fromLTWH(0, 0, labelPixelWidth.toDouble(), labelPixelHeight.toDouble()),
  );
  paintGrid01Label(canvas, label);

  final picture = recorder.endRecording();
  try {
    return await picture.toImage(labelPixelWidth, labelPixelHeight);
  } finally {
    picture.dispose();
  }
}

/// Renders a label to PNG bytes at the preset size.
///
/// The bytes go straight into `PrintPage.addImageFromBuffer`, which is the same
/// buffer the app previously downloaded from
/// `GET /api/public/orders/[id]/label`. Nothing downstream of this function
/// changed, which is deliberate: the BLE print path is proven on hardware.
Future<Uint8List> renderLabelPng(LabelContent label) async {
  final image = await renderLabelImage(label);
  try {
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    if (data == null) {
      throw StateError('Could not encode the label image.');
    }
    return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
  } finally {
    image.dispose();
  }
}
