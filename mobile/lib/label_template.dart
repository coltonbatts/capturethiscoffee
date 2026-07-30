import 'dart:convert';

import 'package:flutter/services.dart';

const int labelTemplatePixelWidth = 591;
const int labelTemplatePixelHeight = 354;
const int maximumLabelTemplateBytes = 64 * 1024;
const int maximumLabelTemplateElements = 96;
const int maximumLabelTextSegments = 8;
const int maximumLabelLiteralLength = 256;

const bundledLabelTemplateCatalogAsset =
    'assets/label_templates/label-templates-v1.json';
const defaultLabelTemplateSlug = 'grid-01';

const labelTemplateBindings = {
  'personName',
  'drink',
  'productionName',
  'clientName',
  'productionClient',
  'group',
  'orderNumber',
};

const _colors = {'#000000', '#ffffff'};
const _fontWeights = {'regular', 'bold'};
const _textAlignments = {'left', 'center', 'right'};
const _marks = {'orbitGlobe', 'sparkle4'};
final _slugPattern = RegExp(r'^[a-z][a-z0-9-]{1,47}$');
final _checksumPattern = RegExp(r'^[a-f0-9]{64}$');

enum LabelTemplateResolution {
  current,
  historicalFallback,
  cachedFallback,
  unavailableFallback,
  incompatibleFallback,
}

/// A validated, published template snapshot.
///
/// Production boards cache this whole value instead of only the database ID.
/// Printing therefore remains deterministic offline, even if the workspace
/// default changes later. Nothing in this model is executable: the definition
/// is a strict, bounded list of drawing primitives consumed by
/// `label_painter.dart`.
class LabelTemplateVersion {
  LabelTemplateVersion._({
    required this.id,
    required this.templateId,
    required this.slug,
    required this.name,
    required this.version,
    required this.definitionChecksum,
    required this.definition,
    required this.legacyFallback,
    required this.resolution,
  });

  final String id;
  final String templateId;
  final String slug;
  final String name;
  final int version;
  final String definitionChecksum;
  final LabelTemplateDefinition definition;
  final bool legacyFallback;
  final LabelTemplateResolution resolution;

  factory LabelTemplateVersion.fromResolvedJson(Object? value) {
    final json = _stringMap(value, 'resolved label template');
    _expectKeys(
      json,
      required: const {
        'production_id',
        'id',
        'template_id',
        'template_slug',
        'template_name',
        'version',
        'definition',
        'definition_checksum',
        'legacy_fallback',
      },
    );
    _requiredString(json, 'production_id', maximumLength: 128);
    final checksum = _requiredString(
      json,
      'definition_checksum',
      maximumLength: 64,
    );
    if (!_checksumPattern.hasMatch(checksum)) {
      throw const FormatException('Invalid label template checksum.');
    }
    final legacyFallback = _boolean(json, 'legacy_fallback');
    return LabelTemplateVersion._(
      id: _requiredString(json, 'id', maximumLength: 128),
      templateId: _requiredString(json, 'template_id', maximumLength: 128),
      slug: _slug(json, 'template_slug'),
      name: _requiredString(json, 'template_name', maximumLength: 100),
      version: _integer(json, 'version', minimum: 1, maximum: 1000000),
      definitionChecksum: checksum,
      definition: LabelTemplateDefinition.fromJson(json['definition']),
      legacyFallback: legacyFallback,
      resolution: legacyFallback
          ? LabelTemplateResolution.historicalFallback
          : LabelTemplateResolution.current,
    );
  }

