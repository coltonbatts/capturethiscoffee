import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/ctc_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ctc_printer/main.dart';
import 'package:ctc_printer/screens/home_screen.dart';
import 'package:ctc_printer/screens/link_screen.dart';
import 'package:ctc_printer/screens/print_screen.dart';
import 'package:ctc_printer/screens/recovery_screen.dart';
import 'package:ctc_printer/theme.dart';
import 'package:ctc_printer/widgets/print_deck.dart';
import 'package:ctc_printer/widgets/motion.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/session_store.dart';

import 'support/board_fixture.dart';

const _planningSession = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'planning-production',
  token: 'fixture-token',
);

class _PlanningApi extends CtcApi {
  _PlanningApi(super.session);

  @override
  Future<ProductionBoard> fetchBoard() async => boardFixture(
        name: 'Tomorrow’s Shoot',
        status: 'planning',
        roster: [
          boardEntry(
            orderId: 'order-1',
            personName: 'Jamie Example',
            drink: 'Iced oat latte',
            group: 'Crew',
          ),
        ],
      );

  @override
  void close() {}
}

const _rosterSession = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'roster-production',
  token: 'fixture-token',
);

class _RosterApi extends CtcApi {
  _RosterApi(super.session);

  @override
  Future<ProductionBoard> fetchBoard() async => boardFixture(
        name: 'Roster Day',
        status: 'active',
        productionId: 'roster-production',
        roster: [
          boardEntry(
            orderId: 'order-maya',
            personName: 'Maya Rodriguez',
            drink: 'Oat flat white',
            group: 'Camera',
            sortOrder: 1,
          ),
          boardEntry(
            orderId: 'order-jonah',
            personName: 'Jonah Bell',
            drink: 'Iced americano',
            group: 'Grip',
            sortOrder: 2,
          ),
          boardEntry(
            orderId: 'order-dana',
            personName: 'Dana Whitfield',
            drink: 'Cortado',
            group: 'Art',
            labelPrinted: true,
            sortOrder: 3,
          ),
        ],
      );

  @override
  void close() {}
}

/// Launches, waits for the board, and opens the roster from home.
///
/// The roster is a route now rather than a section of one long scroll, so
/// every roster assertion has to navigate there first.
const _finishedSession = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'finished-production',
  token: 'fixture-token',
);

class _FinishedApi extends CtcApi {
  _FinishedApi(super.session);

  @override
  Future<ProductionBoard> fetchBoard() async => boardFixture(
        name: 'Wrapped Day',
        status: 'active',
        productionId: 'finished-production',
        roster: [
          boardEntry(
            orderId: 'order-1',
            personName: 'Maya Rodriguez',
            drink: 'Oat flat white',
            group: 'Camera',
            labelPrinted: true,
          ),
          boardEntry(
            orderId: 'order-2',
            personName: 'Jonah Bell',
            drink: 'Iced americano',
            group: 'Grip',
            labelPrinted: true,
            sortOrder: 2,
          ),
        ],
      );

  @override
  void close() {}
}

