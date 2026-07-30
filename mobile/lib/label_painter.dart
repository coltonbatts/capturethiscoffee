import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

import 'label_content.dart';
import 'label_template.dart';

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
      Rect.fromLTWH(
          0, 0, labelPixelWidth.toDouble(), labelPixelHeight.toDouble()),
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

/// Paints a previously validated declarative label template.
///
/// There are intentionally no callbacks, scripts, URLs, asset references, or
/// arbitrary paths in this interpreter. A published version can only select
/// bounded text, line, shape, and built-in mark primitives.
List<TextPainter> paintLabelTemplate(
  Canvas canvas,
  LabelContent label,
  LabelTemplateDefinition definition,
) {
  final retainedPainters = <TextPainter>[];
  canvas.drawRect(
    Rect.fromLTWH(
      0,
      0,
      definition.pixelWidth.toDouble(),
      definition.pixelHeight.toDouble(),
    ),
    Paint()
      ..color = _templateColor(definition.background)
      ..isAntiAlias = false,
  );

  for (final element in definition.elements) {
    switch (element['type']) {
      case 'text':
        _paintTemplateText(canvas, label, element, retainedPainters);
      case 'line':
        canvas.drawLine(
          Offset(_value(element, 'x1'), _value(element, 'y1')),
          Offset(_value(element, 'x2'), _value(element, 'y2')),
          _strokePaint(element),
        );
      case 'rect':
        _paintShape(
          canvas,
          element,
          Rect.fromLTWH(
            _value(element, 'x'),
            _value(element, 'y'),
            _value(element, 'width'),
            _value(element, 'height'),
          ),
        );
      case 'roundedRect':
        _paintRoundedRect(canvas, element);
      case 'circle':
        _paintCircle(canvas, element);
      case 'ellipse':
        _paintEllipse(canvas, element);
      case 'mark':
        _paintMark(canvas, element);
    }
  }
  return retainedPainters;
}

