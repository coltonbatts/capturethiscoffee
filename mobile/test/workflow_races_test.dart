import 'dart:async';
import 'dart:convert';
import 'package:ctc_printer/auth_repository.dart';
import 'package:ctc_printer/session_controller.dart';
import 'package:ctc_printer/setup_controller.dart';
import 'package:ctc_printer/setup_models.dart';
import 'package:ctc_printer/setup_repository.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:ctc_printer/board_controller.dart';
import 'package:ctc_printer/print_recovery.dart';
import 'package:ctc_printer/printer_controller.dart';
import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:ctc_printer/session_store.dart';
import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/workspace_controller.dart';
import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

ProductionBoard fixture() => boardFixture(
      productionId: 'day-a',
      name: 'Fictional day',
      status: 'active',
      roster: [
        boardEntry(
            orderId: 'order-a',
            personName: 'Alex Example',
            drink: 'Latte',
            group: 'Camera')
      ],
    );

class HeldRepository extends MemoryWorkspaceRepository {
  HeldRepository() : super(boards: {'day-a': fixture()});
  Completer<void>? gate;
  final entered = Completer<void>();
  @override
  Future<ConditionalOrderWrite> updateOrderConditionally(
      {required String productionId,
      required String orderId,
      required String observedUpdatedAt,
      required OrderPatch patch}) async {
    final result = await super.updateOrderConditionally(
        productionId: productionId,
        orderId: orderId,
        observedUpdatedAt: observedUpdatedAt,
        patch: patch);
    if (!entered.isCompleted) entered.complete();
    await gate?.future;
    return result;
  }
}

class HeldSelection extends MemorySelectedDayRepository {
  final gate = Completer<void>();
  @override
  Future<void> write(String userId, String productionId) async {
    await gate.future;
    await super.write(userId, productionId);
  }
}

const sessionA =
    AuthSession(userId: 'user-a', email: 'a@example.test', isExpired: false);

class HeldAuth extends MemoryAuthRepository {
  HeldAuth() : super(restoredSession: sessionA);
  final gate = Completer<AuthSession?>();
  @override
  Future<AuthSession?> refreshSession() => gate.future;
}

class HeldSetup extends MemorySetupRepository {
  final gate = Completer<SetupPerson>();
  @override
  Future<SetupPerson> createPerson(PersonDraft draft) => gate.future;
}

class HeldUsual extends HeldRepository {
  final usualEntered = Completer<void>();
  final usualGate = Completer<void>();
  @override
  Future<UsualOrderWrite> updateUsualOrderConditionally(
      {required String personId,
      required String observedUsualOrder,
      required String desiredUsualOrder}) async {
    final result = await super.updateUsualOrderConditionally(
        personId: personId,
        observedUsualOrder: observedUsualOrder,
        desiredUsualOrder: desiredUsualOrder);
    if (!usualEntered.isCompleted) {
      usualEntered.complete();
      await usualGate.future;
    }
    return result;
  }
}

class HeldLegacyStore extends MemorySessionRepository {
  final gate = Completer<ProductionSession?>();
  @override
  Future<ProductionSession?> read() => gate.future;
}

class CorruptOutbox extends MemoryOrderMutationOutboxRepository {
  @override
  Future<List<OrderMutationRecord>> readAll() async =>
      throw const FormatException('Corrupt recovery');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('stale conflict action cannot discard another accounts pending work',
      () async {
    final repository = HeldRepository();
    final outbox = OrderMutationOutbox(MemoryOrderMutationOutboxRepository());
    await outbox.queueOrderPatch(
        scopeKey: 'user:user-a',
        productionId: 'day-a',
        entry: fixture().roster.single,
        patch: OrderPatch({OrderField.drinkType: 'Tea'}),
        updateUsualOrder: false,
        desiredUsualOrder: 'Tea');
    final board = BoardController(
        repository: repository,
        cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
        outbox: outbox);
    addTearDown(board.dispose);
    await board.activate(userId: 'user-b', productionId: 'day-a');
    await expectLater(board.keepServerVersion('order-a'), throwsStateError);
    expect(outbox['order-a']?.patch, isNotNull);
  });

