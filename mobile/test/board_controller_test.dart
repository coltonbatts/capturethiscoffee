import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_controller.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

const _offline = WorkspaceRepositoryException(
  'offline',
  kind: WorkspaceFailureKind.unreachable,
);

BoardRosterEntry _needsEntry({
  String id = 'order-1',
  String name = 'Maya Rodriguez',
  String usual = 'Large, Iced latte, Oat milk',
}) {
  final base = boardEntry(
    orderId: id,
    personName: name,
    drink: '',
    group: 'Camera',
    status: 'not_asked',
  );
  return base.copyWith(
    person: base.person.copyWith(usualOrder: usual),
  );
}

ProductionBoard _board([BoardOrder? order]) {
  final entry = _needsEntry();
  return boardFixture(
    productionId: 'day-a',
    name: 'Build 10 Day',
    status: 'active',
    roster: [
      if (order == null) entry else entry.copyWith(order: order),
    ],
  );
}

ProductionBoard _threePersonBoard() => boardFixture(
      productionId: 'day-a',
      name: 'Build 10 Day',
      status: 'active',
      roster: [
        _needsEntry(),
        _needsEntry(
          id: 'order-2',
          name: 'Jordan Lee',
          usual: 'Small, Hot americano',
        ),
        _needsEntry(
          id: 'order-3',
          name: 'Sam Patel',
          usual: 'Medium, Cold brew',
        ),
      ],
    );