void _paintTemplateText(
  Canvas canvas,
  LabelContent content,
  Map<String, Object?> element,
  List<TextPainter> retainedPainters,
) {
  final rawSegments = element['segments']! as List;
  final buffer = StringBuffer();
  for (final rawSegment in rawSegments) {
    final segment = rawSegment as Map;
    final literal = segment['literal'];
    if (literal is String) {
      buffer.write(literal);
    } else {
      buffer.write(_bindingValue(content, segment['binding']! as String));
    }
  }
  var value = buffer.toString();
  if (element['uppercase'] == true) value = value.toUpperCase();
  if (value.isEmpty) return;

  final x = _value(element, 'x');
  final y = _value(element, 'y');
  final width = _value(element, 'width');
  final height = _value(element, 'height');
  final maximumSize = _value(element, 'fontSize');
  final minimumSize = _value(element, 'minFontSize');
  final declaredLineHeight = _value(element, 'lineHeight');
  final maximumLines = (element['maxLines']! as num).toInt();
  final weight =
      element['fontWeight'] == 'bold' ? FontWeight.w700 : FontWeight.w400;
  final align = switch (element['align']) {
    'center' => TextAlign.center,
    'right' => TextAlign.right,
    _ => TextAlign.left,
  };

  var fontSize = maximumSize;
  var lineHeight = declaredLineHeight;
  var style = _templateTextStyle(element, fontSize, weight);
  var lines = <String>[];
  final oneLineMinimum =
      math.max(minimumSize, (maximumSize * 0.6).ceilToDouble());
  while (fontSize >= oneLineMinimum) {
    style = _templateTextStyle(element, fontSize, weight);
    if (_measureTemplateText(value, style) <= width && fontSize <= height) {
      lines = [value];
      break;
    }
    if (fontSize == oneLineMinimum) break;
    fontSize = math.max(oneLineMinimum, fontSize - 1);
  }

  if (lines.isEmpty) {
    fontSize = maximumSize;
    style = _templateTextStyle(element, fontSize, weight);
    while (fontSize >= minimumSize) {
      style = _templateTextStyle(element, fontSize, weight);
      lineHeight = declaredLineHeight * (fontSize / maximumSize);
      lines = _wrapTemplateText(value, width, style);
      final paintedHeight =
          fontSize + math.max(0, lines.length - 1) * lineHeight;
      final fits = lines.length <= maximumLines &&
          paintedHeight <= height &&
          lines.every(
            (line) => _measureTemplateText(line, style) <= width,
          );
      if (fits || fontSize == minimumSize) break;
      fontSize = math.max(minimumSize, fontSize - 1);
    }
  }

  final visible = lines.take(maximumLines).toList();
  for (var index = 0; index < visible.length; index += 1) {
    final dropped = lines.length > maximumLines && index == visible.length - 1;
    visible[index] = _ellipsizeTemplateText(
      dropped ? '${visible[index]}…' : visible[index],
      width,
      style,
    );
  }

  canvas.save();
  _rotateAroundBoxCenter(canvas, element, x, y, width, height);
  for (var index = 0; index < visible.length; index += 1) {
    final painter = TextPainter(
      text: TextSpan(text: visible[index], style: style),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();
    final dx = switch (align) {
      TextAlign.center => x + (width - painter.width) / 2,
      TextAlign.right => x + width - painter.width,
      _ => x,
    };
    painter.paint(canvas, Offset(dx, y + index * lineHeight));
    // The recorded picture retains the paragraph until rasterization. Dispose
    // only after `Picture.toImage`.
    retainedPainters.add(painter);
  }
  canvas.restore();
}

TextStyle _templateTextStyle(
  Map<String, Object?> element,
  double fontSize,
  FontWeight weight,
) =>
    TextStyle(
      fontFamily: labelFontFamily,
      fontSize: fontSize,
      fontWeight: weight,
      color: _templateColor(element['color']! as String),
    );

double _measureTemplateText(String value, TextStyle style) {
  final painter = TextPainter(
    text: TextSpan(text: value, style: style),
    textDirection: TextDirection.ltr,
    maxLines: 1,
  )..layout();
  final width = painter.width;
  painter.dispose();
  return width;
}

List<String> _wrapTemplateText(
  String value,
  double width,
  TextStyle style,
) {
  final words =
      value.trim().split(RegExp(r'\s+')).where((word) => word.isNotEmpty);
  final lines = <String>[];
  var line = '';
  for (final word in words) {
    final next = line.isEmpty ? word : '$line $word';
    if (line.isEmpty || _measureTemplateText(next, style) <= width) {
      line = next;
    } else {
      lines.add(line);
      line = word;
    }
  }
  if (line.isNotEmpty) lines.add(line);
  return lines;
}

String _ellipsizeTemplateText(
  String value,
  double width,
  TextStyle style,
) {
  if (value.isEmpty || _measureTemplateText(value, style) <= width) {
    return value;
  }
  if (_measureTemplateText('…', style) > width) return '';
  var low = 0;
  var high = value.length;
  var best = '';
  while (low <= high) {
    final middle = (low + high) ~/ 2;
    final candidate = '${value.substring(0, middle).trimRight()}…';
    if (_measureTemplateText(candidate, style) <= width) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

String _bindingValue(LabelContent content, String binding) => switch (binding) {
      'personName' => content.displayName,
      'drink' => content.displayDrink,
      'productionName' => content.productionName,
      'clientName' => content.clientName,
      'productionClient' => content.displayProduction,
      'group' => content.displayGroup,
      'orderNumber' => content.displayOrderNumber,
      _ => '',
    };

void _paintShape(
  Canvas canvas,
  Map<String, Object?> element,
  Rect rect,
) {
  canvas.save();
  _rotateAroundBoxCenter(
    canvas,
    element,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
  );
  final fill = _fillPaint(element);
  if (fill != null) canvas.drawRect(rect, fill);
  final stroke = _optionalStrokePaint(element);
  if (stroke != null) canvas.drawRect(rect, stroke);
  canvas.restore();
}

void _paintRoundedRect(Canvas canvas, Map<String, Object?> element) {
  final rect = Rect.fromLTWH(
    _value(element, 'x'),
    _value(element, 'y'),
    _value(element, 'width'),
    _value(element, 'height'),
  );
  final shape = RRect.fromRectAndRadius(
    rect,
    Radius.circular(_value(element, 'radius')),
  );
  canvas.save();
  _rotateAroundBoxCenter(
    canvas,
    element,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
  );
  final fill = _fillPaint(element);
  if (fill != null) canvas.drawRRect(shape, fill);
  final stroke = _optionalStrokePaint(element);
  if (stroke != null) canvas.drawRRect(shape, stroke);
  canvas.restore();
}

void _paintCircle(Canvas canvas, Map<String, Object?> element) {
  final center = Offset(_value(element, 'cx'), _value(element, 'cy'));
  final radius = _value(element, 'radius');
  final fill = _fillPaint(element);
  if (fill != null) canvas.drawCircle(center, radius, fill);
  final stroke = _optionalStrokePaint(element);
  if (stroke != null) canvas.drawCircle(center, radius, stroke);
}

void _paintEllipse(Canvas canvas, Map<String, Object?> element) {
  final cx = _value(element, 'cx');
  final cy = _value(element, 'cy');
  final radiusX = _value(element, 'radiusX');
  final radiusY = _value(element, 'radiusY');
  final rect = Rect.fromCenter(
    center: Offset(cx, cy),
    width: radiusX * 2,
    height: radiusY * 2,
  );
  canvas.save();
  _rotateAroundBoxCenter(
    canvas,
    element,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
  );
  final fill = _fillPaint(element);
  if (fill != null) canvas.drawOval(rect, fill);
  final stroke = _optionalStrokePaint(element);
  if (stroke != null) canvas.drawOval(rect, stroke);
  canvas.restore();
}

void _paintMark(Canvas canvas, Map<String, Object?> element) {
  final x = _value(element, 'x');
  final y = _value(element, 'y');
  final width = _value(element, 'width');
  final height = _value(element, 'height');
  canvas.save();
  _rotateAroundBoxCenter(canvas, element, x, y, width, height);
  switch (element['mark']) {
    case 'orbitGlobe':
      _paintOrbitGlobe(canvas, element, x, y, width, height);
    case 'sparkle4':
      _paintSparkle(canvas, element, x, y, width, height);
  }
  canvas.restore();
}

void _paintOrbitGlobe(
  Canvas canvas,
  Map<String, Object?> element,
  double x,
  double y,
  double width,
  double height,
) {
  final paint = _optionalStrokePaint(element) ??
      (Paint()
        ..color = _templateColor(element['fill']! as String)
        ..strokeWidth = 1
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.square
        ..isAntiAlias = false);
  final cx = x + width / 2;
  final cy = y + height / 2;
  final radiusX = width / 2;
  final radiusY = height / 2;
  final outer = Rect.fromCenter(
    center: Offset(cx, cy),
    width: width,
    height: height,
  );
  canvas.drawOval(outer, paint);
  canvas.drawLine(Offset(cx, y), Offset(cx, y + height), paint);
  for (final factor in const [0.34, 0.7]) {
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(cx, cy),
        width: radiusX * factor * 2,
        height: height,
      ),
      paint,
    );
  }
  for (final factor in const [0.0, 0.45, 0.8]) {
    final dy = radiusY * factor;
    final normalized = radiusY == 0 ? 0 : dy / radiusY;
    final halfWidth =
        radiusX * math.sqrt(math.max(1 - normalized * normalized, 0));
    final signs = factor == 0 ? const [0] : const [-1, 1];
    for (final sign in signs) {
      final lineY = cy + sign * dy;
      canvas.drawLine(
        Offset(cx - halfWidth, lineY),
        Offset(cx + halfWidth, lineY),
        paint,
      );
    }
  }
}

void _paintSparkle(
  Canvas canvas,
  Map<String, Object?> element,
  double x,
  double y,
  double width,
  double height,
) {
  final cx = x + width / 2;
  final cy = y + height / 2;
  final halfWidth = width / 2;
  final halfHeight = height / 2;
  final innerX = halfWidth * 0.16;
  final innerY = halfHeight * 0.16;
  final path = Path()
    ..moveTo(cx, y)
    ..lineTo(cx + innerX, cy - innerY)
    ..lineTo(x + width, cy)
    ..lineTo(cx + innerX, cy + innerY)
    ..lineTo(cx, y + height)
    ..lineTo(cx - innerX, cy + innerY)
    ..lineTo(x, cy)
    ..lineTo(cx - innerX, cy - innerY)
    ..close();
  final fill = _fillPaint(element);
  if (fill != null) canvas.drawPath(path, fill);
  final stroke = _optionalStrokePaint(element);
  if (stroke != null) canvas.drawPath(path, stroke);
}

void _rotateAroundBoxCenter(
  Canvas canvas,
  Map<String, Object?> element,
  double x,
  double y,
  double width,
  double height,
) {
  final rotation = element['rotation'];
  if (rotation is! num || rotation == 0) return;
  final cx = x + width / 2;
  final cy = y + height / 2;
  canvas
    ..translate(cx, cy)
    ..rotate(rotation.toDouble() * math.pi / 180)
    ..translate(-cx, -cy);
}

Paint? _fillPaint(Map<String, Object?> element) {
  final fill = element['fill'];
  if (fill is! String) return null;
  return Paint()
    ..color = _templateColor(fill)
    ..style = PaintingStyle.fill
    ..isAntiAlias = false;
}

Paint _strokePaint(Map<String, Object?> element) => Paint()
  ..color = _templateColor(element['stroke']! as String)
  ..strokeWidth = _value(element, 'strokeWidth')
  ..style = PaintingStyle.stroke
  ..strokeCap = StrokeCap.square
  ..isAntiAlias = false;

Paint? _optionalStrokePaint(Map<String, Object?> element) =>
    element['stroke'] is String ? _strokePaint(element) : null;

Color _templateColor(String value) =>
    value == '#ffffff' ? const Color(0xFFFFFFFF) : const Color(0xFF000000);

double _value(Map<String, Object?> element, String key) =>
    (element[key]! as num).toDouble();

/// Rasterises a label at the preset size. The caller owns the returned image.
Future<ui.Image> renderLabelImage(
  LabelContent label, {
  LabelTemplateVersion? template,
}) async {
  final selected = template ??
      label.template ??
      await BundledLabelTemplates.defaultVersion();
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(
    recorder,
    Rect.fromLTWH(
        0, 0, labelPixelWidth.toDouble(), labelPixelHeight.toDouble()),
  );
  final retainedPainters =
      paintLabelTemplate(canvas, label, selected.definition);

  final picture = recorder.endRecording();
  try {
    return await picture.toImage(labelPixelWidth, labelPixelHeight);
  } finally {
    picture.dispose();
    for (final painter in retainedPainters) {
      painter.dispose();
    }
  }
}

/// Renders a label to PNG bytes at the preset size.
///
/// The bytes go straight into `PrintPage.addImageFromBuffer`, which is the same
/// buffer the app previously downloaded from
/// `GET /api/public/orders/[id]/label`. Nothing downstream of this function
/// changed, which is deliberate: the BLE print path is proven on hardware.
Future<Uint8List> renderLabelPng(
  LabelContent label, {
  LabelTemplateVersion? template,
}) async {
  final image = await renderLabelImage(label, template: template);
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
