// The Phase B deliverable: a cold start with no signal is usable.
//
// Before the cache existed, the Keychain kept the session but the roster lived
// only in memory, so launching without a signal showed an empty app holding a
// printer it could not feed. These tests cover that exact sequence.

import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/ctc_api.dart';
import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/printer_controller.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/screens/home_screen.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

const _session = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'production-1',
  token: 'fixture-token',
);

/// Every request fails the way a dead zone fails.
class _OfflineApi extends CtcApi {
  _OfflineApi(super.session);

  @override
  Future<ProductionBoard> fetchBoard() async => throw const CtcApiException(
        'No connection. Check Wi-Fi or signal.',
        kind: CtcApiErrorKind.unreachable,
      );

  @override
  void close() {}
}

/// The server answers, and refuses — a day marked complete drops out of the
/// readable statuses and its board 404s.
class _GoneApi extends CtcApi {
  _GoneApi(super.session);

  @override
  Future<ProductionBoard> fetchBoard() async => throw const CtcApiException(
        'This production or label is no longer available.',
        kind: CtcApiErrorKind.gone,
      );

  @override
  void close() {}
}

class _OnlineApi extends CtcApi {
  _OnlineApi(super.session, this.board);

  final ProductionBoard board;
  int fetchCount = 0;

  @override
  Future<ProductionBoard> fetchBoard() async {
    fetchCount += 1;
    return board;
  }

  @override
  void close() {}
}

ProductionBoard _board({String name = 'Review Day', String status = 'active'}) =>
    boardFixture(
      name: name,
      status: status,
      productionId: _session.productionId,
      roster: [
        boardEntry(
          orderId: 'order-1',
          personName: 'Jamie Example',
          drink: 'Iced oat latte',
          group: 'Crew',
          sortOrder: 1,
        ),
        boardEntry(
          orderId: 'order-2',
          personName: 'Sam Okafor',
          drink: 'Flat white',
          group: 'Camera',
          sortOrder: 2,
        ),
      ],
    );

CachedBoard _cachedBoard({
  required Duration age,
  ProductionBoard? board,
  String productionId = 'production-1',
}) =>
    CachedBoard(
      apiBase: _session.apiBase,
      productionId: productionId,
      syncedAt: DateTime.now().subtract(age),
      board: board ?? _board(),
    );