void main() {
  test('three offline captures and two prints survive relaunch and replay once',
      () async {
    final server = _threePersonBoard();
    final repository = MemoryWorkspaceRepository(
      boards: {'day-a': server},
    );
    final cache = MemoryAuthenticatedBoardCacheRepository();
    final durable = MemoryOrderMutationOutboxRepository();
    final outbox = OrderMutationOutbox(durable);
    final first = BoardController(
      repository: repository,
      cacheRepository: cache,
      outbox: outbox,
    );
    await first.activate(userId: 'user-a', productionId: 'day-a');
    repository
      ..fetchBoardFailure = _offline
      ..updateOrderFailure = _offline
      ..markPrintedFailure = _offline;

    await first.acceptUsual('order-1');
    await first.acceptUsual('order-2');
    await first.saveOrder(
      orderId: 'order-3',
      patch: OrderPatch({
        OrderField.drinkType: 'Mocha',
        OrderField.size: 'Large',
        OrderField.temperature: 'Hot',
        OrderField.status: 'confirmed',
      }),
      updateUsualOrder: false,
    );
    for (final orderId in ['order-1', 'order-2']) {
      final order = first.board!.orderById(orderId)!;
      await outbox.recordPrintRecovery(PrintRecoveryRecord(
        apiBase: 'user:user-a',
        productionId: 'day-a',
        orderId: orderId,
        personName: first.board!.entryByOrderId(orderId)!.person.name,
        drink: order.drinkType,
        createdAt: DateTime.utc(2026, 7, 25),
        state: PrintRecoveryState.printedNeedsSync,
      ));
    }
    await Future<void>.delayed(Duration.zero);
    expect(first.pendingMutationCount, 3);
    first.dispose();

    final restored = BoardController(
      repository: repository,
      cacheRepository: cache,
      outbox: OrderMutationOutbox(durable),
    );
    addTearDown(restored.dispose);
    await restored.activate(userId: 'user-a', productionId: 'day-a');
    expect(restored.pendingMutationCount, 3);
    expect(restored.board!.orderById('order-1')!.labelPrinted, isTrue);
    expect(restored.board!.orderById('order-2')!.labelPrinted, isTrue);

    repository
      ..fetchBoardFailure = null
      ..updateOrderFailure = null
      ..markPrintedFailure = null;
    await restored.refresh();

    final saved = repository.boards['day-a']!;
    expect(saved.orderById('order-1')!.drinkType, 'Iced latte');
    expect(saved.orderById('order-2')!.drinkType, 'Hot americano');
    expect(saved.orderById('order-3')!.drinkType, 'Mocha');
    expect(saved.orderById('order-3')!.size, 'Large');
    expect(saved.orderById('order-1')!.labelPrinted, isTrue);
    expect(saved.orderById('order-2')!.labelPrinted, isTrue);
    expect(saved.orderById('order-3')!.labelPrinted, isFalse);
    expect(restored.pendingMutationCount, 0);
    expect(repository.conditionalOrderCalls, 3);
    expect(repository.markPrintedCalls, 2);

    await restored.refresh();
    expect(repository.conditionalOrderCalls, 3);
    expect(repository.markPrintedCalls, 2);
  });

  test('offline cold start restores optimistic Collect and Print state',
      () async {
    final server = _board();
    final repository = MemoryWorkspaceRepository(
      boards: {'day-a': server},
    );
    final cache = MemoryAuthenticatedBoardCacheRepository();
    final durable = MemoryOrderMutationOutboxRepository();
    final first = BoardController(
      repository: repository,
      cacheRepository: cache,
      outbox: OrderMutationOutbox(durable),
    );
    addTearDown(first.dispose);
    await first.activate(userId: 'user-a', productionId: 'day-a');

    repository
      ..fetchBoardFailure = _offline
      ..updateOrderFailure = _offline;
    await first.acceptUsual('order-1');
    await Future<void>.delayed(Duration.zero);

    expect(first.board!.orderById('order-1')!.status, 'confirmed');
    expect(first.queue!.labels.single.personName, 'Maya Rodriguez');
    expect(first.pendingMutationCount, 1);

    final restored = BoardController(
      repository: repository,
      cacheRepository: cache,
      outbox: OrderMutationOutbox(durable),
    );
    addTearDown(restored.dispose);
    await restored.activate(userId: 'user-a', productionId: 'day-a');

    expect(restored.board!.orderById('order-1')!.status, 'confirmed');
    expect(restored.queue!.labels, hasLength(1));
    expect(restored.pendingMutationCount, 1);

    repository
      ..fetchBoardFailure = null
      ..updateOrderFailure = null;
    await restored.refresh();

    final saved = repository.boards['day-a']!.orderById('order-1')!;
    expect(saved.status, 'confirmed');
    expect(saved.drinkType, 'Iced latte');
    expect(saved.milkType, 'Oat');
    expect(restored.pendingMutationCount, 0);
    expect(repository.conditionalOrderCalls, 1);
  });

  test('competing edit stops on a visible conflict without overwriting',
      () async {
    final server = _board();
    final repository = MemoryWorkspaceRepository(
      boards: {'day-a': server},
    );
    final durable = MemoryOrderMutationOutboxRepository();
    final controller = BoardController(
      repository: repository,
      cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
      outbox: OrderMutationOutbox(durable),
    );
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');

    repository
      ..fetchBoardFailure = _offline
      ..updateOrderFailure = _offline;
    await controller.saveOrder(
      orderId: 'order-1',
      patch: OrderPatch({
        OrderField.drinkType: 'Phone latte',
        OrderField.status: 'confirmed',
      }),
      updateUsualOrder: false,
    );
    await Future<void>.delayed(Duration.zero);

    final competing = server.orderById('order-1')!.copyWith(
          drinkType: 'Web americano',
          status: 'confirmed',
          updatedAt: '2026-07-25T20:00:00.000Z',
        );
    repository.boards['day-a'] = server.replaceOrder(competing);
    repository
      ..fetchBoardFailure = null
      ..updateOrderFailure = null;

    await controller.refresh();

    expect(controller.conflictCount, 1);
    expect(
      controller.mutationFor('order-1')?.conflict?.serverOrder?.drinkType,
      'Web americano',
    );
    expect(
      repository.boards['day-a']!.orderById('order-1')!.drinkType,
      'Web americano',
    );
    expect(
      controller.board!.orderById('order-1')!.drinkType,
      'Phone latte',
    );
  });

  test('printed fact reaches server while ordinary fields remain conflicted',
      () async {
    final server = _board();
    final repository = MemoryWorkspaceRepository(
      boards: {'day-a': server},
    );
    final outbox = OrderMutationOutbox(
      MemoryOrderMutationOutboxRepository(),
    );
    final controller = BoardController(
      repository: repository,
      cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
      outbox: outbox,
    );
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');

    repository
      ..fetchBoardFailure = _offline
      ..updateOrderFailure = _offline;
    await controller.saveOrder(
      orderId: 'order-1',
      patch: OrderPatch({
        OrderField.drinkType: 'Phone latte',
        OrderField.status: 'confirmed',
      }),
      updateUsualOrder: false,
    );
    await outbox.recordPrintRecovery(PrintRecoveryRecord(
      apiBase: 'user:user-a',
      productionId: 'day-a',
      orderId: 'order-1',
      personName: 'Maya Rodriguez',
      drink: 'Phone latte',
      createdAt: DateTime.utc(2026, 7, 25),
      state: PrintRecoveryState.printedNeedsSync,
    ));

    final competing = server.orderById('order-1')!.copyWith(
          drinkType: 'Web americano',
          status: 'confirmed',
          updatedAt: '2026-07-25T20:00:00.000Z',
        );
    repository.boards['day-a'] = server.replaceOrder(competing);
    repository
      ..fetchBoardFailure = null
      ..updateOrderFailure = null;

    await controller.refresh();

    final saved = repository.boards['day-a']!.orderById('order-1')!;
    expect(saved.drinkType, 'Web americano');
    expect(saved.labelPrinted, isTrue);
    expect(controller.conflictCount, 1);
    expect(
      controller.mutationFor('order-1')?.printState,
      isNull,
    );
  });

  test('a local printed overlay is not mistaken for server confirmation',
      () async {
    final server = _board();
    final repository = MemoryWorkspaceRepository(
      boards: {'day-a': server},
    );
    final outbox = OrderMutationOutbox(
      MemoryOrderMutationOutboxRepository(),
    );
    final controller = BoardController(
      repository: repository,
      cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
      outbox: outbox,
    );
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');
    repository
      ..fetchBoardFailure = _offline
      ..markPrintedFailure = _offline;
    await outbox.recordPrintRecovery(PrintRecoveryRecord(
      apiBase: 'user:user-a',
      productionId: 'day-a',
      orderId: 'order-1',
      personName: 'Maya Rodriguez',
      drink: 'Latte',
      createdAt: DateTime.utc(2026, 7, 25),
      state: PrintRecoveryState.printedNeedsSync,
    ));

    await expectLater(
      controller.ensureLabelPrinted('order-1'),
      throwsA(isA<WorkspaceRepositoryException>()),
    );

    expect(controller.board!.orderById('order-1')!.labelPrinted, isTrue);
    expect(controller.isPrintServerConfirmed('order-1'), isFalse);
    expect(
      controller.mutationFor('order-1')?.printState,
      PrintRecoveryState.printedNeedsSync,
    );
  });

  test('a completed day retains and blocks pending mutations', () async {
    final active = _board();
    final repository = MemoryWorkspaceRepository(
      boards: {'day-a': active},
    );
    final controller = BoardController(
      repository: repository,
      cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
      outbox: OrderMutationOutbox(
        MemoryOrderMutationOutboxRepository(),
      ),
    );
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');
    repository
      ..fetchBoardFailure = _offline
      ..updateOrderFailure = _offline;
    await controller.markNoDrink('order-1');
    await Future<void>.delayed(Duration.zero);

    repository
      ..fetchBoardFailure = null
      ..updateOrderFailure = null
      ..boards['day-a'] = ProductionBoard(
        production: BoardProduction(
          id: active.production.id,
          name: active.production.name,
          shootDate: active.production.shootDate,
          location: active.production.location,
          runnerName: active.production.runnerName,
          status: 'complete',
          clientName: active.production.clientName,
        ),
        roster: active.roster,
      );
    await controller.refresh();

    expect(controller.pendingMutationCount, 1);
    expect(controller.syncBlockedReason, contains('complete'));
    expect(repository.conditionalOrderCalls, 0);
  });

  test('a lost response is acknowledged when the full server state matches',
      () async {
    final server = _board();
    final repository = MemoryWorkspaceRepository(
      boards: {'day-a': server},
    );
    final controller = BoardController(
      repository: repository,
      cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
      outbox: OrderMutationOutbox(
        MemoryOrderMutationOutboxRepository(),
      ),
    );
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');
    repository
      ..fetchBoardFailure = _offline
      ..updateOrderFailure = _offline;
    final patch = OrderPatch({
      OrderField.drinkType: 'Latte',
      OrderField.status: 'confirmed',
    });
    await controller.saveOrder(
      orderId: 'order-1',
      patch: patch,
      updateUsualOrder: false,
    );
    await Future<void>.delayed(Duration.zero);

    // Simulates Postgres committing the request while the response was lost.
    final committed = patch.apply(server.orderById('order-1')!).copyWith(
          updatedAt: '2026-07-25T21:00:00.000Z',
        );
    repository.boards['day-a'] = server.replaceOrder(committed);
    repository
      ..fetchBoardFailure = null
      ..updateOrderFailure = null;
    await controller.refresh();

    expect(controller.pendingMutationCount, 0);
    expect(controller.conflictCount, 0);
    expect(repository.conditionalOrderCalls, 1);
  });

  test('Realtime is a debounced signal for an authoritative refresh', () async {
    final server = _board();
    final repository = MemoryWorkspaceRepository(
      boards: {'day-a': server},
    );
    final controller = BoardController(
      repository: repository,
      cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
      outbox: OrderMutationOutbox(
        MemoryOrderMutationOutboxRepository(),
      ),
    );
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');
    final initialFetches = repository.fetchBoardCalls;
    final changed = server.orderById('order-1')!.copyWith(
          drinkType: 'Realtime americano',
          status: 'confirmed',
          updatedAt: '2026-07-25T22:00:00.000Z',
        );
    repository.boards['day-a'] = server.replaceOrder(changed);

    repository
      ..emitOrderChange()
      ..emitOrderChange();
    await Future<void>.delayed(const Duration(milliseconds: 350));

    expect(repository.fetchBoardCalls, initialFetches + 1);
    expect(
      controller.board!.orderById('order-1')!.drinkType,
      'Realtime americano',
    );
  });
}