  factory LabelTemplateVersion.fromCacheJson(Object? value) {
    final json = _stringMap(value, 'cached label template');
    _expectKeys(
      json,
      required: const {
        'id',
        'template_id',
        'template_slug',
        'template_name',
        'version',
        'definition',
        'definition_checksum',
        'legacy_fallback',
      },
      optional: const {'resolution_status'},
    );
    final legacyFallback = _boolean(json, 'legacy_fallback');
    return LabelTemplateVersion._(
      id: _requiredString(json, 'id', maximumLength: 128),
      templateId: _requiredString(json, 'template_id', maximumLength: 128),
      slug: _slug(json, 'template_slug'),
      name: _requiredString(json, 'template_name', maximumLength: 100),
      version: _integer(json, 'version', minimum: 1, maximum: 1000000),
      definitionChecksum: _requiredString(
        json,
        'definition_checksum',
        maximumLength: 128,
      ),
      definition: LabelTemplateDefinition.fromJson(json['definition']),
      legacyFallback: legacyFallback,
      resolution: _resolution(
        json['resolution_status'],
        fallback: legacyFallback
            ? LabelTemplateResolution.historicalFallback
            : LabelTemplateResolution.current,
      ),
    );
  }

  factory LabelTemplateVersion.fromCatalogEntry(Object? value) {
    final json = _stringMap(value, 'bundled label template');
    _expectKeys(
      json,
      required: const {'id', 'name', 'summary', 'version', 'definition'},
    );
    final slug = _slug(json, 'id');
    final version = _integer(json, 'version', minimum: 1, maximum: 1000000);
    _requiredString(json, 'summary', maximumLength: 500);
    return LabelTemplateVersion._(
      id: 'bundled:$slug:v$version',
      templateId: 'bundled:$slug',
      slug: slug,
      name: _requiredString(json, 'name', maximumLength: 100),
      version: version,
      definitionChecksum: 'bundled:$slug:v$version',
      definition: LabelTemplateDefinition.fromJson(json['definition']),
      legacyFallback: slug == defaultLabelTemplateSlug,
      resolution: LabelTemplateResolution.historicalFallback,
    );
  }

  LabelTemplateVersion withResolution(LabelTemplateResolution value) =>
      LabelTemplateVersion._(
        id: id,
        templateId: templateId,
        slug: slug,
        name: name,
        version: version,
        definitionChecksum: definitionChecksum,
        definition: definition,
        legacyFallback: legacyFallback,
        resolution: value,
      );

  Map<String, Object?> toCacheJson() => {
        'id': id,
        'template_id': templateId,
        'template_slug': slug,
        'template_name': name,
        'version': version,
        'definition': definition.toJson(),
        'definition_checksum': definitionChecksum,
        'legacy_fallback': legacyFallback,
        'resolution_status': resolution.name,
      };

  String get cacheIdentity => '$id:$definitionChecksum';
}

/// The exact declarative surface accepted by both the app and website.
class LabelTemplateDefinition {
  LabelTemplateDefinition._({
    required this.schemaVersion,
    required this.pixelWidth,
    required this.pixelHeight,
    required this.background,
    required this.elements,
  });

  final int schemaVersion;
  final int pixelWidth;
  final int pixelHeight;
  final String background;
  final List<Map<String, Object?>> elements;

  factory LabelTemplateDefinition.fromJson(Object? value) {
    final encoded = utf8.encode(jsonEncode(value));
    if (encoded.length > maximumLabelTemplateBytes) {
      throw const FormatException('Label template definition is too large.');
    }
    final json = _stringMap(value, 'label template definition');
    _expectKeys(
      json,
      required: const {
        'schemaVersion',
        'pixelWidth',
        'pixelHeight',
        'background',
        'elements',
      },
    );
    final schemaVersion =
        _integer(json, 'schemaVersion', minimum: 1, maximum: 1);
    final pixelWidth = _integer(json, 'pixelWidth', minimum: 1, maximum: 10000);
    final pixelHeight =
        _integer(json, 'pixelHeight', minimum: 1, maximum: 10000);
    if (pixelWidth != labelTemplatePixelWidth ||
        pixelHeight != labelTemplatePixelHeight) {
      throw const FormatException(
        'Label template must be exactly 591x354 pixels.',
      );
    }
    final background = _color(json, 'background');
    final rawElements = json['elements'];
    if (rawElements is! List ||
        rawElements.isEmpty ||
        rawElements.length > maximumLabelTemplateElements) {
      throw const FormatException('Invalid label template element count.');
    }
    final elements = <Map<String, Object?>>[
      for (final value in rawElements) _validatedElement(value),
    ];
    return LabelTemplateDefinition._(
      schemaVersion: schemaVersion,
      pixelWidth: pixelWidth,
      pixelHeight: pixelHeight,
      background: background,
      elements: List.unmodifiable(elements),
    );
  }