  test('late legacy restoration cannot replace an authenticated workspace',
      () async {
    final store = HeldLegacyStore();
    final workspace = WorkspaceController(
        repository: HeldRepository(),
        selectedDayRepository: MemorySelectedDayRepository(),
        legacySessionRepository: store,
        legacyCacheRepository: MemoryBoardCacheRepository());
    addTearDown(workspace.dispose);
    final pending = workspace.start();
    await workspace.activateUser('user-b');
    store.gate.complete(const ProductionSession(
        apiBase: 'https://example.test',
        productionId: 'day-a',
        token: 'fictional-token'));
    await pending;
    expect(workspace.mode, WorkspaceMode.authenticated);
    expect(workspace.userId, 'user-b');
  });

  test(
      'corrupt outbox activation reports blocked state without escaping startup',
      () async {
    final repository = HeldRepository();
    final controller = BoardController(
        repository: repository,
        cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
        outbox: OrderMutationOutbox(CorruptOutbox()));
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');
    expect(controller.boardUnavailableReason, isNotNull);
    expect(controller.board, isNull);
    expect(repository.fetchBoardCalls, 0);
  });

  for (final state in PrintRecoveryState.values) {
    for (final printedOnServer in [false, true]) {
      for (final failure in [
        null,
        WorkspaceFailureKind.unreachable,
        WorkspaceFailureKind.unauthorized
      ]) {
        test(
            'replay/restart matrix: $state, server printed=$printedOnServer, failure=$failure',
            () async {
          final repository = HeldRepository();
          final original = fixture();
          repository.boards['day-a'] = original.replaceOrder(original
              .orderById('order-a')!
              .copyWith(
                  drinkType: 'Competing order',
                  updatedAt: '2026-09-09T12:00:00Z',
                  labelPrinted: printedOnServer));
          final durable = MemoryOrderMutationOutboxRepository();
          final outbox = OrderMutationOutbox(durable);
          await outbox.queueOrderPatch(
              scopeKey: 'user:user-a',
              productionId: 'day-a',
              entry: original.roster.single,
              patch: OrderPatch({OrderField.drinkType: 'Local order'}),
              updateUsualOrder: false,
              desiredUsualOrder: 'Local order');
          await outbox.recordPrintRecovery(PrintRecoveryRecord(
              apiBase: 'user:user-a',
              productionId: 'day-a',
              orderId: 'order-a',
              personName: 'Alex Example',
              drink: 'Local order',
              createdAt: DateTime.utc(2026),
              state: state));
          if (failure != null) {
            repository.fetchBoardFailure =
                WorkspaceRepositoryException('injected', kind: failure);
          }
          final board = BoardController(
              repository: repository,
              cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
              outbox: outbox);
          await board.activate(userId: 'user-a', productionId: 'day-a');
          board.dispose();
          final restarted = OrderMutationOutbox(durable);
          await restarted.start();
          final shouldSync =
              failure == null && state == PrintRecoveryState.printedNeedsSync;
          expect(repository.markPrintedCalls, shouldSync ? 1 : 0);
          expect(restarted['order-a']?.printState, shouldSync ? null : state);
          expect(restarted['order-a']?.patch, isNotNull);
          if (failure == null) {
            expect(restarted['order-a']?.conflict, isNotNull);
          }
          expect(repository.boards['day-a']!.orderById('order-a')!.drinkType,
              'Competing order');
        });
      }
    }
  }

  test('newer usual edit rebases onto its own acknowledged in-flight save',
      () async {
    final repository = HeldUsual();
    final board = BoardController(
        repository: repository,
        cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
        outbox: OrderMutationOutbox(MemoryOrderMutationOutboxRepository()));
    addTearDown(board.dispose);
    await board.activate(userId: 'user-a', productionId: 'day-a');
    await board.saveOrder(
        orderId: 'order-a',
        patch: OrderPatch({OrderField.drinkType: 'Tea'}),
        updateUsualOrder: true);
    await repository.usualEntered.future;
    await board.saveOrder(
        orderId: 'order-a',
        patch: OrderPatch({OrderField.drinkType: 'Mocha'}),
        updateUsualOrder: true);
    repository.usualGate.complete();
    await Future<void>.delayed(Duration.zero);
    await board.refresh();
    expect(board.conflictCount, 0);
    expect(board.pendingMutationCount, 0);
    expect(repository.boards['day-a']!.roster.single.person.usualOrder,
        contains('Mocha'));
  });

