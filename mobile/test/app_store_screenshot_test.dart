import 'dart:io';

import 'package:ctc_printer/auth_repository.dart';
import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/label_template.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/screens/about_screen.dart';
import 'package:ctc_printer/screens/home_screen.dart';
import 'package:ctc_printer/screens/summary_screen.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:ctc_printer/supabase_config.dart';
import 'package:ctc_printer/workspace_models.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:ctc_printer/widgets/label_preview.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

const _configuration = SupabaseConfiguration(
  url: 'https://fictional-review.supabase.co',
  anonKey: 'fictional-public-review-key-not-used-for-network-access',
);

const _user = AuthSession(
  userId: 'apple-review-user',
  email: 'reviewer@example.invalid',
  isExpired: false,
);

const _productionId = 'apple-review-coffee-run';
const _scopeKey = 'user:apple-review-user';
const _goldenPrecisionTolerance = 0.0001;

class _AppStoreGoldenComparator extends LocalFileComparator {
  _AppStoreGoldenComparator(
    super.testFile, {
    required double precisionTolerance,
  })  : assert(
          precisionTolerance >= 0 && precisionTolerance <= 1,
          'precisionTolerance must be between 0 and 1',
        ),
        _precisionTolerance = precisionTolerance;

  final double _precisionTolerance;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    final passed = result.passed || result.diffPercent <= _precisionTolerance;
    if (passed) {
      result.dispose();
      return true;
    }

    final error = await generateFailureOutput(result, golden, basedir);
    result.dispose();
    throw FlutterError(error);
  }
}

File _materialIconsFont() {
  final configuredRoot = Platform.environment['FLUTTER_ROOT'];
  final flutterRoot = configuredRoot == null
      ? File(Platform.resolvedExecutable).parent.parent.parent.parent.parent
      : Directory(configuredRoot);
  return File(
    '${flutterRoot.path}/bin/cache/artifacts/material_fonts/'
    'MaterialIcons-Regular.otf',
  );
}

Future<void> _loadScreenshotFonts() async {
  final materialIcons = _materialIconsFont();
  if (!materialIcons.existsSync()) {
    throw StateError(
      'Material Icons font was not found at ${materialIcons.path}. '
      'Run flutter precache before regenerating App Store screenshots.',
    );
  }
  final materialIconBytes = await materialIcons.readAsBytes();
  await Future.wait([
    (FontLoader('Geist')
          ..addFont(rootBundle.load('assets/fonts/Geist-Variable.ttf')))
        .load(),
    (FontLoader('GeistMono')
          ..addFont(rootBundle.load('assets/fonts/GeistMono-Variable.ttf')))
        .load(),
    (FontLoader('Arial')
          ..addFont(rootBundle.load('assets/fonts/Arial.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Arial-Bold.ttf')))
        .load(),
    (FontLoader('MaterialIcons')
          ..addFont(Future.value(ByteData.sublistView(materialIconBytes))))
        .load(),
  ]);
}

final _days = [
  DaySummary(
    id: _productionId,
    name: 'Apple Review Coffee Run — Fictional',
    clientName: 'Northstar Studio',
    shootDate: DateTime(2026, 8, 3),
    status: 'active',
    total: 6,
    captured: 4,
    skipped: 1,
    printed: 1,
  ),
  DaySummary(
    id: 'planning-day',
    name: 'Harbor Lookbook — Fictional',
    clientName: 'Harbor Goods',
    shootDate: DateTime(2026, 8, 8),
    status: 'planning',
    total: 12,
    captured: 0,
    skipped: 0,
    printed: 0,
  ),
  DaySummary(
    id: 'complete-day',
    name: 'Juniper Campaign — Fictional',
    clientName: 'Juniper House',
    shootDate: DateTime(2026, 7, 22),
    status: 'complete',
    total: 9,
    captured: 8,
    skipped: 1,
    printed: 8,
  ),
];

final _board = boardFixture(
  name: 'Apple Review Coffee Run — Fictional',
  status: 'active',
  clientName: 'Northstar Studio',
  productionId: _productionId,
  roster: [
    boardEntry(
      orderId: 'order-alex',
      personName: 'Alex North',
      drink: 'Black coffee',
      group: 'Crew',
      labelPrinted: true,
      sortOrder: 1,
    ),
    boardEntry(
      orderId: 'order-cameron',
      personName: 'Cameron Ellington-Smythe',
      drink: 'Iced americano',
      group: 'Camera',
      sortOrder: 2,
    ),
    boardEntry(
      orderId: 'order-taylor',
      personName: 'Taylor Quinn',
      drink: 'Half-caf oat milk vanilla latte, extra hot',
      group: 'Production',
      sortOrder: 3,
    ),
    boardEntry(
      orderId: 'order-morgan',
      personName: 'Morgan Lee',
      drink: 'Iced decaf caramel latte with oat milk, light ice',
      group: 'Agency',
      sortOrder: 4,
    ),
    boardEntry(
      orderId: 'order-riley',
      personName: 'Riley Park',
      drink: '',
      group: 'Art',
      status: 'not_asked',
      sortOrder: 5,
    ),
    boardEntry(
      orderId: 'order-jordan',
      personName: 'Jordan Vale',
      drink: '',
      group: 'Wardrobe',
      status: 'no_order',
      sortOrder: 6,
    ),
  ],
);

