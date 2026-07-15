import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'production_session.dart';

const _printRecoveryPreferencesKey = 'ctc_print_recovery_v1';

enum PrintRecoveryState {
  uncertain,
  printedNeedsSync,
}

class PrintRecoveryRecord {
  const PrintRecoveryRecord({
    required this.apiBase,
    required this.productionId,
    required this.orderId,
    required this.personName,
    required this.drink,
    required this.createdAt,
    required this.state,
  });

  final String apiBase;
  final String productionId;
  final String orderId;
  final String personName;
  final String drink;
  final DateTime createdAt;
  final PrintRecoveryState state;

  bool belongsTo(ProductionSession session) =>
      apiBase == session.apiBase && productionId == session.productionId;

  PrintRecoveryRecord withState(PrintRecoveryState nextState) {
    if (state == PrintRecoveryState.printedNeedsSync &&
        nextState == PrintRecoveryState.uncertain) {
      throw StateError('A confirmed physical print cannot become uncertain.');
    }
    return PrintRecoveryRecord(
      apiBase: apiBase,
      productionId: productionId,
      orderId: orderId,
      personName: personName,
      drink: drink,
      createdAt: createdAt,
      state: nextState,
    );
  }

  Map<String, Object> toJson() => {
        'apiBase': apiBase,
        'productionId': productionId,
        'orderId': orderId,
        'personName': personName,
        'drink': drink,
        'createdAt': createdAt.toUtc().toIso8601String(),
        'state': state.name,
      };

  static PrintRecoveryRecord? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final apiBase = value['apiBase'];
    final productionId = value['productionId'];
    final orderId = value['orderId'];
    final personName = value['personName'];
    final drink = value['drink'];
    final createdAt = DateTime.tryParse(value['createdAt']?.toString() ?? '');
    final state = switch (value['state']) {
      'uncertain' => PrintRecoveryState.uncertain,
      'printedNeedsSync' => PrintRecoveryState.printedNeedsSync,
      _ => null,
    };
    if (apiBase is! String ||
        productionId is! String ||
        orderId is! String ||
        personName is! String ||
        drink is! String ||
        createdAt == null ||
        state == null ||
        apiBase.isEmpty ||
        productionId.isEmpty ||
        orderId.isEmpty) {
      return null;
    }
    return PrintRecoveryRecord(
      apiBase: apiBase,
      productionId: productionId,
      orderId: orderId,
      personName: personName,
      drink: drink,
      createdAt: createdAt,
      state: state,
    );
  }
}

abstract interface class PrintRecoveryRepository {
  Future<List<PrintRecoveryRecord>> readAll();

  Future<void> writeAll(List<PrintRecoveryRecord> records);
}

class PreferencesPrintRecoveryRepository implements PrintRecoveryRepository {
  @override
  Future<List<PrintRecoveryRecord>> readAll() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_printRecoveryPreferencesKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List<dynamic>) return [];
      return decoded
          .map(PrintRecoveryRecord.tryFromJson)
          .whereType<PrintRecoveryRecord>()
          .toList();
    } catch (_) {
      return [];
    }
  }

  @override
  Future<void> writeAll(List<PrintRecoveryRecord> records) async {
    final preferences = await SharedPreferences.getInstance();
    if (records.isEmpty) {
      await preferences.remove(_printRecoveryPreferencesKey);
      return;
    }
    await preferences.setString(
      _printRecoveryPreferencesKey,
      jsonEncode(records.map((record) => record.toJson()).toList()),
    );
  }
}

class MemoryPrintRecoveryRepository implements PrintRecoveryRepository {
  MemoryPrintRecoveryRepository([List<PrintRecoveryRecord> initial = const []])
      : records = List.of(initial);

  List<PrintRecoveryRecord> records;

  @override
  Future<List<PrintRecoveryRecord>> readAll() async => List.of(records);

  @override
  Future<void> writeAll(List<PrintRecoveryRecord> records) async {
    this.records = List.of(records);
  }
}

class PrintRecoveryLedger {
  PrintRecoveryLedger(
    this._repository, [
    Iterable<PrintRecoveryRecord> initial = const [],
  ]) : _records = {for (final record in initial) record.orderId: record};

  final PrintRecoveryRepository _repository;
  final Map<String, PrintRecoveryRecord> _records;

  static Future<PrintRecoveryLedger> load(
    PrintRecoveryRepository repository,
  ) async =>
      PrintRecoveryLedger(repository, await repository.readAll());

  PrintRecoveryRecord? operator [](String orderId) => _records[orderId];

  List<PrintRecoveryRecord> forSession(ProductionSession session) =>
      _records.values
          .where((record) => record.belongsTo(session))
          .toList(growable: false);

  Future<void> record(PrintRecoveryRecord record) async {
    final existing = _records[record.orderId];
    if (existing?.state == PrintRecoveryState.printedNeedsSync &&
        record.state == PrintRecoveryState.uncertain) {
      throw StateError('Cannot weaken a confirmed print recovery state.');
    }
    _records[record.orderId] = record;
    await _persist();
  }

  Future<void> markPhysicalPrintConfirmed(String orderId) async {
    final existing = _records[orderId];
    if (existing == null) throw StateError('Missing print recovery record.');
    _records[orderId] = existing.withState(PrintRecoveryState.printedNeedsSync);
    await _persist();
  }

  Future<void> clear(String orderId) async {
    _records.remove(orderId);
    await _persist();
  }

  Future<void> clearServerConfirmed(Iterable<String> orderIds) async {
    var changed = false;
    for (final orderId in orderIds) {
      changed = _records.remove(orderId) != null || changed;
    }
    if (changed) await _persist();
  }

  Future<void> _persist() => _repository.writeAll(_records.values.toList());
}