  test('failed closeout keeps printing blocked until authoritative refresh',
      () async {
    final repository = HeldRepository();
    final board = BoardController(
        repository: repository,
        cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
        outbox: OrderMutationOutbox(MemoryOrderMutationOutboxRepository()));
    addTearDown(board.dispose);
    await board.activate(userId: 'user-a', productionId: 'day-a');
    repository.completeDayFailure = const WorkspaceRepositoryException(
        'response lost',
        kind: WorkspaceFailureKind.unreachable);
    await expectLater(
        board.completeDay(), throwsA(isA<WorkspaceRepositoryException>()));
    repository.fetchBoardFailure = const WorkspaceRepositoryException('offline',
        kind: WorkspaceFailureKind.unreachable);
    await board.refresh();
    expect(board.boardUnavailableReason, isNotNull);
  });

  test('fractional closeout counts cannot validate completion', () async {
    final client =
        SupabaseClient('https://fictional.supabase.co', 'fictional-public-key',
            httpClient: MockClient((request) async => http.Response(
                jsonEncode({
                  'production': {'id': 'day-a', 'status': 'complete'},
                  'not_asked': 0.5,
                  'captured_unprinted': 0
                }),
                200,
                request: request,
                headers: {'content-type': 'application/json'})));
    addTearDown(client.dispose);
    await expectLater(
        SupabaseWorkspaceRepository(client).completeDay(productionId: 'day-a'),
        throwsA(isA<WorkspaceRepositoryException>()
            .having((e) => e.kind, 'kind', WorkspaceFailureKind.invalidData)));
  });

  test('reconciliation cannot clear another accounts print recovery', () async {
    final repository = HeldRepository();
    final initial = fixture();
    repository.boards['day-a'] = initial.replaceOrder(
        initial.orderById('order-a')!.copyWith(labelPrinted: true));
    final outbox = OrderMutationOutbox(MemoryOrderMutationOutboxRepository());
    await outbox.recordPrintRecovery(PrintRecoveryRecord(
        apiBase: 'user:user-a',
        productionId: 'day-a',
        orderId: 'order-a',
        personName: 'Alex Example',
        drink: 'Tea',
        createdAt: DateTime.utc(2026),
        state: PrintRecoveryState.printedNeedsSync));
    final workspace = WorkspaceController(
        repository: repository,
        mutationOutbox: outbox,
        selectedDayRepository: MemorySelectedDayRepository({'user-b': 'day-a'}),
        authenticatedCacheRepository:
            MemoryAuthenticatedBoardCacheRepository());
    addTearDown(workspace.dispose);
    await workspace.activateUser('user-b');
    final printer = PrinterController(
        workspaceController: workspace, mutationOutbox: outbox);
    addTearDown(printer.dispose);
    await printer.start();
    expect(outbox['order-a']?.printState, PrintRecoveryState.printedNeedsSync);
  });

  test('server cleanup cannot erase uncertainty at the storage boundary',
      () async {
    final record = PrintRecoveryRecord(
        apiBase: 'user:user-a',
        productionId: 'day-a',
        orderId: 'order-a',
        personName: 'Alex Example',
        drink: 'Tea',
        createdAt: DateTime.utc(2026),
        state: PrintRecoveryState.uncertain);
    final outbox = OrderMutationOutbox(MemoryOrderMutationOutboxRepository());
    await outbox.recordPrintRecovery(record);
    final legacy = PrintRecoveryLedger(MemoryPrintRecoveryRepository());
    await legacy.record(record);
    for (final ledger in [legacy, SharedPrintRecoveryLedger(outbox)]) {
      await ledger.clearServerConfirmed(['order-a']);
      expect(ledger['order-a']?.state, PrintRecoveryState.uncertain);
    }
  });

