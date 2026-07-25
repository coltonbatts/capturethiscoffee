import 'dart:async';

import 'package:flutter/foundation.dart';

import 'authenticated_workspace_cache.dart';
import 'drink_format.dart';
import 'print_recovery.dart';
import 'production_board.dart';
import 'usual_order.dart';
import 'workspace_repository.dart';

const _realtimeRefreshDebounce = Duration(milliseconds: 250);

/// Owns the selected authenticated day board and every offline order intent.
///
/// WorkspaceController keeps day selection and the Legacy link fallback. This
/// controller is the one truth used by Collect, Print, progress, cache,
/// Realtime-triggered pulls, and replay.
class BoardController extends ChangeNotifier {
  BoardController({
    required this.repository,
    required this.cacheRepository,
    required this.outbox,
  });

  final WorkspaceRepository? repository;
  final AuthenticatedBoardCacheRepository cacheRepository;
  final OrderMutationOutbox outbox;

  String? _userId;
  String? _productionId;
  ProductionBoard? _serverBoard;
  ProductionBoard? _board;
  PrinterQueue? _queue;
  DateTime? _lastSyncedAt;
  bool _servingCachedBoard = false;
  bool _busy = false;
  bool _disposed = false;
  String? _error;
  String? _boardUnavailableReason;
  String? _syncBlockedReason;
  Future<void>? _refreshFuture;
  StreamSubscription<void>? _realtimeSubscription;
  Timer? _realtimeDebounce;
  int _generation = 0;

  String? get userId => _userId;
  String? get productionId => _productionId;
  String? get scopeKey => _userId == null ? null : 'user:${_userId!}';
  ProductionBoard? get board => _board;
  PrinterQueue? get queue => _queue;
  DateTime? get lastSyncedAt => _lastSyncedAt;
  bool get servingCachedBoard => _servingCachedBoard;
  bool get busy => _busy;
  String? get error => _error;
  String? get boardUnavailableReason => _boardUnavailableReason;
  String? get syncBlockedReason => _syncBlockedReason;
  bool get hasBoard => _board != null && _queue != null;

  List<OrderMutationRecord> get currentMutations {
    final scope = scopeKey;
    final production = _productionId;
    if (scope == null || production == null) return const [];
    return outbox.forScope(scopeKey: scope, productionId: production);
  }

  int get pendingMutationCount => currentMutations.length;
  int get conflictCount =>
      currentMutations.where((record) => record.conflict != null).length;
  bool get hasPendingMutations => pendingMutationCount > 0;

  OrderMutationRecord? mutationFor(String orderId) {
    final record = outbox[orderId];
    if (record == null ||
        record.scopeKey != scopeKey ||
        record.productionId != _productionId) {
      return null;
    }
    return record;
  }

  Future<void> start() => outbox.start();

  Future<void> activate({
    required String userId,
    required String productionId,
  }) async {
    final generation = ++_generation;
    _refreshFuture = null;
    await start();
    await _cancelRealtime();
    _userId = userId;
    _productionId = productionId;
    _clearBoard();
    _error = null;
    _emit();

    try {
      final cached = await cacheRepository.read(
        userId: userId,
        productionId: productionId,
      );
      if (!_isCurrent(generation, userId, productionId)) return;
      if (cached != null) {
        _serverBoard = cached.board;
        _lastSyncedAt = cached.syncedAt;
        _servingCachedBoard = true;
        _publishOverlay();
      }
    } catch (_) {
      // A cache failure only degrades this cold start.
    }

    _subscribeToRealtime(generation, userId, productionId);
    await refresh(silent: true);
  }

  void deactivate() {
    ++_generation;
    _refreshFuture = null;
    unawaited(_cancelRealtime());
    _userId = null;
    _productionId = null;
    _clearBoard();
    _busy = false;
    _error = null;
    _emit();
  }

  Future<void> refresh({bool silent = false}) {
    final current = _refreshFuture;
    if (current != null) return current;
    final future = _refresh(silent: silent);
    _refreshFuture = future;
    return future.whenComplete(() {
      if (identical(_refreshFuture, future)) _refreshFuture = null;
    });
  }

