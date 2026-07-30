import 'package:ctc_printer/day_summary.dart';
import 'package:ctc_printer/screens/summary_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

void main() {
  final board = boardFixture(
    name: 'Fictional Launch Day',
    status: 'active',
    roster: [
      boardEntry(
        orderId: 'one',
        personName: 'Avery Stone',
        drink: 'Iced oat latte',
        group: 'Camera',
        labelPrinted: true,
      ),
      boardEntry(
        orderId: 'two',
        personName: 'Morgan Reed',
        drink: 'Iced oat latte',
        group: 'Art',
        sortOrder: 1,
      ),
      boardEntry(
        orderId: 'three',
        personName: 'Jordan Vale',
        drink: '',
        group: 'Grip',
        status: 'not_asked',
        sortOrder: 2,
      ),
      boardEntry(
        orderId: 'four',
        personName: 'Riley North',
        drink: '',
        group: 'Set',
        status: 'no_order',
        sortOrder: 3,
      ),
    ],
  );

  test('groups the coffee-shop order and preserves by-person state', () {
    final summary = buildDayOperatingSummary(board);

    expect(summary.coffeeShop, hasLength(1));
    expect(summary.coffeeShop.single.drink, 'Iced oat latte');
    expect(summary.coffeeShop.single.count, 2);
    expect(summary.coffeeShop.single.people, ['Avery Stone', 'Morgan Reed']);
    expect(
      summary.people.map((person) => person.state),
      [
        PersonSummaryState.printed,
        PersonSummaryState.captured,
        PersonSummaryState.waiting,
        PersonSummaryState.noDrink,
      ],
    );
    expect(summary.progress.captured, 2);
    expect(summary.progress.printed, 1);
    expect(summary.progress.needsOrder, 1);
    expect(summary.progress.noDrink, 1);
  });

  test('native share copy includes grouped, person, and state content', () {
    final text = buildDaySummaryShareText(buildDayOperatingSummary(board));

    expect(text, contains('Capture This — Fictional Launch Day'));
    expect(text, contains('2 × Iced oat latte — Avery Stone, Morgan Reed'));
    expect(
      text,
      contains(
        'Morgan Reed · Art · Iced oat latte · Captured · waiting to print',
      ),
    );
    expect(text, contains('Captured 2 · Printed 1 · Waiting 1 · No drink 1'));
  });

  test('closeout stays guarded until every decision and print is settled', () {
    expect(
      closeoutBlockReason(
        board: board,
        pendingMutations: 0,
        conflicts: 0,
        servingCachedBoard: false,
        syncBlockedReason: null,
        recoveryCount: 0,
      ),
      contains('still waiting'),
    );

    final ready = boardFixture(
      name: 'Fictional Launch Day',
      status: 'active',
      roster: [
        boardEntry(
          orderId: 'ready',
          personName: 'Avery Stone',
          drink: 'Iced oat latte',
          group: 'Camera',
          labelPrinted: true,
        ),
      ],
    );
    expect(
      closeoutBlockReason(
        board: ready,
        pendingMutations: 0,
        conflicts: 0,
        servingCachedBoard: false,
        syncBlockedReason: null,
        recoveryCount: 0,
      ),
      isNull,
    );
    expect(
      closeoutBlockReason(
        board: ready,
        pendingMutations: 0,
        conflicts: 0,
        servingCachedBoard: true,
        syncBlockedReason: null,
        recoveryCount: 0,
      ),
      contains('online'),
    );
    expect(
      closeoutBlockReason(
        board: ready,
        pendingMutations: 0,
        conflicts: 1,
        servingCachedBoard: false,
        syncBlockedReason: null,
        recoveryCount: 0,
      ),
      contains('conflict'),
    );
    expect(
      closeoutBlockReason(
        board: ready,
        pendingMutations: 0,
        conflicts: 0,
        servingCachedBoard: false,
        syncBlockedReason: null,
        recoveryCount: 1,
      ),
      contains('uncertain print'),
    );
  });
}