Future<void> _pumpApp(
  WidgetTester tester, {
  required BoardCacheRepository cache,
  required CtcApiFactory apiFactory,
}) async {
  // Tall enough that the label list is built. The queue sits below the summary
  // card, and a lazy list off the default 800x600 viewport never renders.
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(440, 1400);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(PrinterApp(
    sessionRepository: MemorySessionRepository(_session),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
    boardCacheRepository: cache,
    apiFactory: apiFactory,
  ));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('a cold start with no signal shows the cached roster',
      (tester) async {
    await _pumpApp(
      tester,
      cache: MemoryBoardCacheRepository(
        _cachedBoard(age: const Duration(minutes: 45)),
      ),
      apiFactory: _OfflineApi.new,
    );

    // Home knows the day without a network call.
    expect(find.text('Review Day'), findsOneWidget);

    // And the crew survived with it. This is the assertion that matters: the
    // session lives in the Keychain, but the roster only exists on disk, and
    // without it a cold start on a stage with no signal is an empty app.
    await tester.tap(find.byKey(rosterEntryKey));
    await tester.pumpAndSettle();

    expect(find.textContaining('Jamie Example'), findsWidgets);
    expect(find.textContaining('Iced oat latte'), findsWidgets);
    expect(find.textContaining('Sam Okafor'), findsWidgets);
    expect(find.textContaining('Flat white'), findsWidgets);
  });

  testWidgets('a stale cached roster says so loudly', (tester) async {
    await _pumpApp(
      tester,
      cache: MemoryBoardCacheRepository(
        _cachedBoard(age: const Duration(minutes: 45)),
      ),
      apiFactory: _OfflineApi.new,
    );

    // The dangerous case is a normal-looking roster that quietly predates
    // someone changing their order.
    expect(find.text('Working offline'), findsOneWidget);
    expect(find.textContaining('45 min ago'), findsWidgets);
  });

  testWidgets('a freshly cached roster does not shout', (tester) async {
    await _pumpApp(
      tester,
      cache: MemoryBoardCacheRepository(
        _cachedBoard(age: const Duration(minutes: 2)),
      ),
      apiFactory: _OfflineApi.new,
    );

    expect(find.text('Review Day'), findsOneWidget);
    expect(find.text('Working offline'), findsNothing);
    expect(find.textContaining('Offline · synced 2 min ago'), findsOneWidget);
  });

  testWidgets('a cold start with no cache and no signal stays empty',
      (tester) async {
    await _pumpApp(
      tester,
      cache: MemoryBoardCacheRepository(),
      apiFactory: _OfflineApi.new,
    );

    expect(find.text('Review Day'), findsNothing);
    expect(find.textContaining('Not synced yet'), findsOneWidget);
  });

  testWidgets('a cache from another production is ignored', (tester) async {
    // Showing yesterday's roster under today's production name would be worse
    // than showing nothing.
    await _pumpApp(
      tester,
      cache: MemoryBoardCacheRepository(_cachedBoard(
        age: const Duration(minutes: 5),
        productionId: 'a-different-production',
      )),
      apiFactory: _OfflineApi.new,
    );

    expect(find.text('Review Day'), findsNothing);
    expect(find.textContaining('Jamie Example'), findsNothing);
  });

  testWidgets('a successful refresh replaces the cached board and clears the '
      'offline state', (tester) async {
    final cache = MemoryBoardCacheRepository(
      _cachedBoard(age: const Duration(hours: 3)),
    );

    await _pumpApp(
      tester,
      cache: cache,
      apiFactory: (session) =>
          _OnlineApi(session, _board(name: 'Review Day (updated)')),
    );

    expect(find.text('Review Day (updated)'), findsOneWidget);
    expect(find.text('Working offline'), findsNothing);
    expect(find.textContaining('Synced'), findsOneWidget);
  });

  group('a production the server refuses', () {
    // The failure this guards: a day marked complete drops out of the readable
    // statuses and the board 404s. The app kept showing the cached roster,
    // labelled it "Working offline", and went on printing — because the cached
    // production status still said `active`.

    testWidgets('is not described as working offline', (tester) async {
      await _pumpApp(
        tester,
        cache: MemoryBoardCacheRepository(
          _cachedBoard(age: const Duration(minutes: 45)),
        ),
        apiFactory: _GoneApi.new,
      );

      expect(find.text('This day is closed'), findsWidgets);
      expect(find.text('Working offline'), findsNothing);
    });

    testWidgets('still shows the last roster it saw', (tester) async {
      // Hiding the roster would be its own kind of lying — the crew and their
      // drinks are the last true thing this iPhone knows.
      await _pumpApp(
        tester,
        cache: MemoryBoardCacheRepository(
          _cachedBoard(age: const Duration(minutes: 45)),
        ),
        apiFactory: _GoneApi.new,
      );

      expect(find.text('Review Day'), findsOneWidget);
    });

    test('refuses to print, even though the cached status says active',
        () async {
      // The safety half. The notice is words; this is the guard. Note the
      // cached board below is deliberately `active` — that is the exact value
      // that used to let a finished day keep printing.
      final controller = PrinterController(
        sessionRepository: MemorySessionRepository(_session),
        printRecoveryRepository: MemoryPrintRecoveryRepository(),
        boardCacheRepository: MemoryBoardCacheRepository(
          _cachedBoard(age: const Duration(minutes: 5)),
        ),
        apiFactory: _GoneApi.new,
      );
      addTearDown(controller.dispose);
      await controller.start();

      expect(controller.queue?.isProductionActive, isTrue);
      expect(controller.boardUnavailableReason, isNotNull);

      await controller.printLabel(controller.queue!.labels.first);
      expect(controller.operatorError, contains('no longer available'));
    });

    test('a lost signal after a refusal does not reopen the day', () async {
      // Losing the network must not launder a refusal back into "just stale".
      final controller = PrinterController(
        sessionRepository: MemorySessionRepository(_session),
        printRecoveryRepository: MemoryPrintRecoveryRepository(),
        boardCacheRepository: MemoryBoardCacheRepository(
          _cachedBoard(age: const Duration(minutes: 5)),
        ),
        apiFactory: _GoneApi.new,
      );
      addTearDown(controller.dispose);
      await controller.start();
      expect(controller.boardUnavailableReason, isNotNull);

      // A later refresh that merely cannot reach the server.
      await controller.refreshBoard(silent: true);
      expect(controller.boardUnavailableReason, isNotNull);
    });

    testWidgets('a merely unreachable server is still offline, not closed',
        (tester) async {
      // The other half: losing signal must not be mistaken for a closed day,
      // or the offline cache stops being worth having.
      await _pumpApp(
        tester,
        cache: MemoryBoardCacheRepository(
          _cachedBoard(age: const Duration(minutes: 45)),
        ),
        apiFactory: _OfflineApi.new,
      );

      expect(find.text('Working offline'), findsOneWidget);
      expect(find.text('This day is closed'), findsNothing);
    });
  });

  testWidgets('a successful fetch writes the cache for the next cold start',
      (tester) async {
    final cache = MemoryBoardCacheRepository();

    await _pumpApp(
      tester,
      cache: cache,
      apiFactory: (session) => _OnlineApi(session, _board()),
    );

    final written = cache.value;
    expect(written, isNotNull);
    expect(written!.productionId, _session.productionId);
    expect(written.board.roster, hasLength(2));
  });
}
