import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'production_board.dart';
import 'workspace_models.dart';

enum WorkspaceFailureKind {
  unreachable,
  unauthorized,
  notFound,
  invalidData,
  other,
}

class WorkspaceRepositoryException implements Exception {
  const WorkspaceRepositoryException(this.message, {required this.kind});

  final String message;
  final WorkspaceFailureKind kind;

  @override
  String toString() => message;
}

abstract interface class WorkspaceRepository {
  Future<List<DaySummary>> fetchDays();

  Future<ProductionBoard> fetchBoard(String productionId);

  Future<ConditionalOrderWrite> updateOrderConditionally({
    required String productionId,
    required String orderId,
    required String observedUpdatedAt,
    required OrderPatch patch,
  });

  Future<UsualOrderWrite> updateUsualOrderConditionally({
    required String personId,
    required String observedUsualOrder,
    required String desiredUsualOrder,
  });

  Future<BoardOrder> markLabelPrinted({
    required String productionId,
    required String orderId,
  });

  Stream<void> watchOrderChanges(String productionId);
}

enum ConditionalWriteStatus {
  saved,
  conflict,
  missing,
}

class ConditionalOrderWrite {
  const ConditionalOrderWrite(this.status, {this.order});

  final ConditionalWriteStatus status;
  final BoardOrder? order;
}

class UsualOrderWrite {
  const UsualOrderWrite(this.status, {required this.serverValue});

  final ConditionalWriteStatus status;
  final String serverValue;
}

class SupabaseWorkspaceRepository implements WorkspaceRepository {
  SupabaseWorkspaceRepository(this._client);

  final SupabaseClient _client;

  static const _productionColumns =
      'id,name,client_id,shoot_date,location,runner_name,status,created_at';
  static const _clientColumns = 'id,name';
  static const _rosterColumns =
      'id,production_id,person_id,group_label,on_set_today,sort_order';
  static const _personColumns =
      'id,name,role,department,company,photo_url,usual_order';
  static const _orderColumns =
      'id,production_id,roster_id,person_id,drink_type,size,temperature,'
      'milk_type,sweetener,caffeine,special_notes,vendor,status,label_printed,'
      'updated_at';

  @override
  Future<List<DaySummary>> fetchDays() async {
    try {
      final result = await _client.rpc('fetch_day_summaries');
      return daySummariesFromRpc(result);
    } on PostgrestException {
      throw const WorkspaceRepositoryException(
        'Could not load days from the workspace.',
        kind: WorkspaceFailureKind.other,
      );
    } on FormatException {
      throw const WorkspaceRepositoryException(
        'The workspace returned invalid day data.',
        kind: WorkspaceFailureKind.invalidData,
      );
    } on WorkspaceRepositoryException {
      rethrow;
    } catch (_) {
      throw const WorkspaceRepositoryException(
        'Could not reach the workspace. Cached work remains available.',
        kind: WorkspaceFailureKind.unreachable,
      );
    }
  }

  @override
  Future<ProductionBoard> fetchBoard(String productionId) async {
    try {
      final productionValue = await _client
          .from('productions')
          .select(_productionColumns)
          .eq('id', productionId)
          .maybeSingle();
      if (productionValue == null) {
        throw const WorkspaceRepositoryException(
          'This day is no longer available.',
          kind: WorkspaceFailureKind.notFound,
        );
      }
      final production = _row(productionValue);
      final clientId = production['client_id']?.toString() ?? '';
      final clientValue = clientId.isEmpty
          ? null
          : await _client
              .from('clients')
              .select(_clientColumns)
              .eq('id', clientId)
              .maybeSingle();
      final roster = _rows(await _client
          .from('production_roster')
          .select(_rosterColumns)
          .eq('production_id', productionId)
          .order('sort_order', ascending: true));
      final orders = _rows(await _client
          .from('orders')
          .select(_orderColumns)
          .eq('production_id', productionId)
          .order('updated_at', ascending: true));
      final personIds = roster
          .map((row) => row['person_id']?.toString())
          .whereType<String>()
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();
      final people = personIds.isEmpty
          ? <Map<String, dynamic>>[]
          : _rows(await _client
              .from('people')
              .select(_personColumns)
              .inFilter('id', personIds));

      return ProductionBoardRowAdapter.fromRows(
        production: production,
        client: clientValue == null ? null : _row(clientValue),
        roster: roster,
        people: people,
        orders: orders,
      );
    } on WorkspaceRepositoryException {
      rethrow;
    } on PostgrestException {
      throw const WorkspaceRepositoryException(
        'The signed-in workspace refused this day.',
        kind: WorkspaceFailureKind.unauthorized,
      );
    } on FormatException {
      throw const WorkspaceRepositoryException(
        'The workspace returned invalid board data.',
        kind: WorkspaceFailureKind.invalidData,
      );
    } catch (_) {
      throw const WorkspaceRepositoryException(
        'Could not reach the workspace. The cached day is still available.',
        kind: WorkspaceFailureKind.unreachable,
      );
    }
  }