  Map<String, Object?> toJson() => {
        'schemaVersion': schemaVersion,
        'pixelWidth': pixelWidth,
        'pixelHeight': pixelHeight,
        'background': background,
        'elements': elements,
      };
}

/// Loads and validates the release-bundled catalog.
///
/// A missing database assignment (the historical production case) resolves to
/// bundled `grid-01`. The future is cached so a print never reparses a template
/// per label.
class BundledLabelTemplates {
  BundledLabelTemplates._();

  static Future<List<LabelTemplateVersion>>? _catalog;

  static Future<List<LabelTemplateVersion>> load() =>
      _catalog ??= _loadCatalog();

  static Future<LabelTemplateVersion> defaultVersion() async {
    final templates = await load();
    return templates.firstWhere(
      (template) => template.slug == defaultLabelTemplateSlug,
      orElse: () => throw const FormatException(
        'Bundled grid-01 label template is missing.',
      ),
    );
  }

  static Future<List<LabelTemplateVersion>> _loadCatalog() async {
    final raw = await rootBundle.loadString(bundledLabelTemplateCatalogAsset);
    if (utf8.encode(raw).length > maximumLabelTemplateBytes * 8) {
      throw const FormatException(
          'Bundled label template catalog is too large.');
    }
    final json = _stringMap(jsonDecode(raw), 'label template catalog');
    _expectKeys(
      json,
      required: const {
        'schemaVersion',
        'pixelWidth',
        'pixelHeight',
        'templates',
      },
    );
    _integer(json, 'schemaVersion', minimum: 1, maximum: 1);
    if (_integer(json, 'pixelWidth', minimum: 1, maximum: 10000) !=
            labelTemplatePixelWidth ||
        _integer(json, 'pixelHeight', minimum: 1, maximum: 10000) !=
            labelTemplatePixelHeight) {
      throw const FormatException(
        'Bundled label template catalog must be exactly 591x354 pixels.',
      );
    }
    final values = json['templates'];
    if (values is! List || values.length != 8) {
      throw const FormatException(
        'Bundled label template catalog must contain eight templates.',
      );
    }
    final templates = values
        .map(LabelTemplateVersion.fromCatalogEntry)
        .toList(growable: false);
    if (templates.map((template) => template.slug).toSet().length !=
        templates.length) {
      throw const FormatException('Bundled label template IDs must be unique.');
    }
    if (!templates.any((item) => item.slug == defaultLabelTemplateSlug)) {
      throw const FormatException(
        'Bundled grid-01 label template is missing.',
      );
    }
    return List.unmodifiable(templates);
  }
}