  test('refusal remains blocked across cached offline reactivation', () async {
    final repository = HeldRepository();
    final cache = MemoryAuthenticatedBoardCacheRepository();
    BoardController make() => BoardController(
        repository: repository,
        cacheRepository: cache,
        outbox: OrderMutationOutbox(MemoryOrderMutationOutboxRepository()));
    final first = make();
    await first.activate(userId: 'user-a', productionId: 'day-a');
    repository.fetchBoardFailure = const WorkspaceRepositoryException('refused',
        kind: WorkspaceFailureKind.unauthorized);
    await first.refresh();
    first.dispose();
    repository.fetchBoardFailure = const WorkspaceRepositoryException('offline',
        kind: WorkspaceFailureKind.unreachable);
    final restarted = make();
    addTearDown(restarted.dispose);
    await restarted.activate(userId: 'user-a', productionId: 'day-a');
    expect(restarted.boardUnavailableReason, 'refused');
  });

  test('setup completion after clear cannot restore private people', () async {
    final repository = HeldSetup();
    final setup = SetupController(repository);
    addTearDown(setup.dispose);
    final pending = setup.createPerson(const PersonDraft(name: 'Alex Example'));
    setup.clear();
    repository.gate.complete(await MemorySetupRepository()
        .createPerson(const PersonDraft(name: 'Alex Example')));
    expect(await pending, isNull);
    expect(setup.people, isEmpty);
  });

  test('late refresh cannot restore a signed-out session', () async {
    final repository = HeldAuth();
    final session = SessionController(repository);
    addTearDown(session.dispose);
    addTearDown(repository.dispose);
    await session.start();
    final pending = session.refresh();
    await session.signOut();
    repository.gate.complete(sessionA);
    await pending;
    expect(session.isSignedIn, isFalse);
  });

  test('explicit invalid-session refusal disables cached work', () async {
    final repository = MemoryAuthRepository(
        restoredSession: sessionA,
        refreshFailure: const AuthRepositoryException('revoked',
            kind: AuthFailureKind.invalidSession));
    final session = SessionController(repository);
    addTearDown(session.dispose);
    addTearDown(repository.dispose);
    await session.start();
    await session.refresh();
    expect(session.isSignedIn, isFalse);
  });