  Future<void> _refresh({required bool silent}) async {
    final repository = this.repository;
    final userId = _userId;
    final productionId = _productionId;
    if (repository == null || userId == null || productionId == null) return;
    final generation = _generation;
    if (!silent) {
      _busy = true;
      _error = null;
      _emit();
    }

    try {
      // Status is refreshed before replay. Authenticated RLS permits writes to
      // complete days, so the product guard must be based on an authoritative
      // production snapshot rather than the cached active status.
      var incoming = await repository.fetchBoard(productionId);
      if (!_isCurrent(generation, userId, productionId)) return;
      _applyServerBoard(incoming);
      _error = null;

      if (incoming.production.isActive) {
        _syncBlockedReason = null;
        final replayed = await _replayActiveBoard(repository);
        if (!_isCurrent(generation, userId, productionId)) return;
        if (replayed) {
          incoming = await repository.fetchBoard(productionId);
          if (!_isCurrent(generation, userId, productionId)) return;
          _applyServerBoard(incoming);
        }
      } else if (hasPendingMutations) {
        _syncBlockedReason =
            'This day is ${incoming.production.status}. Pending changes are '
            'kept on this phone and will not replay until the day is Active.';
      } else {
        _syncBlockedReason = null;
      }

      _lastSyncedAt = DateTime.now();
      _servingCachedBoard = false;
      _boardUnavailableReason = null;
      _publishOverlay();
      await _writeCache(userId, productionId);
    } on WorkspaceRepositoryException catch (error) {
      if (!_isCurrent(generation, userId, productionId)) return;
      _error = error.message;
      if (_board != null) _servingCachedBoard = true;
      if (error.kind == WorkspaceFailureKind.notFound ||
          error.kind == WorkspaceFailureKind.unauthorized) {
        _boardUnavailableReason = error.message;
      }
      _publishOverlay();
    } catch (error) {
      if (!_isCurrent(generation, userId, productionId)) return;
      _error = _errorText(error);
      if (_board != null) _servingCachedBoard = true;
      _publishOverlay();
    } finally {
      if (!silent && _isCurrent(generation, userId, productionId)) {
        _busy = false;
        _emit();
      }
    }
  }