  @override
  Future<BoardOrder> markLabelPrinted({
    required String productionId,
    required String orderId,
  }) async {
    try {
      final updated = await _client
          .from('orders')
          .update({'label_printed': true})
          .eq('id', orderId)
          .eq('production_id', productionId)
          .eq('label_printed', false)
          .select(_orderColumns)
          .maybeSingle();
      if (updated != null) return BoardOrder.fromJson(_row(updated));

      final current = await _client
          .from('orders')
          .select(_orderColumns)
          .eq('id', orderId)
          .eq('production_id', productionId)
          .maybeSingle();
      if (current == null || _row(current)['label_printed'] != true) {
        throw const WorkspaceRepositoryException(
          'The printed label could not be verified on the server.',
          kind: WorkspaceFailureKind.notFound,
        );
      }
      return BoardOrder.fromJson(_row(current));
    } on WorkspaceRepositoryException {
      rethrow;
    } on PostgrestException {
      throw const WorkspaceRepositoryException(
        'The signed-in workspace refused the printed-label update.',
        kind: WorkspaceFailureKind.unauthorized,
      );
    } catch (_) {
      throw const WorkspaceRepositoryException(
        'Could not sync the printed label. Do not reprint it.',
        kind: WorkspaceFailureKind.unreachable,
      );
    }
  }

  @override
  Future<ConditionalOrderWrite> updateOrderConditionally({
    required String productionId,
    required String orderId,
    required String observedUpdatedAt,
    required OrderPatch patch,
  }) async {
    try {
      final updated = await _client
          .from('orders')
          .update(patch.toColumns())
          .eq('id', orderId)
          .eq('production_id', productionId)
          .eq('updated_at', observedUpdatedAt)
          .select(_orderColumns)
          .maybeSingle();
      if (updated != null) {
        return ConditionalOrderWrite(
          ConditionalWriteStatus.saved,
          order: BoardOrder.fromJson(_row(updated)),
        );
      }

      final current = await _client
          .from('orders')
          .select(_orderColumns)
          .eq('id', orderId)
          .eq('production_id', productionId)
          .maybeSingle();
      if (current == null) {
        return const ConditionalOrderWrite(ConditionalWriteStatus.missing);
      }
      return ConditionalOrderWrite(
        ConditionalWriteStatus.conflict,
        order: BoardOrder.fromJson(_row(current)),
      );
    } on PostgrestException {
      throw const WorkspaceRepositoryException(
        'The signed-in workspace refused the order update.',
        kind: WorkspaceFailureKind.unauthorized,
      );
    } on FormatException {
      throw const WorkspaceRepositoryException(
        'The workspace returned invalid order data.',
        kind: WorkspaceFailureKind.invalidData,
      );
    } catch (_) {
      throw const WorkspaceRepositoryException(
        'Could not sync this order. The local change remains queued.',
        kind: WorkspaceFailureKind.unreachable,
      );
    }
  }