Map<String, Object?> _validatedElement(Object? value) {
  final json = _stringMap(value, 'label template element');
  final type = _requiredString(json, 'type', maximumLength: 24);
  switch (type) {
    case 'text':
      _expectKeys(
        json,
        required: const {
          'type',
          'x',
          'y',
          'width',
          'height',
          'segments',
          'fontSize',
          'minFontSize',
          'fontWeight',
          'fontFamily',
          'color',
          'align',
          'maxLines',
          'lineHeight',
        },
        optional: const {'uppercase', 'rotation'},
      );
      final x =
          _number(json, 'x', minimum: 0, maximum: labelTemplatePixelWidth);
      final y =
          _number(json, 'y', minimum: 0, maximum: labelTemplatePixelHeight);
      final width = _number(json, 'width',
          minimum: 0.01, maximum: labelTemplatePixelWidth);
      final height = _number(
        json,
        'height',
        minimum: 0.01,
        maximum: labelTemplatePixelHeight,
      );
      _insideBox(x, y, width, height);
      final segments = json['segments'];
      if (segments is! List ||
          segments.isEmpty ||
          segments.length > maximumLabelTextSegments) {
        throw const FormatException('Invalid label text segments.');
      }
      for (final segmentValue in segments) {
        final segment = _stringMap(segmentValue, 'label text segment');
        _expectKeys(
          segment,
          optional: const {'literal', 'binding'},
        );
        if (segment.length != 1) {
          throw const FormatException(
            'A label text segment needs one literal or binding.',
          );
        }
        if (segment.containsKey('literal')) {
          _optionalString(
            segment,
            'literal',
            maximumLength: maximumLabelLiteralLength,
          );
        } else {
          final binding =
              _requiredString(segment, 'binding', maximumLength: 40);
          if (!labelTemplateBindings.contains(binding)) {
            throw const FormatException('Invalid label text binding.');
          }
        }
      }
      final fontSize = _number(json, 'fontSize', minimum: 6, maximum: 128);
      final minFontSize =
          _number(json, 'minFontSize', minimum: 6, maximum: 128);
      if (minFontSize > fontSize) {
        throw const FormatException(
          'Label minFontSize cannot exceed fontSize.',
        );
      }
      if (_requiredString(json, 'fontFamily', maximumLength: 20) != 'Arial') {
        throw const FormatException('Only the Arial label font is supported.');
      }
      _oneOf(json, 'fontWeight', _fontWeights);
      _color(json, 'color');
      _oneOf(json, 'align', _textAlignments);
      _integer(json, 'maxLines', minimum: 1, maximum: 4);
      final lineHeight = _number(json, 'lineHeight', minimum: 6, maximum: 128);
      if (lineHeight < fontSize) {
        throw const FormatException(
          'Label lineHeight cannot be smaller than fontSize.',
        );
      }
      _optionalBoolean(json, 'uppercase');
      _optionalRotation(json);
      break;
    case 'line':
      _expectKeys(
        json,
        required: const {
          'type',
          'x1',
          'y1',
          'x2',
          'y2',
          'stroke',
          'strokeWidth',
        },
      );
      _number(json, 'x1', minimum: 0, maximum: labelTemplatePixelWidth);
      _number(json, 'y1', minimum: 0, maximum: labelTemplatePixelHeight);
      _number(json, 'x2', minimum: 0, maximum: labelTemplatePixelWidth);
      _number(json, 'y2', minimum: 0, maximum: labelTemplatePixelHeight);
      _color(json, 'stroke');
      _strokeWidth(json);
      break;
    case 'rect':
      _validateShape(
        json,
        required: const {'type', 'x', 'y', 'width', 'height'},
        optional: const {'fill', 'stroke', 'strokeWidth', 'rotation'},
      );
      break;
    case 'roundedRect':
      _validateShape(
        json,
        required: const {'type', 'x', 'y', 'width', 'height', 'radius'},
        optional: const {'fill', 'stroke', 'strokeWidth', 'rotation'},
      );
      final radius = _number(
        json,
        'radius',
        minimum: 0,
        maximum: labelTemplatePixelHeight,
      );
      final maximumRadius = _numberValue(json['width'], 'width') / 2 <
              _numberValue(json['height'], 'height') / 2
          ? _numberValue(json['width'], 'width') / 2
          : _numberValue(json['height'], 'height') / 2;
      if (radius > maximumRadius) {
        throw const FormatException('Rounded rectangle radius is too large.');
      }
      break;
    case 'circle':
      _expectKeys(
        json,
        required: const {'type', 'cx', 'cy', 'radius'},
        optional: const {'fill', 'stroke', 'strokeWidth', 'rotation'},
      );
      final cx =
          _number(json, 'cx', minimum: 0, maximum: labelTemplatePixelWidth);
      final cy =
          _number(json, 'cy', minimum: 0, maximum: labelTemplatePixelHeight);
      final radius = _number(
        json,
        'radius',
        minimum: 0.01,
        maximum: labelTemplatePixelHeight,
      );
      _insideEllipse(cx, cy, radius, radius);
      _validateFillAndStroke(json);
      _optionalRotation(json);
      break;
    case 'ellipse':
      _expectKeys(
        json,
        required: const {'type', 'cx', 'cy', 'radiusX', 'radiusY'},
        optional: const {'fill', 'stroke', 'strokeWidth', 'rotation'},
      );
      final cx =
          _number(json, 'cx', minimum: 0, maximum: labelTemplatePixelWidth);
      final cy =
          _number(json, 'cy', minimum: 0, maximum: labelTemplatePixelHeight);
      final radiusX = _number(
        json,
        'radiusX',
        minimum: 0.01,
        maximum: labelTemplatePixelWidth,
      );
      final radiusY = _number(
        json,
        'radiusY',
        minimum: 0.01,
        maximum: labelTemplatePixelHeight,
      );
      _insideEllipse(cx, cy, radiusX, radiusY);
      _validateFillAndStroke(json);
      _optionalRotation(json);
      break;
    case 'mark':
      _expectKeys(
        json,
        required: const {
          'type',
          'mark',
          'x',
          'y',
          'width',
          'height',
        },
        optional: const {'fill', 'stroke', 'strokeWidth', 'rotation'},
      );
      _oneOf(json, 'mark', _marks);
      final x =
          _number(json, 'x', minimum: 0, maximum: labelTemplatePixelWidth);
      final y =
          _number(json, 'y', minimum: 0, maximum: labelTemplatePixelHeight);
      final width = _number(json, 'width',
          minimum: 0.01, maximum: labelTemplatePixelWidth);
      final height = _number(
        json,
        'height',
        minimum: 0.01,
        maximum: labelTemplatePixelHeight,
      );
      _insideBox(x, y, width, height);
      _validateFillAndStroke(json);
      _optionalRotation(json);
      break;
    default:
      throw const FormatException('Unsupported label template element.');
  }
  return Map.unmodifiable(json);
}