  test('template RPC auth refusal is not a successful fallback board',
      () async {
    final client =
        SupabaseClient('https://fictional.supabase.co', 'fictional-public-key',
            httpClient: MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/productions')) {
        return http.Response(jsonEncode(fixture().production.toJson()), 200,
            request: request, headers: {'content-type': 'application/json'});
      }
      if (path.contains('/rpc/')) {
        return http.Response(
            jsonEncode({'code': 'PGRST301', 'message': 'JWT expired'}), 401,
            request: request, headers: {'content-type': 'application/json'});
      }
      return http.Response('[]', 200,
          request: request, headers: {'content-type': 'application/json'});
    }));
    addTearDown(client.dispose);
    await expectLater(
        SupabaseWorkspaceRepository(client).fetchBoard('day-a'),
        throwsA(isA<WorkspaceRepositoryException>()
            .having((e) => e.kind, 'kind', WorkspaceFailureKind.unauthorized)));
  });

  test('late selected-day persistence cannot reactivate a signed-out board',
      () async {
    final selection = HeldSelection();
    final workspace = WorkspaceController(
        repository: HeldRepository(),
        selectedDayRepository: selection,
        authenticatedCacheRepository:
            MemoryAuthenticatedBoardCacheRepository());
    addTearDown(workspace.dispose);
    await workspace.activateUser('user-a');
    final pending = workspace.selectDay('day-a');
    workspace.deactivateUser();
    selection.gate.complete();
    expect(await pending, isFalse);
    expect(workspace.authenticatedBoard.userId, isNull);
    expect(workspace.authenticatedBoard.board, isNull);
  });

  for (final switchUser in [false, true]) {
    test(
        'held replay preserves ${switchUser ? 'account boundary' : 'newer local edit'}',
        () async {
      final repository = HeldRepository()..gate = Completer<void>();
      final outbox = OrderMutationOutbox(MemoryOrderMutationOutboxRepository());
      final controller = BoardController(
          repository: repository,
          cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
          outbox: outbox);
      addTearDown(controller.dispose);
      await controller.activate(userId: 'user-a', productionId: 'day-a');
      await controller.saveOrder(
          orderId: 'order-a',
          patch: OrderPatch({OrderField.drinkType: 'Tea'}),
          updateUsualOrder: false);
      await repository.entered.future;
      if (switchUser) {
        final current = repository.boards['day-a']!;
        repository.boards['day-a'] = current.replaceOrder(current
            .orderById('order-a')!
            .copyWith(drinkType: 'New account snapshot'));
        await controller.activate(userId: 'user-b', productionId: 'day-a');
      } else {
        await controller.saveOrder(
            orderId: 'order-a',
            patch: OrderPatch({OrderField.drinkType: 'Mocha'}),
            updateUsualOrder: false);
      }
      repository.gate!.complete();
      await Future<void>.delayed(Duration.zero);
      if (switchUser) {
        expect(controller.board!.orderById('order-a')!.drinkType,
            'New account snapshot');
        expect(outbox['order-a']?.patch, isNotNull,
            reason: 'Stale response cannot retire original-account intent');
      } else {
        await controller.refresh();
        expect(repository.boards['day-a']!.orderById('order-a')!.drinkType,
            'Mocha');
      }
    });
  }

  test('write refusal blocks stale work and stops print-fact replay', () async {
    final repository = HeldRepository();
    final outbox = OrderMutationOutbox(MemoryOrderMutationOutboxRepository());
    final controller = BoardController(
        repository: repository,
        cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
        outbox: outbox);
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');
    await outbox.queueOrderPatch(
        scopeKey: 'user:user-a',
        productionId: 'day-a',
        entry: fixture().roster.single,
        patch: OrderPatch({OrderField.drinkType: 'Tea'}),
        updateUsualOrder: false,
        desiredUsualOrder: 'Tea');
    await outbox.recordPrintRecovery(PrintRecoveryRecord(
        apiBase: 'user:user-a',
        productionId: 'day-a',
        orderId: 'order-a',
        personName: 'Alex Example',
        drink: 'Tea',
        createdAt: DateTime.utc(2026),
        state: PrintRecoveryState.printedNeedsSync));
    repository.updateOrderFailure = const WorkspaceRepositoryException(
        'refused',
        kind: WorkspaceFailureKind.unauthorized);
    await controller.refresh();
    expect(controller.boardUnavailableReason, 'refused');
    expect(repository.markPrintedCalls, 0);
    await expectLater(controller.markNoDrink('order-a'), throwsStateError);
  });

  test('stale server printed flag cannot acknowledge a refused sync', () async {
    final repository = HeldRepository();
    final initial = fixture();
    repository.boards['day-a'] = initial.replaceOrder(
        initial.orderById('order-a')!.copyWith(labelPrinted: true));
    final outbox = OrderMutationOutbox(MemoryOrderMutationOutboxRepository());
    final controller = BoardController(
        repository: repository,
        cacheRepository: MemoryAuthenticatedBoardCacheRepository(),
        outbox: outbox);
    addTearDown(controller.dispose);
    await controller.activate(userId: 'user-a', productionId: 'day-a');
    await outbox.recordPrintRecovery(PrintRecoveryRecord(
        apiBase: 'user:user-a',
        productionId: 'day-a',
        orderId: 'order-a',
        personName: 'Alex Example',
        drink: 'Tea',
        createdAt: DateTime.utc(2026),
        state: PrintRecoveryState.printedNeedsSync));
    repository.fetchBoardFailure = const WorkspaceRepositoryException('refused',
        kind: WorkspaceFailureKind.unauthorized);
    await expectLater(controller.ensureLabelPrinted('order-a'),
        throwsA(isA<WorkspaceRepositoryException>()));
    expect(outbox['order-a']?.printState, PrintRecoveryState.printedNeedsSync);
  });
}