  Future<bool> _replayActiveBoard(WorkspaceRepository repository) async {
    var changedServer = false;
    final records = List<OrderMutationRecord>.of(currentMutations);
    for (final initial in records) {
      var record = mutationFor(initial.orderId);
      if (record == null) continue;

      if (record.hasOrdinaryIntent && record.conflict == null) {
        try {
          if (!record.orderApplied) {
            final result = await repository.updateOrderConditionally(
              productionId: record.productionId,
              orderId: record.orderId,
              observedUpdatedAt: record.observedUpdatedAt,
              patch: record.patch!,
            );
            switch (result.status) {
              case ConditionalWriteStatus.saved:
                final saved = result.order!;
                _serverBoard = _serverBoard?.replaceOrder(saved);
                await outbox.markOrderApplied(record.orderId, saved);
                changedServer = true;
                break;
              case ConditionalWriteStatus.missing:
                await outbox.markConflict(
                  record.orderId,
                  const OrderMutationConflict(
                    kind: OrderMutationConflictKind.missing,
                    message:
                        'This order no longer exists. The local change was not uploaded.',
                  ),
                );
                break;
              case ConditionalWriteStatus.conflict:
                final server = result.order!;
                _serverBoard = _serverBoard?.replaceOrder(server);
                final desired = <OrderField, String>{
                  ...record.baseValues,
                  ...record.patch!.values,
                };
                if (OrderPatch.snapshotMatches(server, desired)) {
                  // The prior request committed but its response was lost.
                  await outbox.markOrderApplied(record.orderId, server);
                } else if (OrderPatch.snapshotMatches(
                  server,
                  record.baseValues,
                )) {
                  // Only a non-ordinary fact (normally label_printed) advanced
                  // updated_at. Rebase without hiding a semantic edit.
                  await outbox.rebasePendingOrder(record.orderId, server);
                  final retried = await repository.updateOrderConditionally(
                    productionId: record.productionId,
                    orderId: record.orderId,
                    observedUpdatedAt: server.updatedAt,
                    patch: record.patch!,
                  );
                  if (retried.status == ConditionalWriteStatus.saved) {
                    final saved = retried.order!;
                    _serverBoard = _serverBoard?.replaceOrder(saved);
                    await outbox.markOrderApplied(record.orderId, saved);
                    changedServer = true;
                  } else {
                    final current = retried.order;
                    if (current != null) {
                      _serverBoard = _serverBoard?.replaceOrder(current);
                    }
                    await outbox.markConflict(
                      record.orderId,
                      OrderMutationConflict(
                        kind: OrderMutationConflictKind.order,
                        message:
                            'This order changed on another device. Review both versions before choosing one.',
                        serverOrder: current ?? server,
                      ),
                    );
                  }
                } else {
                  await outbox.markConflict(
                    record.orderId,
                    OrderMutationConflict(
                      kind: OrderMutationConflictKind.order,
                      message:
                          'This order changed on another device. Review both versions before choosing one.',
                      serverOrder: server,
                    ),
                  );
                }
                break;
            }
          }

          record = mutationFor(initial.orderId);
          if (record != null &&
              record.orderApplied &&
              record.conflict == null) {
            if (record.updateUsualOrder) {
              final usual = await repository.updateUsualOrderConditionally(
                personId: record.personId,
                observedUsualOrder: record.observedUsualOrder,
                desiredUsualOrder: record.desiredUsualOrder,
              );
              if (usual.status == ConditionalWriteStatus.saved) {
                _serverBoard = _serverBoard?.replacePersonUsual(
                  record.personId,
                  usual.serverValue,
                );
                await outbox.discardOrdinaryIntent(record.orderId);
                changedServer = true;
              } else {
                await outbox.markConflict(
                  record.orderId,
                  OrderMutationConflict(
                    kind: usual.status == ConditionalWriteStatus.missing
                        ? OrderMutationConflictKind.missing
                        : OrderMutationConflictKind.usualOrder,
                    message: usual.status == ConditionalWriteStatus.missing
                        ? 'This person no longer exists. The usual order was not updated.'
                        : 'This person’s usual changed on another device. Review it before overwriting.',
                    serverUsualOrder: usual.serverValue,
                  ),
                );
              }
            } else {
              await outbox.discardOrdinaryIntent(record.orderId);
            }
          }
        } on WorkspaceRepositoryException catch (error) {
          _error = error.message;
        }
      }

      // A confirmed physical print is independent from ordinary drink fields.
      // It still replays when those fields have stopped on a conflict.
      record = mutationFor(initial.orderId);
      if (record?.printState == PrintRecoveryState.printedNeedsSync) {
        try {
          final saved = await repository.markLabelPrinted(
            productionId: record!.productionId,
            orderId: record.orderId,
          );
          _serverBoard = _serverBoard?.replaceOrder(saved);
          await outbox.updateConflictServerOrder(record.orderId, saved);
          await outbox.clearPrintIntent(record.orderId);
          changedServer = true;
        } on WorkspaceRepositoryException catch (error) {
          _error = error.message;
        }
      }
      _publishOverlay();
    }
    return changedServer;
  }

  Future<void> saveOrder({
    required String orderId,
    required OrderPatch patch,
    required bool updateUsualOrder,
  }) async {
    final board = _board;
    final scope = scopeKey;
    final productionId = _productionId;
    final entry = board?.entryByOrderId(orderId);
    if (board == null ||
        scope == null ||
        productionId == null ||
        entry == null ||
        entry.order == null) {
      throw StateError('This roster entry has no editable order.');
    }
    final optimistic = patch.apply(entry.order!);
    final desiredUsual = formatDrink(optimistic);
    await outbox.queueOrderPatch(
      scopeKey: scope,
      productionId: productionId,
      entry: entry,
      patch: patch,
      updateUsualOrder: updateUsualOrder,
      desiredUsualOrder: desiredUsual,
    );
    _publishOverlay();
    unawaited(refresh(silent: true));
  }

  Future<void> acceptUsual(String orderId) async {
    final entry = _board?.entryByOrderId(orderId);
    final order = entry?.order;
    if (entry == null || order == null) {
      throw StateError('This person has no order record.');
    }
    final usual = entry.person.usualOrder.trim();
    await saveOrder(
      orderId: orderId,
      patch: usual.isEmpty
          ? OrderPatch.capture(order)
          : parseUsualOrderPatch(usual),
      updateUsualOrder: false,
    );
  }

  Future<void> markNoDrink(String orderId) => saveOrder(
        orderId: orderId,
        patch: OrderPatch.noDrink(),
        updateUsualOrder: false,
      );

  Future<void> retryConflict(String orderId) async {
    await outbox.retryConflict(orderId);
    _publishOverlay();
    await refresh();
  }

