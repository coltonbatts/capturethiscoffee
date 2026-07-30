import 'dart:convert';

import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_controller.dart';
import 'package:ctc_printer/label_content.dart';
import 'package:ctc_printer/label_painter.dart';
import 'package:ctc_printer/label_template.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

import 'support/board_fixture.dart';

Map<String, Object?> _definition() => {
      'schemaVersion': 1,
      'pixelWidth': 591,
      'pixelHeight': 354,
      'background': '#ffffff',
      'elements': [
        {
          'type': 'text',
          'x': 20,
          'y': 20,
          'width': 551,
          'height': 100,
          'segments': [
            {'binding': 'personName'},
          ],
          'fontSize': 72,
          'minFontSize': 24,
          'fontWeight': 'bold',
          'fontFamily': 'Arial',
          'color': '#000000',
          'align': 'left',
          'maxLines': 1,
          'lineHeight': 78,
        },
      ],
    };

LabelTemplateVersion _version() => LabelTemplateVersion.fromCacheJson({
      'id': 'version-1',
      'template_id': 'template-1',
      'template_slug': 'test-template',
      'template_name': 'Test template',
      'version': 1,
      'definition': _definition(),
      'definition_checksum': 'test-checksum',
      'legacy_fallback': false,
    });

Future<void> _loadLabelFonts() async {
  final loader = FontLoader(labelFontFamily)
    ..addFont(rootBundle.load('assets/fonts/Arial.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Arial-Bold.ttf'));
  await loader.load();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(_loadLabelFonts);

  group('template validation', () {
    test('accepts and cache-round-trips a bounded declarative definition', () {
      final version = _version();
      final restored =
          LabelTemplateVersion.fromCacheJson(version.toCacheJson());

      expect(restored.slug, 'test-template');
      expect(restored.version, 1);
      expect(restored.definition.pixelWidth, 591);
      expect(restored.definition.elements, hasLength(1));
    });

    test('rejects unknown fields and executable element types', () {
      final unknown =
          jsonDecode(jsonEncode(_definition())) as Map<String, dynamic>;
      (unknown['elements']! as List).add({
        'type': 'script',
        'source': 'print("not allowed")',
      });

      expect(
        () => LabelTemplateVersion.fromCacheJson({
          ..._version().toCacheJson(),
          'definition': unknown,
        }),
        throwsFormatException,
      );
    });

    test('rejects elements outside the exact print canvas', () {
      final outside =
          jsonDecode(jsonEncode(_definition())) as Map<String, dynamic>;
      final text = (outside['elements']! as List).first as Map<String, dynamic>;
      text['width'] = 600;

      expect(
        () => LabelTemplateVersion.fromCacheJson({
          ..._version().toCacheJson(),
          'definition': outside,
        }),
        throwsFormatException,
      );
    });

    test('rejects unbounded literal text', () {
      final oversized =
          jsonDecode(jsonEncode(_definition())) as Map<String, dynamic>;
      final text =
          (oversized['elements']! as List).first as Map<String, dynamic>;
      text['segments'] = [
        {'literal': 'A' * (maximumLabelLiteralLength + 1)},
      ];

      expect(
        () => LabelTemplateVersion.fromCacheJson({
          ..._version().toCacheJson(),
          'definition': oversized,
        }),
        throwsFormatException,
      );
    });
  });

  test('the published template snapshot survives board-cache serialization',
      () {
    final version = _version();
    final board = boardFixture(
      name: 'Template day',
      status: 'active',
      roster: const [],
    ).withLabelTemplate(version);

    final restored = ProductionBoard.tryDecode(board.encode());

    expect(restored, isNotNull);
    expect(restored!.production.labelTemplate?.cacheIdentity,
        version.cacheIdentity);
    expect(
      restored.production.labelTemplate?.definition.toJson(),
      version.definition.toJson(),
    );
  });

  test('an incompatible first-load template uses bundled grid-01', () async {
    final board = boardFixture(
      productionId: 'fallback-day',
      name: 'Fallback day',
      status: 'active',
      roster: const [],
    );
    final repository = MemoryWorkspaceRepository(
      boards: {board.production.id: board},
      fetchTemplateFailure: const FormatException('unsupported schema'),
    );
    final controller = BoardController(
      repository: repository,
      cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
      outbox: OrderMutationOutbox(
        MemoryOrderMutationOutboxRepository(),
      ),
    );
    addTearDown(controller.dispose);

    await controller.activate(
      userId: 'operator-1',
      productionId: board.production.id,
    );

    expect(
      controller.board?.production.labelTemplate?.slug,
      defaultLabelTemplateSlug,
    );
    expect(
      controller.board?.production.labelTemplate?.resolution,
      LabelTemplateResolution.incompatibleFallback,
    );
  });

  test('an incompatible refresh retains the cached last-known-good template',
      () async {
    final templates = await BundledLabelTemplates.load();
    final lastKnownGood =
        templates.firstWhere((template) => template.slug == 'orbit');
    final board = boardFixture(
      productionId: 'cached-template-day',
      name: 'Cached template day',
      status: 'active',
      roster: const [],
    );
    final cache = MemoryAuthenticatedBoardCacheRepository([
      AuthenticatedCachedBoard(
        userId: 'operator-1',
        productionId: board.production.id,
        syncedAt: DateTime.utc(2026, 7, 30),
        board: board.withLabelTemplate(lastKnownGood),
      ),
    ]);
    final repository = MemoryWorkspaceRepository(
      boards: {board.production.id: board},
      fetchTemplateFailure: const FormatException('unsupported schema'),
    );
    final controller = BoardController(
      repository: repository,
      cacheRepository: cache,
      outbox: OrderMutationOutbox(
        MemoryOrderMutationOutboxRepository(),
      ),
    );
    addTearDown(controller.dispose);

    await controller.activate(
      userId: 'operator-1',
      productionId: board.production.id,
    );

    expect(controller.board?.production.labelTemplate?.slug, 'orbit');
    expect(
      controller.board?.production.labelTemplate?.resolution,
      LabelTemplateResolution.incompatibleFallback,
    );
    expect(
      cache.records.single.board.production.labelTemplate?.cacheIdentity,
      lastKnownGood.cacheIdentity,
    );
  });

  test('all eight bundled templates validate and rasterize', () async {
    final templates = await BundledLabelTemplates.load();
    expect(templates, hasLength(8));
    expect(
      templates.map((template) => template.slug).toSet(),
      contains(defaultLabelTemplateSlug),
    );

    final content = LabelContent.fromQueue(
      orderId: 'order-a1b2c3d4',
      personName: 'Jamie Example',
      drink: 'Iced oat latte',
      group: 'Camera',
      productionName: 'Review Day',
      clientName: 'Capture This',
    );
    for (final template in templates) {
      final bytes = await renderLabelPng(content, template: template);
      final decoded = img.decodeImage(bytes);
      expect(decoded, isNotNull, reason: template.slug);
      expect(decoded!.width, labelPixelWidth, reason: template.slug);
      expect(decoded.height, labelPixelHeight, reason: template.slug);
    }
  });

  test('long grid-01 names render without clipping or overlap', () async {
    final template = await BundledLabelTemplates.defaultVersion();
    final bytes = await renderLabelPng(
      LabelContent.fromQueue(
        orderId: 'order-cameron',
        personName: 'Cameron Ellington-Smythe',
        drink: 'Iced oat latte',
        group: 'Camera',
        productionName: 'Review Day',
        clientName: 'Capture This',
      ),
      template: template,
    );
    final decoded = img.decodeImage(bytes);
    expect(decoded, isNotNull);

    // The grid-01 hero lives in y=98..208. The corrected line advance leaves
    // a visible white separator between the two ink bands instead of drawing
    // the second line through the first.
    final inkRows = <int>[];
    for (var y = 98; y < 208; y += 1) {
      var rowHasInk = false;
      for (var x = 62; x < 563; x += 1) {
        final pixel = decoded!.getPixel(x, y);
        if (pixel.r.toInt() < 96) {
          rowHasInk = true;
          break;
        }
      }
      if (rowHasInk) inkRows.add(y);
    }
    expect(inkRows, isNotEmpty);
    expect(
      [
        for (var y = inkRows.first + 1; y < inkRows.last; y += 1)
          if (!inkRows.contains(y)) y,
      ],
      isNotEmpty,
      reason: 'wrapped hero lines need a visible white separator',
    );
    expect(inkRows.first, greaterThanOrEqualTo(98));
    expect(inkRows.last, lessThan(208));
  });
}