void _validateShape(
  Map<String, Object?> json, {
  required Set<String> required,
  required Set<String> optional,
}) {
  _expectKeys(json, required: required, optional: optional);
  final x = _number(json, 'x', minimum: 0, maximum: labelTemplatePixelWidth);
  final y = _number(json, 'y', minimum: 0, maximum: labelTemplatePixelHeight);
  final width =
      _number(json, 'width', minimum: 0.01, maximum: labelTemplatePixelWidth);
  final height =
      _number(json, 'height', minimum: 0.01, maximum: labelTemplatePixelHeight);
  _insideBox(x, y, width, height);
  _validateFillAndStroke(json);
  _optionalRotation(json);
}

void _validateFillAndStroke(Map<String, Object?> json) {
  final hasFill = json['fill'] != null;
  final hasStroke = json['stroke'] != null;
  if (!hasFill && !hasStroke) {
    throw const FormatException('A label shape needs fill or stroke.');
  }
  if (hasFill) _color(json, 'fill');
  if (hasStroke) {
    _color(json, 'stroke');
    _strokeWidth(json);
  } else if (json.containsKey('strokeWidth')) {
    throw const FormatException('strokeWidth requires stroke.');
  }
}

void _insideBox(double x, double y, double width, double height) {
  if (x + width > labelTemplatePixelWidth ||
      y + height > labelTemplatePixelHeight) {
    throw const FormatException('Label element extends beyond the canvas.');
  }
}

void _insideEllipse(
  double cx,
  double cy,
  double radiusX,
  double radiusY,
) {
  if (cx - radiusX < 0 ||
      cx + radiusX > labelTemplatePixelWidth ||
      cy - radiusY < 0 ||
      cy + radiusY > labelTemplatePixelHeight) {
    throw const FormatException('Label ellipse extends beyond the canvas.');
  }
}

