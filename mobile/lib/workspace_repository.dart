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

  Future<void> markLabelPrinted({
    required String productionId,
    required String orderId,
  });
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
      final productions = _rows(await _client
          .from('productions')
          .select(_productionColumns)
          .order('shoot_date', ascending: false));
      final clients =
          _rows(await _client.from('clients').select(_clientColumns));
      final roster =
          _rows(await _client.from('production_roster').select(_rosterColumns));
      final orders = _rows(await _client.from('orders').select(_orderColumns));
      return ProductionBoardRowAdapter.daysFromRows(
        productions: productions,
        clients: clients,
        roster: roster,
        orders: orders,
      );
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
  Future<void> markLabelPrinted({
    required String productionId,
    required String orderId,
  }) async {
    try {
      await _client
          .from('orders')
          .update({'label_printed': true})
          .eq('id', orderId)
          .eq('production_id', productionId);
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
}

class MemoryWorkspaceRepository implements WorkspaceRepository {
  MemoryWorkspaceRepository({
    List<DaySummary> days = const [],
    Map<String, ProductionBoard> boards = const {},
    this.fetchDaysFailure,
    this.fetchBoardFailure,
    this.markPrintedFailure,
  })  : days = List.of(days),
        boards = Map.of(boards);

  List<DaySummary> days;
  Map<String, ProductionBoard> boards;
  WorkspaceRepositoryException? fetchDaysFailure;
  WorkspaceRepositoryException? fetchBoardFailure;
  WorkspaceRepositoryException? markPrintedFailure;
  int fetchDaysCalls = 0;
  int fetchBoardCalls = 0;
  int markPrintedCalls = 0;
  final List<String> loadedProductionIds = [];

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
  Future<void> markLabelPrinted({
    required String productionId,
    required String orderId,
  }) async {
    markPrintedCalls += 1;
    final failure = markPrintedFailure;
    if (failure != null) throw failure;
  }
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