  @override
  Future<UsualOrderWrite> updateUsualOrderConditionally({
    required String personId,
    required String observedUsualOrder,
    required String desiredUsualOrder,
  }) async {
    try {
      final currentValue = await _client
          .from('people')
          .select('usual_order')
          .eq('id', personId)
          .maybeSingle();
      if (currentValue == null) {
        return const UsualOrderWrite(
          ConditionalWriteStatus.missing,
          serverValue: '',
        );
      }
      final currentRow = _row(currentValue);
      final rawCurrent = currentRow['usual_order'];
      final current = rawCurrent?.toString() ?? '';
      if (current == desiredUsualOrder) {
        return UsualOrderWrite(
          ConditionalWriteStatus.saved,
          serverValue: current,
        );
      }
      if (current != observedUsualOrder) {
        return UsualOrderWrite(
          ConditionalWriteStatus.conflict,
          serverValue: current,
        );
      }

      final update = _client
          .from('people')
          .update({'usual_order': desiredUsualOrder}).eq('id', personId);
      final saved = rawCurrent == null
          ? await update
              .isFilter('usual_order', null)
              .select('usual_order')
              .maybeSingle()
          : await update
              .eq('usual_order', rawCurrent)
              .select('usual_order')
              .maybeSingle();
      if (saved != null) {
        return UsualOrderWrite(
          ConditionalWriteStatus.saved,
          serverValue:
              _row(saved)['usual_order']?.toString() ?? desiredUsualOrder,
        );
      }

      final latest = await _client
          .from('people')
          .select('usual_order')
          .eq('id', personId)
          .maybeSingle();
      if (latest == null) {
        return const UsualOrderWrite(
          ConditionalWriteStatus.missing,
          serverValue: '',
        );
      }
      return UsualOrderWrite(
        ConditionalWriteStatus.conflict,
        serverValue: _row(latest)['usual_order']?.toString() ?? '',
      );
    } on PostgrestException {
      throw const WorkspaceRepositoryException(
        'The signed-in workspace refused the usual-order update.',
        kind: WorkspaceFailureKind.unauthorized,
      );
    } catch (_) {
      throw const WorkspaceRepositoryException(
        'Could not sync the usual order. The local change remains queued.',
        kind: WorkspaceFailureKind.unreachable,
      );
    }
  }

  @override
  Stream<void> watchOrderChanges(String productionId) {
    late final RealtimeChannel channel;
    late final StreamController<void> controller;
    controller = StreamController<void>(
      onListen: () {
        channel = _client
            .channel('mobile-production-orders:$productionId')
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'orders',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'production_id',
                value: productionId,
              ),
              callback: (_) => controller.add(null),
            )
            .subscribe();
      },
      onCancel: () async {
        await _client.removeChannel(channel);
      },
    );
    return controller.stream;
  }
}

class MemoryWorkspaceRepository implements WorkspaceRepository {
  MemoryWorkspaceRepository({
    List<DaySummary> days = const [],
    Map<String, ProductionBoard> boards = const {},
    this.fetchDaysFailure,
    this.fetchBoardFailure,
    this.markPrintedFailure,
    this.updateOrderFailure,
    this.updateUsualFailure,
  })  : days = List.of(days),
        boards = Map.of(boards);

  List<DaySummary> days;
  Map<String, ProductionBoard> boards;
  WorkspaceRepositoryException? fetchDaysFailure;
  WorkspaceRepositoryException? fetchBoardFailure;
  WorkspaceRepositoryException? markPrintedFailure;
  WorkspaceRepositoryException? updateOrderFailure;
  WorkspaceRepositoryException? updateUsualFailure;
  int fetchDaysCalls = 0;
  int fetchBoardCalls = 0;
  int markPrintedCalls = 0;
  int conditionalOrderCalls = 0;
  int usualOrderCalls = 0;
  final List<String> loadedProductionIds = [];
  final StreamController<void> _orderSignals =
      StreamController<void>.broadcast();
  int _revision = 0;