final _summaryBoard = boardFixture(
  productionId: _productionId,
  name: 'Fictional Studio Launch',
  status: 'active',
  clientName: 'Northstar Picture House',
  roster: [
    boardEntry(
      orderId: 'summary-avery',
      personName: 'Avery Stone',
      drink: 'Iced oat latte',
      group: 'Camera',
      labelPrinted: true,
    ),
    boardEntry(
      orderId: 'summary-morgan',
      personName: 'Morgan Reed',
      drink: 'Iced oat latte',
      group: 'Art',
      labelPrinted: true,
      sortOrder: 1,
    ),
    boardEntry(
      orderId: 'summary-riley',
      personName: 'Riley North',
      drink: '',
      group: 'Set',
      status: 'no_order',
      sortOrder: 2,
    ),
  ],
);

late ProductionBoard _templateBoard;

final _conflictedOrder = _board.orderById('order-cameron')!;

OrderMutationRecord _conflictRecord() => OrderMutationRecord(
      scopeKey: _scopeKey,
      productionId: _productionId,
      orderId: _conflictedOrder.id,
      personId: 'person-order-cameron',
      personName: 'Cameron Ellington-Smythe',
      drink: 'Oat cappuccino',
      createdAt: DateTime.utc(2026, 7, 27, 18),
      observedUpdatedAt: _conflictedOrder.updatedAt,
      baseValues: OrderPatch.snapshot(_conflictedOrder),
      patch: OrderPatch({OrderField.drinkType: 'Oat cappuccino'}),
      updateUsualOrder: false,
      observedUsualOrder: '',
      desiredUsualOrder: '',
      orderApplied: false,
      conflict: OrderMutationConflict(
        kind: OrderMutationConflictKind.order,
        message:
            'This order changed on another device. Choose which version to keep.',
        serverOrder: _conflictedOrder.copyWith(
          drinkType: 'Iced americano, light ice',
          updatedAt: '2026-07-27T18:01:00.000Z',
        ),
      ),
      printState: null,
    );

OrderMutationRecord _uncertainPrintRecord() => OrderMutationRecord(
      scopeKey: _scopeKey,
      productionId: _productionId,
      orderId: 'order-cameron',
      personId: 'person-order-cameron',
      personName: 'Cameron Ellington-Smythe',
      drink: 'Iced americano',
      createdAt: DateTime.utc(2026, 7, 27, 18, 2),
      observedUpdatedAt: _conflictedOrder.updatedAt,
      baseValues: const {},
      patch: null,
      updateUsualOrder: false,
      observedUsualOrder: '',
      desiredUsualOrder: '',
      orderApplied: false,
      conflict: null,
      printState: PrintRecoveryState.uncertain,
    );

PrinterApp _signInApp() => PrinterApp(
      configuration: _configuration,
      authRepository: MemoryAuthRepository(),
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      legacyTestMode: false,
    );

PrinterApp _authenticatedApp({
  bool selected = true,
  bool offline = false,
  List<OrderMutationRecord> mutations = const [],
  ProductionBoard? board,
}) {
  final selectedBoard = board ?? _board;
  final repository = MemoryWorkspaceRepository(
    days: _days,
    boards: {_productionId: selectedBoard},
    fetchDaysFailure: offline
        ? const WorkspaceRepositoryException(
            'Could not reach the workspace.',
            kind: WorkspaceFailureKind.unreachable,
          )
        : null,
    fetchBoardFailure: offline
        ? const WorkspaceRepositoryException(
            'Could not reach the workspace.',
            kind: WorkspaceFailureKind.unreachable,
          )
        : null,
  );
  final cache = MemoryAuthenticatedBoardCacheRepository(
    selected
        ? [
            AuthenticatedCachedBoard(
              userId: _user.userId,
              productionId: _productionId,
              syncedAt: DateTime.now().subtract(const Duration(minutes: 42)),
              board: selectedBoard,
            ),
          ]
        : const [],
  );
  return PrinterApp(
    configuration: _configuration,
    authRepository: MemoryAuthRepository(restoredSession: _user),
    workspaceRepository: repository,
    authenticatedBoardCacheRepository: cache,
    selectedDayRepository: MemorySelectedDayRepository(
      selected ? {_user.userId: _productionId} : const {},
    ),
    orderMutationOutboxRepository:
        MemoryOrderMutationOutboxRepository(mutations),
    sessionRepository: MemorySessionRepository(),
    boardCacheRepository: MemoryBoardCacheRepository(),
    legacyTestMode: false,
  );
}