Future<void> _pumpRoster(WidgetTester tester) async {
  await tester.pumpWidget(PrinterApp(
    sessionRepository: MemorySessionRepository(_rosterSession),
    boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
    apiFactory: _RosterApi.new,
  ));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(rosterEntryKey));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('roster search narrows the list to one person',
      (WidgetTester tester) async {
    await _pumpRoster(tester);
    expect(find.text('Maya Rodriguez'), findsOneWidget);
    expect(find.text('Jonah Bell'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'maya');
    await tester.pumpAndSettle();

    expect(find.text('Maya Rodriguez'), findsOneWidget);
    expect(find.text('Jonah Bell'), findsNothing);
  });

  testWidgets('roster search matches the drink, not just the name',
      (WidgetTester tester) async {
    await _pumpRoster(tester);

    await tester.enterText(find.byType(TextField), 'americano');
    await tester.pumpAndSettle();

    expect(find.text('Jonah Bell'), findsOneWidget);
    expect(find.text('Maya Rodriguez'), findsNothing);
  });

  testWidgets('the printed filter shows only labels already printed',
      (WidgetTester tester) async {
    await _pumpRoster(tester);

    // Default view is what is left to do, so a printed label is out of sight.
    expect(find.text('Dana Whitfield'), findsNothing);

    // The counts live on the chips, and they ignore the search query — three
    // people, one of them already printed.
    expect(find.widgetWithText(ChoiceChip, 'To print (2)'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'All (3)'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, 'Printed (1)'));
    await tester.pumpAndSettle();

    expect(find.text('Dana Whitfield'), findsOneWidget);
    expect(find.text('Maya Rodriguez'), findsNothing);
  });

  testWidgets('a search with no match explains itself',
      (WidgetTester tester) async {
    await _pumpRoster(tester);

    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pumpAndSettle();

    expect(find.text('Nobody matches “zzz”'), findsOneWidget);
    expect(find.text('Try a name or a drink.'), findsOneWidget);
  });

  testWidgets('Printer app renders link screen', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
    ));
    await tester.pump();
    expect(find.text('Link production'), findsOneWidget);
  });

  testWidgets('in-app quick start is available before linking',
      (WidgetTester tester) async {
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
    printRecoveryRepository: MemoryPrintRecoveryRepository(),
    ));
    await tester.pump();
    await tester.tap(find.byTooltip('How to use Capture This'));
    await tester.pumpAndSettle();
    expect(find.text('How to use Capture This'), findsOneWidget);
    expect(find.text('Link an active production'), findsOneWidget);
  });

  testWidgets('planning productions visibly pause physical printing',
      (WidgetTester tester) async {
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_planningSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _PlanningApi.new,
    ));
    await tester.pumpAndSettle();

    // Home reports a blocker before the operator navigates anywhere — the
    // point of the print entry carrying DeckBlock rather than just a label.
    //
    // It names the disconnected printer rather than the planning status, and
    // that ordering is deliberate: DeckBlock reports the most fixable cause
    // first, and an operator can plug in a printer but cannot mark a
    // production active from here.
    expect(find.text('Printer not connected'), findsOneWidget);

    await tester.tap(find.byKey(printEntryKey));
    await tester.pumpAndSettle();
    expect(find.text('Production planning'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Printing paused'),
      300,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Printing paused'), findsOneWidget);

    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(rosterEntryKey));
    await tester.pumpAndSettle();

    // The roster's per-person print control is an icon button since the deck
    // became the primary print path; the rule it enforces is unchanged.
    final rowPrintButton = find.widgetWithIcon(IconButton, Icons.print);
    expect(tester.widget<IconButton>(rowPrintButton).onPressed, isNull);
  });

  testWidgets('an unresolved label is resolvable from exactly one screen',
      (WidgetTester tester) async {
    // This decision puts more ink on a real cup. It used to be offered in three
    // places at once, which is three chances to answer it differently.
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_rosterSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository([
        PrintRecoveryRecord(
          apiBase: _rosterSession.apiBase,
          productionId: _rosterSession.productionId,
          orderId: 'order-maya',
          personName: 'Maya Rodriguez',
          drink: 'Oat flat white',
          createdAt: DateTime.utc(2026, 7, 25, 12),
          state: PrintRecoveryState.uncertain,
        ),
      ]),
      apiFactory: _RosterApi.new,
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(rosterEntryKey));
    await tester.pumpAndSettle();

    // The roster names the person and the problem, and offers no resolution.
    expect(find.text('Maya Rodriguez'), findsOneWidget);
    expect(find.text('Needs a physical check'), findsOneWidget);
    expect(find.text('Label printed — sync only'), findsNothing);
    expect(find.text('Nothing printed — retry'), findsNothing);

    // Tapping the row leads to the one screen that can resolve it.
    await tester.tap(find.text('Maya Rodriguez'));
    await tester.pumpAndSettle();

    expect(find.text('Unresolved labels'), findsOneWidget);
    expect(find.text('Label printed — sync only'), findsOneWidget);
    expect(find.text('Nothing printed — retry'), findsOneWidget);
  });

  test('a blocked print sends the operator where the fix is', () {
    // The home print entry named the blocker but routed to the deck, which
    // could only repeat it. Naming one screen and opening another is a dead
    // end.
    //
    // A unit test rather than a widget test: recoveryPending requires a
    // connected printer, which the widget tester cannot arrange.
    expect(
      printEntryDestination(DeckBlock.recoveryPending),
      RecoveryScreen.route,
    );
    for (final block in [
      DeckBlock.none,
      DeckBlock.disconnected,
      DeckBlock.productionInactive,
    ]) {
      expect(printEntryDestination(block), PrintScreen.route);
    }
  });

  testWidgets('a roster row expands in place, one at a time',
      (WidgetTester tester) async {
    await _pumpRoster(tester);

    // Collapsed: the drink shares one line with the group.
    expect(find.text('Print this label'), findsNothing);
    expect(find.text('Oat flat white · Camera'), findsOneWidget);

    await tester.tap(find.text('Maya Rodriguez'));
    await tester.pumpAndSettle();

    // Expanded: avatar initials, the drink on its own slab, and an action.
    expect(find.text('MR'), findsOneWidget);
    expect(find.text('Oat flat white'), findsOneWidget);
    expect(find.text('Print this label'), findsOneWidget);

    await tester.tap(find.text('Jonah Bell'));
    await tester.pumpAndSettle();

    // Opening a second row closes the first. Letting several stand open turns
    // a dense list back into the card-per-person layout it replaced.
    expect(find.text('Print this label'), findsOneWidget);
    expect(find.text('JB'), findsOneWidget);
    expect(find.text('MR'), findsNothing);
  });

  testWidgets('the roster builds rows lazily', (WidgetTester tester) async {
    // The board caps at 1000 entries and this used to be a Column that built
    // every row on every frame.
    await _pumpRoster(tester);
    expect(find.byType(ListView), findsWidgets);
    expect(
      tester.widgetList<ListView>(find.byType(ListView)).any(
            (list) => list.childrenDelegate is SliverChildBuilderDelegate,
          ),
      isTrue,
      reason: 'The roster list is not lazily built.',
    );
  });

  testWidgets('home celebrates only when the day is actually done',
      (WidgetTester tester) async {
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_finishedSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _FinishedApi.new,
    ));
    await tester.pumpAndSettle();

    expect(find.text('That’s the day.'), findsOneWidget);
    expect(find.text('All labels printed'), findsOneWidget);
    // The day's name gives way to the celebration — one headline, not two.
    expect(find.text('Wrapped Day'), findsNothing);
  });

  testWidgets('home does not celebrate while labels are outstanding',
      (WidgetTester tester) async {
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_rosterSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _RosterApi.new,
    ));
    await tester.pumpAndSettle();

    expect(find.text('That’s the day.'), findsNothing);
    expect(find.text('All labels printed'), findsNothing);
    expect(find.text('Roster Day'), findsOneWidget);
  });

  testWidgets('the home print entry is yellow only when a print would succeed',
      (WidgetTester tester) async {
    // The rule this screen is built around: a yellow control that cannot do
    // anything teaches the operator to distrust the colour. Nothing here can
    // connect a printer, so the entry must not promise one.
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_rosterSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _RosterApi.new,
    ));
    await tester.pumpAndSettle();

    final entry = tester.widget<Material>(find.byKey(printEntryKey));
    expect(entry.color, isNot(CaptureColors.yellow));

    // And it says which blocker to fix rather than just naming the screen.
    expect(find.text('Printer not connected'), findsOneWidget);
  });

  testWidgets('the deck count uses tabular figures',
      (WidgetTester tester) async {
    // The number counts itself down. With proportional digits it changes width
    // mid-count, so the words beside it twitch on every tick.
    //
    // This is also a wiring guard: CaptureType.statNumber carried the feature
    // for several revisions while the deck still used headlineLarge, so the
    // token was correct and the screen was not.
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_rosterSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _RosterApi.new,
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(printEntryKey));
    await tester.pumpAndSettle();

    final count = tester
        .widgetList<Text>(find.byType(Text))
        .firstWhere((text) => text.data == '2');
    expect(
      count.style?.fontFeatures,
      contains(const FontFeature.tabularFigures()),
    );
  });

  testWidgets('Reduce Motion snaps implicit animations instead of sliding',
      (WidgetTester tester) async {
    // Flutter's implicit animations do not consult Reduce Motion on their own.
    // AnimatedSize, AnimatedSwitcher and TweenAnimationBuilder all slide unless
    // their duration is routed through motionDuration.
    //
    // Asserted on the duration rather than on what is findable mid-animation:
    // AnimatedSize animates a box, not the presence of its child, so the
    // expanded content is findable either way and a finder proves nothing.
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

    await _pumpRoster(tester);
    final reduced = tester.widget<AnimatedSize>(
      find.byType(AnimatedSize).first,
    );
    expect(reduced.duration, Duration.zero);
  });

  testWidgets('without Reduce Motion those animations still have a duration',
      (WidgetTester tester) async {
    await _pumpRoster(tester);
    final normal = tester.widget<AnimatedSize>(
      find.byType(AnimatedSize).first,
    );
    expect(normal.duration, greaterThan(Duration.zero));
  });

  testWidgets('Reduce Motion resolves the entrance to its END state',
      (WidgetTester tester) async {
    // The failure mode this guards is not a missing animation, it is an
    // invisible screen: an entrance that starts at opacity 0 and is then told
    // not to animate leaves the operator staring at blank paper.
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_rosterSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _RosterApi.new,
    ));
    // One frame only. Nothing has had time to animate.
    await tester.pump();
    await tester.pump();

    final faded = tester
        .widgetList<Opacity>(
          find.descendant(
            of: find.byType(CascadeIn),
            matching: find.byType(Opacity),
          ),
        )
        .where((widget) => widget.opacity < 1);
    expect(
      faded,
      isEmpty,
      reason: 'Reduce Motion left content partially transparent.',
    );
  });

  testWidgets('without Reduce Motion the entrance actually animates',
      (WidgetTester tester) async {
    // The other half of the previous test: proof the first frame is genuinely
    // hidden, so that test is asserting something.
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(_rosterSession),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
      apiFactory: _RosterApi.new,
    ));
    await tester.pump();
    await tester.pump();

    final faded = tester
        .widgetList<Opacity>(
          find.descendant(
            of: find.byType(CascadeIn),
            matching: find.byType(Opacity),
          ),
        )
        .where((widget) => widget.opacity < 1);
    expect(faded, isNotEmpty);

    await tester.pumpAndSettle();
    final stillFaded = tester
        .widgetList<Opacity>(
          find.descendant(
            of: find.byType(CascadeIn),
            matching: find.byType(Opacity),
          ),
        )
        .where((widget) => widget.opacity < 1);
    expect(stillFaded, isEmpty, reason: 'The entrance never finished.');
  });

  testWidgets('a bad link is answered under the field, not in the banner',
      (WidgetTester tester) async {
    // A mistyped link and a Bluetooth scan timeout are not the same kind of
    // problem. They used to share one banner, prefixed with the internal
    // operation name — "Link production failed: …" — which told the operator
    // what the code was doing rather than what was wrong with what they typed.
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
    ));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'https://example.com/run/x');
    await tester.tap(find.text('Link production'));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('no ?token= on the end'),
      findsOneWidget,
      reason: 'The field should say what is wrong with the link.',
    );
    expect(find.textContaining('Link production failed'), findsNothing);
  });

  testWidgets('editing clears the complaint', (WidgetTester tester) async {
    await tester.pumpWidget(PrinterApp(
      sessionRepository: MemorySessionRepository(),
      boardCacheRepository: MemoryBoardCacheRepository(),
      printRecoveryRepository: MemoryPrintRecoveryRepository(),
    ));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'nonsense');
    await tester.tap(find.text('Link production'));
    await tester.pumpAndSettle();
    expect(find.textContaining('does not look like a link'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'nonsense2');
    await tester.pumpAndSettle();
    expect(find.textContaining('does not look like a link'), findsNothing);
  });

  group('link validation copy', () {
    test('names the actual problem', () {
      expect(
        linkValidationMessage(''),
        contains('Paste the production share link'),
      );
      expect(
        linkValidationMessage('just some words'),
        contains('does not look like a link'),
      );
      expect(
        linkValidationMessage('https://coffee.example.com/run/prod-1'),
        contains('no ?token='),
      );
      expect(
        linkValidationMessage('http://coffee.example.com/run/p?token=abc'),
        contains('Only https'),
      );
      expect(
        linkValidationMessage('https://example.com/somewhere?token=abc'),
        contains('not a production share link'),
      );
    });

    test('never quotes the token back', () {
      // The in-app guide says never to share or screenshot the link. An error
      // message that prints the token defeats that from inside the app.
      const secret = 'sup3rsecrettoken';
      for (final link in [
        'http://coffee.example.com/run/p?token=$secret',
        'https://example.com/nope?token=$secret',
        'https://coffee.example.com/api/public/x?token=$secret',
      ]) {
        expect(linkValidationMessage(link), isNot(contains(secret)));
      }
    });
  });

  test('parseProductionShareUrl accepts the canonical runner link', () {
    final session = parseProductionShareUrl(
      'https://capturethis.coffee/run/prod-1?token=abc123',
    );
    expect(session?.productionId, 'prod-1');
    expect(session?.token, 'abc123');
    expect(session?.apiBase, 'https://capturethis.coffee');
  });

  test('parseProductionShareUrl retains legacy link compatibility', () {
    final session = parseProductionShareUrl(
      'https://capturethis.coffee/productions/prod-1?token=abc123',
    );
    expect(session?.productionId, 'prod-1');
    expect(session?.token, 'abc123');
    expect(session?.apiBase, 'https://capturethis.coffee');
  });

  test('parseProductionShareUrl rejects unrelated nested production APIs', () {
    final session = parseProductionShareUrl(
      'https://capturethis.coffee/api/public/productions/prod-1/labels?token=abc123',
    );
    expect(session, isNull);
  });

  test('parseProductionShareUrl rejects insecure public and credentialed URLs',
      () {
    expect(
      parseProductionShareUrl(
        'http://coffee.capturethis.com/run/prod-1?token=abc123',
      ),
      isNull,
    );
    expect(
      parseProductionShareUrl(
        'https://user:pass@coffee.capturethis.com/run/prod-1?token=abc123',
      ),
      isNull,
    );
  });

  test('parseProductionShareUrl permits local HTTP development', () {
    final session = parseProductionShareUrl(
      'http://192.168.1.69:3000/run/prod-1?token=abc123',
    );
    expect(session?.apiBase, 'http://192.168.1.69:3000');
  });

  test('decodeSession rejects malformed and insecure saved sessions', () {
    expect(decodeSession('{"apiBase":42}'), isNull);
    expect(
      decodeSession(
        '{"apiBase":"http://example.com","productionId":"p","token":"t"}',
      ),
      isNull,
    );
  });
}