void _strokeWidth(Map<String, Object?> json) {
  _number(json, 'strokeWidth', minimum: 0.01, maximum: 12);
}

void _optionalRotation(Map<String, Object?> json) {
  if (json.containsKey('rotation')) {
    _number(json, 'rotation', minimum: -360, maximum: 360);
  }
}

Map<String, Object?> _stringMap(Object? value, String name) {
  if (value is! Map) throw FormatException('Invalid $name.');
  final result = <String, Object?>{};
  for (final entry in value.entries) {
    if (entry.key is! String) throw FormatException('Invalid $name key.');
    result[entry.key as String] = entry.value;
  }
  return result;
}

void _expectKeys(
  Map<String, Object?> json, {
  Set<String> required = const {},
  Set<String> optional = const {},
}) {
  for (final key in required) {
    if (!json.containsKey(key)) {
      throw FormatException('Missing label template field: $key.');
    }
  }
  final allowed = {...required, ...optional};
  for (final key in json.keys) {
    if (!allowed.contains(key)) {
      throw FormatException('Unknown label template field: $key.');
    }
  }
}

String _requiredString(
  Map<String, Object?> json,
  String key, {
  required int maximumLength,
}) {
  final value = json[key];
  if (value is! String ||
      value.trim().isEmpty ||
      value.length > maximumLength) {
    throw FormatException('Invalid label template $key.');
  }
  return value;
}

String _optionalString(
  Map<String, Object?> json,
  String key, {
  required int maximumLength,
}) {
  final value = json[key];
  if (value is! String || value.length > maximumLength) {
    throw FormatException('Invalid label template $key.');
  }
  return value;
}

String _slug(Map<String, Object?> json, String key) {
  final value = _requiredString(json, key, maximumLength: 48);
  if (!_slugPattern.hasMatch(value)) {
    throw FormatException('Invalid label template $key.');
  }
  return value;
}

String _color(Map<String, Object?> json, String key) {
  final value = _requiredString(json, key, maximumLength: 7);
  if (!_colors.contains(value)) {
    throw FormatException('Invalid label template $key.');
  }
  return value;
}

String _oneOf(
  Map<String, Object?> json,
  String key,
  Set<String> values,
) {
  final value = _requiredString(json, key, maximumLength: 40);
  if (!values.contains(value)) {
    throw FormatException('Invalid label template $key.');
  }
  return value;
}

bool _boolean(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! bool) throw FormatException('Invalid label template $key.');
  return value;
}

void _optionalBoolean(Map<String, Object?> json, String key) {
  if (json.containsKey(key)) _boolean(json, key);
}

LabelTemplateResolution _resolution(
  Object? value, {
  required LabelTemplateResolution fallback,
}) {
  if (value == null) return fallback;
  if (value is! String) {
    throw const FormatException('Invalid label template resolution status.');
  }
  for (final status in LabelTemplateResolution.values) {
    if (status.name == value) return status;
  }
  throw const FormatException('Invalid label template resolution status.');
}

int _integer(
  Map<String, Object?> json,
  String key, {
  required int minimum,
  required int maximum,
}) {
  final value = json[key];
  if (value is! num || !value.isFinite || value != value.roundToDouble()) {
    throw FormatException('Invalid label template $key.');
  }
  final integer = value.toInt();
  if (integer < minimum || integer > maximum) {
    throw FormatException('Invalid label template $key.');
  }
  return integer;
}

double _number(
  Map<String, Object?> json,
  String key, {
  required num minimum,
  required num maximum,
}) {
  final value = _numberValue(json[key], key);
  if (value < minimum.toDouble() || value > maximum.toDouble()) {
    throw FormatException('Invalid label template $key.');
  }
  return value;
}

double _numberValue(Object? value, String key) {
  if (value is! num || !value.isFinite) {
    throw FormatException('Invalid label template $key.');
  }
  return value.toDouble();
}