Future<void> _capture(
  WidgetTester tester, {
  required Widget app,
  required String golden,
  Future<void> Function(WidgetTester tester)? navigate,
}) async {
  tester.view.devicePixelRatio = 3;
  tester.view.physicalSize = const Size(1320, 2868);
  addTearDown(tester.view.reset);

  const boundaryKey = Key('app-store-screenshot-boundary');
  await tester.pumpWidget(
    RepaintBoundary(key: boundaryKey, child: app),
  );
  await tester.pumpAndSettle();
  if (navigate != null) {
    await navigate(tester);
    await tester.pumpAndSettle();
  }

  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(boundaryKey),
  );
  final image = await boundary.toImage(pixelRatio: 3);
  addTearDown(image.dispose);
  expect(image.width, 1320);
  expect(image.height, 2868);
  await expectLater(
    image,
    matchesGoldenFile('goldens/app-store/$golden'),
  );
}

Future<void> _openHomeRoute(WidgetTester tester, Key key) async {
  final target = find.byKey(key);
  await tester.scrollUntilVisible(
    target,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
  await tester.tap(target);
}

Future<void> _openPrintDeck(WidgetTester tester) async {
  await _openHomeRoute(tester, printEntryKey);
  final previewImage = find.descendant(
    of: find.byType(LabelPreview),
    matching: find.byType(RawImage),
  );
  for (var attempt = 0;
      attempt < 50 && previewImage.evaluate().isEmpty;
      attempt += 1) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 10)),
    );
    await tester.pump();
  }
  expect(
    previewImage,
    findsOneWidget,
    reason: 'The App Store print screenshot must show the rendered label.',
  );
}

Future<void> _openAbout(WidgetTester tester) async {
  final navigator = tester.state<NavigatorState>(find.byType(Navigator).first);
  navigator.pushNamed(AboutScreen.route);
}

Future<void> _openSummary(WidgetTester tester) async {
  final navigator = tester.state<NavigatorState>(find.byType(Navigator).first);
  navigator.pushNamed(SummaryScreen.route);
}

Future<void> _showTemplateControls(WidgetTester tester) async {
  await tester.scrollUntilVisible(
    find.byKey(templateEntryKey),
    300,
    scrollable: find.byType(Scrollable).first,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late GoldenFileComparator previousGoldenFileComparator;
  setUpAll(() async {
    await _loadScreenshotFonts();
    _templateBoard = _board.withLabelTemplate(
      (await BundledLabelTemplates.defaultVersion())
          .withResolution(LabelTemplateResolution.current),
    );
    previousGoldenFileComparator = goldenFileComparator;
    goldenFileComparator = _AppStoreGoldenComparator(
      Uri.parse('test/app_store_screenshot_test.dart'),
      precisionTolerance: _goldenPrecisionTolerance,
    );
  });
  tearDownAll(() {
    goldenFileComparator = previousGoldenFileComparator;
  });

  testWidgets(
    'App Store screenshot — invited account sign in',
    (tester) => _capture(
      tester,
      app: _signInApp(),
      golden: '01-invited-account-sign-in.png',
    ),
    tags: 'golden',
  );

  testWidgets(
    'App Store screenshot — existing day selection',
    (tester) => _capture(
      tester,
      app: _authenticatedApp(selected: false),
      golden: '02-existing-days.png',
    ),
    tags: 'golden',
  );

  testWidgets(
    'App Store screenshot — collect orders',
    (tester) => _capture(
      tester,
      app: _authenticatedApp(),
      golden: '03-collect-orders.png',
      navigate: (tester) => _openHomeRoute(tester, collectEntryKey),
    ),
    tags: 'golden',
  );

  testWidgets(
    'App Store screenshot — individual print deck and preview',
    (tester) => _capture(
      tester,
      app: _authenticatedApp(offline: true),
      golden: '04-individual-print-deck.png',
      navigate: _openPrintDeck,
    ),
    tags: 'golden',
  );

  testWidgets(
    'App Store screenshot — offline conflict protection',
    (tester) => _capture(
      tester,
      app: _authenticatedApp(
        offline: true,
        mutations: [_conflictRecord()],
      ),
      golden: '05-offline-conflict.png',
      navigate: (tester) => _openHomeRoute(tester, collectEntryKey),
    ),
    tags: 'golden',
  );

  testWidgets(
    'App Store screenshot — duplicate-safe print recovery',
    (tester) => _capture(
      tester,
      app: _authenticatedApp(
        offline: true,
        mutations: [_uncertainPrintRecord()],
      ),
      golden: '06-duplicate-safe-recovery.png',
      navigate: (tester) => _openHomeRoute(tester, recoveryEntryKey),
    ),
    tags: 'golden',
  );

  testWidgets(
    'App Store screenshot — About and release identity',
    (tester) => _capture(
      tester,
      app: _authenticatedApp(),
      golden: '07-about-release.png',
      navigate: _openAbout,
    ),
    tags: 'golden',
  );

  testWidgets(
    'App Store screenshot — grouped summary and guarded closeout',
    (tester) => _capture(
      tester,
      app: _authenticatedApp(board: _summaryBoard),
      golden: '08-summary-closeout.png',
      navigate: _openSummary,
    ),
    tags: 'golden',
  );

  testWidgets(
    'App Store screenshot — published template and safe test label',
    (tester) => _capture(
      tester,
      app: _authenticatedApp(board: _templateBoard),
      golden: '09-template-test-label.png',
      navigate: _showTemplateControls,
    ),
    tags: 'golden',
  );
}
