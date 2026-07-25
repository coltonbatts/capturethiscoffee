import 'dart:convert';

import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/board_fixture.dart';

void main() {
  final entry = boardEntry(
    orderId: 'order-1',
    personName: 'Maya Rodriguez',
    drink: '',
    group: 'Camera',
    status: 'not_asked',
  );

  test('coalesces fields while retaining the first observed revision',
      () async {
    final repository = MemoryOrderMutationOutboxRepository();
    final outbox = OrderMutationOutbox(repository);
    await outbox.queueOrderPatch(
      scopeKey: 'user:user-a',
      productionId: 'day-a',
      entry: entry,
      patch: OrderPatch({
        OrderField.drinkType: 'Latte',
        OrderField.status: 'confirmed',
      }),
      updateUsualOrder: false,
      desiredUsualOrder: 'Latte',
    );
    await outbox.queueOrderPatch(
      scopeKey: 'user:user-a',
      productionId: 'day-a',
      entry: entry.copyWith(
        order: entry.order!.copyWith(
          drinkType: 'Latte',
          status: 'confirmed',
          updatedAt: 'local-optimistic-time',
        ),
      ),
      patch: OrderPatch({
        OrderField.milkType: 'Oat',
        OrderField.drinkType: 'Flat white',
      }),
      updateUsualOrder: true,
      desiredUsualOrder: 'Flat white, Oat',
    );

    final record = outbox['order-1']!;
    expect(record.observedUpdatedAt, entry.order!.updatedAt);
    expect(record.patch!.values, {
      OrderField.drinkType: 'Flat white',
      OrderField.status: 'confirmed',
      OrderField.milkType: 'Oat',
    });
    expect(record.updateUsualOrder, isTrue);
    expect(repository.records, hasLength(1));
  });

  test('serializes rapid whole-ledger writes without dropping either order',
      () async {
    final repository = MemoryOrderMutationOutboxRepository();
    final outbox = OrderMutationOutbox(repository);
    final second = boardEntry(
      orderId: 'order-2',
      personName: 'Jordan Lee',
      drink: '',
      group: 'Camera',
      status: 'not_asked',
    );

    await Future.wait([
      outbox.queueOrderPatch(
        scopeKey: 'user:user-a',
        productionId: 'day-a',
        entry: entry,
        patch: OrderPatch({
          OrderField.drinkType: 'Latte',
          OrderField.status: 'confirmed',
        }),
        updateUsualOrder: false,
        desiredUsualOrder: 'Latte',
      ),
      outbox.queueOrderPatch(
        scopeKey: 'user:user-a',
        productionId: 'day-a',
        entry: second,
        patch: OrderPatch({
          OrderField.drinkType: 'Americano',
          OrderField.status: 'confirmed',
        }),
        updateUsualOrder: false,
        desiredUsualOrder: 'Americano',
      ),
    ]);

    expect(repository.records.map((record) => record.orderId), {
      'order-1',
      'order-2',
    });
  });

  test('round trip restores ordinary and physical intent together', () async {
    final repository = MemoryOrderMutationOutboxRepository();
    final first = OrderMutationOutbox(repository);
    await first.queueOrderPatch(
      scopeKey: 'user:user-a',
      productionId: 'day-a',
      entry: entry,
      patch: OrderPatch.noDrink(),
      updateUsualOrder: false,
      desiredUsualOrder: 'No order',
    );
    await first.recordPrintRecovery(PrintRecoveryRecord(
      apiBase: 'user:user-a',
      productionId: 'day-a',
      orderId: 'order-1',
      personName: entry.person.name,
      drink: 'Latte',
      createdAt: DateTime.utc(2026, 7, 25),
      state: PrintRecoveryState.printedNeedsSync,
    ));

    final restored = OrderMutationOutbox(repository);
    await restored.start();

    expect(restored['order-1']?.patch?.values[OrderField.status], 'no_order');
    expect(
      restored['order-1']?.printState,
      PrintRecoveryState.printedNeedsSync,
    );
  });

  test('confirmed physical evidence can never become uncertain', () async {
    final outbox = OrderMutationOutbox(
      MemoryOrderMutationOutboxRepository(),
    );
    final confirmed = PrintRecoveryRecord(
      apiBase: 'user:user-a',
      productionId: 'day-a',
      orderId: 'order-1',
      personName: 'Maya',
      drink: 'Latte',
      createdAt: DateTime.utc(2026, 7, 25),
      state: PrintRecoveryState.printedNeedsSync,
    );
    await outbox.recordPrintRecovery(confirmed);

    await expectLater(
      outbox.recordPrintRecovery(
        PrintRecoveryRecord(
          apiBase: confirmed.apiBase,
          productionId: confirmed.productionId,
          orderId: confirmed.orderId,
          personName: confirmed.personName,
          drink: confirmed.drink,
          createdAt: confirmed.createdAt,
          state: PrintRecoveryState.uncertain,
        ),
      ),
      throwsStateError,
    );
  });

  test('a print-only record can later coalesce an ordinary order edit',
      () async {
    final outbox = OrderMutationOutbox(
      MemoryOrderMutationOutboxRepository(),
    );
    await outbox.recordPrintRecovery(PrintRecoveryRecord(
      apiBase: 'user:user-a',
      productionId: 'day-a',
      orderId: 'order-1',
      personName: entry.person.name,
      drink: 'Latte',
      createdAt: DateTime.utc(2026, 7, 25),
      state: PrintRecoveryState.printedNeedsSync,
    ));

    await outbox.queueOrderPatch(
      scopeKey: 'user:user-a',
      productionId: 'day-a',
      entry: entry,
      patch: OrderPatch({
        OrderField.drinkType: 'Americano',
        OrderField.status: 'confirmed',
      }),
      updateUsualOrder: false,
      desiredUsualOrder: 'Americano',
    );

    expect(
      outbox['order-1']?.printState,
      PrintRecoveryState.printedNeedsSync,
    );
    expect(
      outbox['order-1']?.patch?.values[OrderField.drinkType],
      'Americano',
    );
    expect(outbox['order-1']?.observedUpdatedAt, entry.order!.updatedAt);
  });

  test('scope isolation hides rather than deletes another account record',
      () async {
    final outbox = OrderMutationOutbox(
      MemoryOrderMutationOutboxRepository(),
    );
    await outbox.queueOrderPatch(
      scopeKey: 'user:user-a',
      productionId: 'day-a',
      entry: entry,
      patch: OrderPatch.noDrink(),
      updateUsualOrder: false,
      desiredUsualOrder: 'No order',
    );

    expect(
      outbox.forScope(
        scopeKey: 'user:user-b',
        productionId: 'day-a',
      ),
      isEmpty,
    );
    expect(outbox['order-1'], isNotNull);
  });

  test('does not coalesce the same order across signed-in scopes', () async {
    final outbox = OrderMutationOutbox(
      MemoryOrderMutationOutboxRepository(),
    );
    await outbox.queueOrderPatch(
      scopeKey: 'user:user-a',
      productionId: 'day-a',
      entry: entry,
      patch: OrderPatch.noDrink(),
      updateUsualOrder: false,
      desiredUsualOrder: 'No order',
    );

    await expectLater(
      outbox.queueOrderPatch(
        scopeKey: 'user:user-b',
        productionId: 'day-a',
        entry: entry,
        patch: OrderPatch({
          OrderField.drinkType: 'Latte',
          OrderField.status: 'confirmed',
        }),
        updateUsualOrder: false,
        desiredUsualOrder: 'Latte',
      ),
      throwsStateError,
    );
    expect(outbox['order-1']?.scopeKey, 'user:user-a');
  });

  test('clearing a migrated Build 9 print does not resurrect it', () async {
    final legacy = PrintRecoveryRecord(
      apiBase: 'user:user-a',
      productionId: 'day-a',
      orderId: 'order-1',
      personName: 'Maya',
      drink: 'Latte',
      createdAt: DateTime.utc(2026, 7, 25),
      state: PrintRecoveryState.printedNeedsSync,
    );
    SharedPreferences.setMockInitialValues({
      'ctc_print_recovery_v1': jsonEncode([legacy.toJson()]),
    });
    final first = OrderMutationOutbox(
      PreferencesOrderMutationOutboxRepository(),
    );
    await first.start();
    expect(first['order-1'], isNotNull);

    await first.clearPrintIntent('order-1');

    final restored = OrderMutationOutbox(
      PreferencesOrderMutationOutboxRepository(),
    );
    await restored.start();
    expect(restored['order-1'], isNull);
  });
}