  Future<void> keepServerVersion(String orderId) async {
    await outbox.discardOrdinaryIntent(orderId);
    _publishOverlay();
    await refresh();
  }

  /// Called after the printer has durably recorded printedNeedsSync.
  Future<void> ensureLabelPrinted(String orderId) async {
    final repository = this.repository;
    final productionId = _productionId;
    if (repository == null || productionId == null) {
      throw StateError('No authenticated day is selected.');
    }
    final record = mutationFor(orderId);
    if (record?.printState == PrintRecoveryState.printedNeedsSync) {
      await refresh();
    } else {
      final saved = await repository.markLabelPrinted(
        productionId: productionId,
        orderId: orderId,
      );
      _serverBoard = _serverBoard?.replaceOrder(saved);
      _publishOverlay();
      await _writeCache(_userId!, productionId);
    }
    if (!isPrintServerConfirmed(orderId)) {
      throw const WorkspaceRepositoryException(
        'The physical print is still waiting to sync.',
        kind: WorkspaceFailureKind.unreachable,
      );
    }
  }

  bool isPrintServerConfirmed(String orderId) {
    return _serverBoard?.orderById(orderId)?.labelPrinted == true;
  }

  void dismissError() {
    if (_error == null) return;
    _error = null;
    _emit();
  }

  void _applyServerBoard(ProductionBoard board) {
    _serverBoard = board;
    _publishOverlay();
  }

  void _publishOverlay() {
    var next = _serverBoard;
    if (next != null) {
      for (final mutation in currentMutations) {
        final serverOrder = next!.orderById(mutation.orderId);
        if (serverOrder != null) {
          var order = serverOrder;
          final patch = mutation.patch;
          if (patch != null) order = patch.apply(order);
          if (mutation.printState == PrintRecoveryState.printedNeedsSync) {
            order = order.copyWith(labelPrinted: true);
          }
          next = next.replaceOrder(order);
        }
        if (mutation.patch != null && mutation.updateUsualOrder) {
          next = next.replacePersonUsual(
            mutation.personId,
            mutation.desiredUsualOrder,
          );
        }
      }
    }
    _board = next;
    _queue = next == null ? null : PrinterQueue.fromBoard(next);
    _emit();
  }

  Future<void> _writeCache(String userId, String productionId) async {
    final serverBoard = _serverBoard;
    final syncedAt = _lastSyncedAt;
    if (serverBoard == null || syncedAt == null) return;
    try {
      await cacheRepository.write(AuthenticatedCachedBoard(
        userId: userId,
        productionId: productionId,
        syncedAt: syncedAt,
        board: serverBoard,
      ));
    } catch (_) {
      // The durable outbox remains authoritative for local intent. A cache
      // failure only means the next cold start may lack the base snapshot.
    }
  }

  void _subscribeToRealtime(
    int generation,
    String userId,
    String productionId,
  ) {
    final repository = this.repository;
    if (repository == null) return;
    try {
      _realtimeSubscription =
          repository.watchOrderChanges(productionId).listen((_) {
        if (!_isCurrent(generation, userId, productionId)) return;
        _realtimeDebounce?.cancel();
        _realtimeDebounce = Timer(_realtimeRefreshDebounce, () {
          if (_isCurrent(generation, userId, productionId)) {
            unawaited(refresh(silent: true));
          }
        });
      });
    } catch (_) {
      // Polling, resume, pull-to-refresh, and explicit sync remain available.
    }
  }

  Future<void> _cancelRealtime() async {
    _realtimeDebounce?.cancel();
    _realtimeDebounce = null;
    final subscription = _realtimeSubscription;
    _realtimeSubscription = null;
    await subscription?.cancel();
  }

  bool _isCurrent(int generation, String userId, String productionId) =>
      !_disposed &&
      generation == _generation &&
      _userId == userId &&
      _productionId == productionId;

  void _clearBoard() {
    _serverBoard = null;
    _board = null;
    _queue = null;
    _lastSyncedAt = null;
    _servingCachedBoard = false;
    _boardUnavailableReason = null;
    _syncBlockedReason = null;
  }

  String _errorText(Object error) {
    final text = error.toString();
    return text.startsWith('Exception: ')
        ? text.substring('Exception: '.length)
        : text;
  }

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    unawaited(_cancelRealtime());
    super.dispose();
  }
}