  @override
  Future<List<DaySummary>> fetchDays() async {
    fetchDaysCalls += 1;
    final failure = fetchDaysFailure;
    if (failure != null) throw failure;
    return List.unmodifiable(days);
  }

  @override
  Future<ProductionBoard> fetchBoard(String productionId) async {
    fetchBoardCalls += 1;
    loadedProductionIds.add(productionId);
    final failure = fetchBoardFailure;
    if (failure != null) throw failure;
    final board = boards[productionId];
    if (board == null) {
      throw const WorkspaceRepositoryException(
        'Day not found.',
        kind: WorkspaceFailureKind.notFound,
      );
    }
    return board;
  }

  @override
  Future<BoardOrder> markLabelPrinted({
    required String productionId,
    required String orderId,
  }) async {
    markPrintedCalls += 1;
    final failure = markPrintedFailure;
    if (failure != null) throw failure;
    final board = boards[productionId];
    final order = board?.orderById(orderId);
    if (board == null || order == null) {
      throw const WorkspaceRepositoryException(
        'Order not found.',
        kind: WorkspaceFailureKind.notFound,
      );
    }
    if (order.labelPrinted) return order;
    final saved = order.copyWith(
      labelPrinted: true,
      updatedAt: _nextRevision(),
    );
    boards[productionId] = board.replaceOrder(saved);
    return saved;
  }

  @override
  Future<ConditionalOrderWrite> updateOrderConditionally({
    required String productionId,
    required String orderId,
    required String observedUpdatedAt,
    required OrderPatch patch,
  }) async {
    conditionalOrderCalls += 1;
    final failure = updateOrderFailure;
    if (failure != null) throw failure;
    final board = boards[productionId];
    final current = board?.orderById(orderId);
    if (board == null || current == null) {
      return const ConditionalOrderWrite(ConditionalWriteStatus.missing);
    }
    if (current.updatedAt != observedUpdatedAt) {
      return ConditionalOrderWrite(
        ConditionalWriteStatus.conflict,
        order: current,
      );
    }
    final saved = patch.apply(current).copyWith(updatedAt: _nextRevision());
    boards[productionId] = board.replaceOrder(saved);
    return ConditionalOrderWrite(
      ConditionalWriteStatus.saved,
      order: saved,
    );
  }

  @override
  Future<UsualOrderWrite> updateUsualOrderConditionally({
    required String personId,
    required String observedUsualOrder,
    required String desiredUsualOrder,
  }) async {
    usualOrderCalls += 1;
    final failure = updateUsualFailure;
    if (failure != null) throw failure;
    for (final entry in boards.entries) {
      final board = entry.value;
      for (final rosterEntry in board.roster) {
        if (rosterEntry.person.id != personId) continue;
        final current = rosterEntry.person.usualOrder;
        if (current == desiredUsualOrder) {
          return UsualOrderWrite(
            ConditionalWriteStatus.saved,
            serverValue: current,
          );
        }
        if (current != observedUsualOrder) {
          return UsualOrderWrite(
            ConditionalWriteStatus.conflict,
            serverValue: current,
          );
        }
        for (final boardEntry in boards.entries.toList()) {
          boards[boardEntry.key] =
              boardEntry.value.replacePersonUsual(personId, desiredUsualOrder);
        }
        return UsualOrderWrite(
          ConditionalWriteStatus.saved,
          serverValue: desiredUsualOrder,
        );
      }
    }
    return const UsualOrderWrite(
      ConditionalWriteStatus.missing,
      serverValue: '',
    );
  }

  @override
  Stream<void> watchOrderChanges(String productionId) => _orderSignals.stream;

  void emitOrderChange() => _orderSignals.add(null);

  String _nextRevision() =>
      DateTime.utc(2026, 7, 25, 18, 0, _revision++).toIso8601String();
}

Map<String, dynamic> _row(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw const FormatException('Invalid table row.');
}

List<Map<String, dynamic>> _rows(Object? value) {
  if (value is! List) throw const FormatException('Invalid table rows.');
  return value.map(_row).toList(growable: false);
}
