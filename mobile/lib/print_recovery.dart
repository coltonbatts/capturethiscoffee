import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'production_board.dart';
import 'production_session.dart';

const _printRecoveryPreferencesKey = 'ctc_print_recovery_v1';
const _orderMutationOutboxPreferencesKey = 'ctc_order_mutation_outbox_v2';

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

  List<PrintRecoveryRecord> forSession(ProductionSession session) => forScope(
        scopeKey: session.apiBase,
        productionId: session.productionId,
      );

  List<PrintRecoveryRecord> forScope({
    required String scopeKey,
    required String productionId,
  }) =>
      _records.values
          .where((record) =>
              record.apiBase == scopeKey && record.productionId == productionId)
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

enum OrderMutationConflictKind {
  order,
  usualOrder,
  missing,
  completedProduction,
}

class OrderMutationConflict {
  const OrderMutationConflict({
    required this.kind,
    required this.message,
    this.serverOrder,
    this.serverUsualOrder,
  });

  final OrderMutationConflictKind kind;
  final String message;
  final BoardOrder? serverOrder;
  final String? serverUsualOrder;

  Map<String, Object?> toJson() => {
        'kind': kind.name,
        'message': message,
        'serverOrder': serverOrder?.toJson(),
        'serverUsualOrder': serverUsualOrder,
      };

  static OrderMutationConflict? tryFromJson(Object? value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    final kind = switch (json['kind']) {
      'order' => OrderMutationConflictKind.order,
      'usualOrder' => OrderMutationConflictKind.usualOrder,
      'missing' => OrderMutationConflictKind.missing,
      'completedProduction' => OrderMutationConflictKind.completedProduction,
      _ => null,
    };
    final message = json['message'];
    if (kind == null || message is! String) return null;
    BoardOrder? serverOrder;
    final rawOrder = json['serverOrder'];
    if (rawOrder is Map) {
      try {
        serverOrder = BoardOrder.fromJson(Map<String, dynamic>.from(rawOrder));
      } catch (_) {
        return null;
      }
    }
    return OrderMutationConflict(
      kind: kind,
      message: message,
      serverOrder: serverOrder,
      serverUsualOrder: json['serverUsualOrder']?.toString(),
    );
  }
}

class OrderMutationRecord {
  const OrderMutationRecord({
    required this.scopeKey,
    required this.productionId,
    required this.orderId,
    required this.personId,
    required this.personName,
    required this.drink,
    required this.createdAt,
    required this.observedUpdatedAt,
    required this.baseValues,
    required this.patch,
    required this.updateUsualOrder,
    required this.observedUsualOrder,
    required this.desiredUsualOrder,
    required this.orderApplied,
    required this.conflict,
    required this.printState,
  });

  final String scopeKey;
  final String productionId;
  final String orderId;
  final String personId;
  final String personName;
  final String drink;
  final DateTime createdAt;

  /// The server revision observed before the first local edit. Coalescing does
  /// not advance this value.
  final String observedUpdatedAt;
  final Map<OrderField, String> baseValues;
  final OrderPatch? patch;

  /// A staged second intent. The ordinary order CAS is persisted as applied
  /// before this conditional people.usual_order write is attempted.
  final bool updateUsualOrder;
  final String observedUsualOrder;
  final String desiredUsualOrder;
  final bool orderApplied;

  final OrderMutationConflict? conflict;
  final PrintRecoveryState? printState;

  bool get hasOrdinaryIntent => patch != null;
  bool get hasPrintIntent => printState != null;
  bool get isEmpty => !hasOrdinaryIntent && !hasPrintIntent;

  OrderMutationRecord copyWith({
    String? observedUpdatedAt,
    Map<OrderField, String>? baseValues,
    Object? patch = _unchanged,
    bool? updateUsualOrder,
    String? observedUsualOrder,
    String? desiredUsualOrder,
    bool? orderApplied,
    Object? conflict = _unchanged,
    Object? printState = _unchanged,
    String? personId,
    String? personName,
    String? drink,
  }) =>
      OrderMutationRecord(
        scopeKey: scopeKey,
        productionId: productionId,
        orderId: orderId,
        personId: personId ?? this.personId,
        personName: personName ?? this.personName,
        drink: drink ?? this.drink,
        createdAt: createdAt,
        observedUpdatedAt: observedUpdatedAt ?? this.observedUpdatedAt,
        baseValues: Map.unmodifiable(baseValues ?? this.baseValues),
        patch: identical(patch, _unchanged) ? this.patch : patch as OrderPatch?,
        updateUsualOrder: updateUsualOrder ?? this.updateUsualOrder,
        observedUsualOrder: observedUsualOrder ?? this.observedUsualOrder,
        desiredUsualOrder: desiredUsualOrder ?? this.desiredUsualOrder,
        orderApplied: orderApplied ?? this.orderApplied,
        conflict: identical(conflict, _unchanged)
            ? this.conflict
            : conflict as OrderMutationConflict?,
        printState: identical(printState, _unchanged)
            ? this.printState
            : printState as PrintRecoveryState?,
      );

  Map<String, Object?> toJson() => {
        'scopeKey': scopeKey,
        'productionId': productionId,
        'orderId': orderId,
        'personId': personId,
        'personName': personName,
        'drink': drink,
        'createdAt': createdAt.toUtc().toIso8601String(),
        'observedUpdatedAt': observedUpdatedAt,
        'baseValues': {
          for (final entry in baseValues.entries) entry.key.column: entry.value,
        },
        'patch': patch?.toJson(),
        'updateUsualOrder': updateUsualOrder,
        'observedUsualOrder': observedUsualOrder,
        'desiredUsualOrder': desiredUsualOrder,
        'orderApplied': orderApplied,
        'conflict': conflict?.toJson(),
        'printState': printState?.name,
      };

  static OrderMutationRecord? tryFromJson(Object? value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    final scopeKey = json['scopeKey'];
    final productionId = json['productionId'];
    final orderId = json['orderId'];
    final createdAt = DateTime.tryParse(json['createdAt']?.toString() ?? '');
    if (scopeKey is! String ||
        scopeKey.isEmpty ||
        productionId is! String ||
        productionId.isEmpty ||
        orderId is! String ||
        orderId.isEmpty ||
        createdAt == null) {
      return null;
    }

    try {
      final rawBase = json['baseValues'];
      final baseValues = <OrderField, String>{};
      if (rawBase is Map) {
        for (final entry in rawBase.entries) {
          final field = OrderField.fromColumn(entry.key.toString());
          if (field == null || entry.value is! String) return null;
          baseValues[field] = entry.value as String;
        }
      }
      final rawPatch = json['patch'];
      final patch = rawPatch == null ? null : OrderPatch.fromJson(rawPatch);
      final printState = switch (json['printState']) {
        'uncertain' => PrintRecoveryState.uncertain,
        'printedNeedsSync' => PrintRecoveryState.printedNeedsSync,
        null => null,
        _ => throw const FormatException('Invalid print state.'),
      };
      if (patch == null && printState == null) return null;
      return OrderMutationRecord(
        scopeKey: scopeKey,
        productionId: productionId,
        orderId: orderId,
        personId: json['personId']?.toString() ?? '',
        personName: json['personName']?.toString() ?? '',
        drink: json['drink']?.toString() ?? '',
        createdAt: createdAt,
        observedUpdatedAt: json['observedUpdatedAt']?.toString() ?? '',
        baseValues: Map.unmodifiable(baseValues),
        patch: patch,
        updateUsualOrder: json['updateUsualOrder'] == true,
        observedUsualOrder: json['observedUsualOrder']?.toString() ?? '',
        desiredUsualOrder: json['desiredUsualOrder']?.toString() ?? '',
        orderApplied: json['orderApplied'] == true,
        conflict: OrderMutationConflict.tryFromJson(json['conflict']),
        printState: printState,
      );
    } catch (_) {
      return null;
    }
  }

  static OrderMutationRecord fromLegacyPrint(PrintRecoveryRecord record) =>
      OrderMutationRecord(
        scopeKey: record.apiBase,
        productionId: record.productionId,
        orderId: record.orderId,
        personId: '',
        personName: record.personName,
        drink: record.drink,
        createdAt: record.createdAt,
        observedUpdatedAt: '',
        baseValues: const {},
        patch: null,
        updateUsualOrder: false,
        observedUsualOrder: '',
        desiredUsualOrder: '',
        orderApplied: false,
        conflict: null,
        printState: record.state,
      );
}

const _unchanged = Object();

abstract interface class OrderMutationOutboxRepository {
  Future<List<OrderMutationRecord>> readAll();

  Future<void> writeAll(List<OrderMutationRecord> records);
}

class PreferencesOrderMutationOutboxRepository
    implements OrderMutationOutboxRepository {
  @override
  Future<List<OrderMutationRecord>> readAll() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_orderMutationOutboxPreferencesKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is! List) return const [];
        return decoded
            .map(OrderMutationRecord.tryFromJson)
            .whereType<OrderMutationRecord>()
            .toList(growable: false);
      } catch (_) {
        return const [];
      }
    }

    // Build 9 stored only physical recovery evidence. Read it into the unified
    // ledger so an upgrade cannot strand an uncertain or confirmed print.
    final legacy = await PreferencesPrintRecoveryRepository().readAll();
    return legacy
        .map(OrderMutationRecord.fromLegacyPrint)
        .toList(growable: false);
  }

  @override
  Future<void> writeAll(List<OrderMutationRecord> records) async {
    final preferences = await SharedPreferences.getInstance();
    final persisted = await preferences.setString(
      _orderMutationOutboxPreferencesKey,
      jsonEncode(records.map((record) => record.toJson()).toList()),
    );
    if (!persisted) {
      throw StateError('Could not persist the order mutation outbox.');
    }
  }
}

class MemoryOrderMutationOutboxRepository
    implements OrderMutationOutboxRepository {
  MemoryOrderMutationOutboxRepository([
    List<OrderMutationRecord> initial = const [],
  ]) : records = List.of(initial);

  List<OrderMutationRecord> records;
  int writeCount = 0;

  @override
  Future<List<OrderMutationRecord>> readAll() async => List.of(records);

  @override
  Future<void> writeAll(List<OrderMutationRecord> records) async {
    writeCount += 1;
    this.records = List.of(records);
  }
}

/// The one durable per-order ledger for both editable order intent and
/// physical print evidence.
///
/// Records are globally keyed by order UUID and retain a scope so signing out
/// hides another account's work without deleting it.
class OrderMutationOutbox {
  OrderMutationOutbox(this._repository);

  final OrderMutationOutboxRepository _repository;
  Map<String, OrderMutationRecord> _records = {};
  Future<void>? _startFuture;
  Future<void> _mutationTail = Future<void>.value();

  Future<void> start() => _startFuture ??= _load();

  Future<void> _load() async {
    final records = await _repository.readAll();
    _records = {for (final record in records) record.orderId: record};
  }

  OrderMutationRecord? operator [](String orderId) => _records[orderId];

  List<OrderMutationRecord> forScope({
    required String scopeKey,
    required String productionId,
  }) =>
      _records.values
          .where((record) =>
              record.scopeKey == scopeKey &&
              record.productionId == productionId)
          .toList(growable: false)
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

  Future<void> queueOrderPatch({
    required String scopeKey,
    required String productionId,
    required BoardRosterEntry entry,
    required OrderPatch patch,
    required bool updateUsualOrder,
    required String desiredUsualOrder,
  }) =>
      _serialized(() => _queueOrderPatch(
            scopeKey: scopeKey,
            productionId: productionId,
            entry: entry,
            patch: patch,
            updateUsualOrder: updateUsualOrder,
            desiredUsualOrder: desiredUsualOrder,
          ));

  Future<void> _queueOrderPatch({
    required String scopeKey,
    required String productionId,
    required BoardRosterEntry entry,
    required OrderPatch patch,
    required bool updateUsualOrder,
    required String desiredUsualOrder,
  }) async {
    await start();
    final order = entry.order;
    if (order == null || order.updatedAt.isEmpty) {
      throw StateError(
        'This order needs one online refresh before it can be edited offline.',
      );
    }
    final existing = _records[order.id];
    if (existing != null &&
        (existing.scopeKey != scopeKey ||
            existing.productionId != productionId)) {
      throw StateError(
        'This order already has pending work for another signed-in workspace.',
      );
    }
    if (existing?.conflict != null) {
      throw StateError('Resolve this order conflict before editing again.');
    }
    final next = existing == null
        ? OrderMutationRecord(
            scopeKey: scopeKey,
            productionId: productionId,
            orderId: order.id,
            personId: entry.person.id,
            personName: entry.person.name,
            drink: desiredUsualOrder,
            createdAt: DateTime.now(),
            observedUpdatedAt: order.updatedAt,
            baseValues: Map.unmodifiable(OrderPatch.snapshot(order)),
            patch: patch,
            updateUsualOrder: updateUsualOrder,
            observedUsualOrder: entry.person.usualOrder,
            desiredUsualOrder: desiredUsualOrder,
            orderApplied: false,
            conflict: null,
            printState: null,
          )
        : existing.patch == null
            ? existing.copyWith(
                observedUpdatedAt: order.updatedAt,
                baseValues: OrderPatch.snapshot(order),
                patch: patch,
                updateUsualOrder: updateUsualOrder,
                observedUsualOrder: entry.person.usualOrder,
                desiredUsualOrder: desiredUsualOrder,
                personId: entry.person.id,
                personName: entry.person.name,
                drink: desiredUsualOrder,
                orderApplied: false,
              )
            : existing.copyWith(
                patch: existing.patch!.merge(patch),
                updateUsualOrder: updateUsualOrder,
                desiredUsualOrder: desiredUsualOrder,
                personId: entry.person.id,
                personName: entry.person.name,
                drink: desiredUsualOrder,
                orderApplied: false,
              );
    await _put(next);
  }

  Future<void> markOrderApplied(String orderId, BoardOrder serverOrder) =>
      _serialized(() => _markOrderApplied(orderId, serverOrder));

  Future<void> _markOrderApplied(
    String orderId,
    BoardOrder serverOrder,
  ) async {
    final existing = _require(orderId);
    await _put(existing.copyWith(
      observedUpdatedAt: serverOrder.updatedAt,
      baseValues: OrderPatch.snapshot(serverOrder),
      orderApplied: true,
      conflict: null,
    ));
  }

  Future<void> rebasePendingOrder(
    String orderId,
    BoardOrder serverOrder,
  ) =>
      _serialized(() => _rebasePendingOrder(orderId, serverOrder));

  Future<void> _rebasePendingOrder(
    String orderId,
    BoardOrder serverOrder,
  ) async {
    final existing = _require(orderId);
    await _put(existing.copyWith(
      observedUpdatedAt: serverOrder.updatedAt,
      baseValues: OrderPatch.snapshot(serverOrder),
      orderApplied: false,
      conflict: null,
    ));
  }

  Future<void> markConflict(
    String orderId,
    OrderMutationConflict conflict,
  ) =>
      _serialized(() => _markConflict(orderId, conflict));

  Future<void> _markConflict(
    String orderId,
    OrderMutationConflict conflict,
  ) async {
    final existing = _require(orderId);
    await _put(existing.copyWith(conflict: conflict));
  }

  Future<void> updateConflictServerOrder(
    String orderId,
    BoardOrder serverOrder,
  ) =>
      _serialized(() => _updateConflictServerOrder(orderId, serverOrder));

  Future<void> _updateConflictServerOrder(
    String orderId,
    BoardOrder serverOrder,
  ) async {
    final existing = _records[orderId];
    final conflict = existing?.conflict;
    if (existing == null ||
        conflict == null ||
        conflict.kind != OrderMutationConflictKind.order) {
      return;
    }
    await _put(existing.copyWith(
      conflict: OrderMutationConflict(
        kind: conflict.kind,
        message: conflict.message,
        serverOrder: serverOrder,
        serverUsualOrder: conflict.serverUsualOrder,
      ),
    ));
  }

  Future<void> retryConflict(String orderId) =>
      _serialized(() => _retryConflict(orderId));

  Future<void> _retryConflict(String orderId) async {
    final existing = _require(orderId);
    final conflict = existing.conflict;
    if (conflict == null) return;
    switch (conflict.kind) {
      case OrderMutationConflictKind.order:
        final serverOrder = conflict.serverOrder;
        if (serverOrder == null) {
          throw StateError('The server order is unavailable.');
        }
        await _put(existing.copyWith(
          observedUpdatedAt: serverOrder.updatedAt,
          baseValues: OrderPatch.snapshot(serverOrder),
          orderApplied: false,
          conflict: null,
        ));
      case OrderMutationConflictKind.usualOrder:
        await _put(existing.copyWith(
          observedUsualOrder: conflict.serverUsualOrder ?? '',
          orderApplied: true,
          conflict: null,
        ));
      case OrderMutationConflictKind.missing:
      case OrderMutationConflictKind.completedProduction:
        throw StateError(
            'This conflict cannot be retried until setup changes.');
    }
  }

  Future<void> discardOrdinaryIntent(String orderId) =>
      _serialized(() => _discardOrdinaryIntent(orderId));

  Future<void> _discardOrdinaryIntent(String orderId) async {
    final existing = _records[orderId];
    if (existing == null) return;
    await _putOrRemove(existing.copyWith(
      patch: null,
      updateUsualOrder: false,
      orderApplied: false,
      conflict: null,
    ));
  }

  Future<void> recordPrintRecovery(PrintRecoveryRecord recovery) =>
      _serialized(() => _recordPrintRecovery(recovery));

  Future<void> _recordPrintRecovery(PrintRecoveryRecord recovery) async {
    await start();
    final existing = _records[recovery.orderId];
    if (existing != null &&
        (existing.scopeKey != recovery.apiBase ||
            existing.productionId != recovery.productionId)) {
      throw StateError(
        'This order already has pending work for another signed-in workspace.',
      );
    }
    if (existing?.printState == PrintRecoveryState.printedNeedsSync &&
        recovery.state == PrintRecoveryState.uncertain) {
      throw StateError('Cannot weaken a confirmed physical print.');
    }
    final next = existing == null
        ? OrderMutationRecord.fromLegacyPrint(recovery)
        : existing.copyWith(
            printState: recovery.state,
            personName: recovery.personName,
            drink: recovery.drink,
          );
    await _put(next);
  }

  Future<void> markPhysicalPrintConfirmed(String orderId) =>
      _serialized(() => _markPhysicalPrintConfirmed(orderId));

  Future<void> _markPhysicalPrintConfirmed(String orderId) async {
    final existing = _require(orderId);
    if (existing.printState == null) {
      throw StateError('Missing print recovery record.');
    }
    await _put(existing.copyWith(
      printState: PrintRecoveryState.printedNeedsSync,
    ));
  }

  Future<void> clearPrintIntent(String orderId) =>
      _serialized(() => _clearPrintIntent(orderId));

  Future<void> _clearPrintIntent(String orderId) async {
    final existing = _records[orderId];
    if (existing == null) return;
    await _putOrRemove(existing.copyWith(printState: null));
  }

  Future<void> clearServerConfirmedPrints(Iterable<String> orderIds) =>
      _serialized(() async {
        for (final orderId in orderIds) {
          await _clearPrintIntent(orderId);
        }
      });

  /// SharedPreferences writes are whole-ledger replacements. Serialize every
  /// read-modify-write so two rapid captures (or capture plus print recovery)
  /// cannot each persist a snapshot that drops the other operation.
  Future<T> _serialized<T>(Future<T> Function() action) {
    final completer = Completer<T>();
    _mutationTail = _mutationTail.then((_) async {
      try {
        completer.complete(await action());
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }

  OrderMutationRecord _require(String orderId) {
    final record = _records[orderId];
    if (record == null) throw StateError('Missing order mutation record.');
    return record;
  }

  Future<void> _put(OrderMutationRecord record) async {
    final next = Map<String, OrderMutationRecord>.of(_records)
      ..[record.orderId] = record;
    await _persist(next);
  }

  Future<void> _putOrRemove(OrderMutationRecord record) async {
    final next = Map<String, OrderMutationRecord>.of(_records);
    if (record.isEmpty) {
      next.remove(record.orderId);
    } else {
      next[record.orderId] = record;
    }
    await _persist(next);
  }

  Future<void> _persist(Map<String, OrderMutationRecord> next) async {
    await _repository.writeAll(next.values.toList(growable: false));
    _records = next;
  }
}

/// Compatibility view used by the established recovery UI and printer tests.
/// Production constructs this over the same [OrderMutationOutbox] used by the
/// board controller.
class SharedPrintRecoveryLedger extends PrintRecoveryLedger {
  SharedPrintRecoveryLedger(this._outbox)
      : super(MemoryPrintRecoveryRepository());

  final OrderMutationOutbox _outbox;

  @override
  PrintRecoveryRecord? operator [](String orderId) {
    final record = _outbox[orderId];
    final state = record?.printState;
    if (record == null || state == null) return null;
    return _toRecovery(record, state);
  }

  @override
  List<PrintRecoveryRecord> forScope({
    required String scopeKey,
    required String productionId,
  }) =>
      _outbox
          .forScope(scopeKey: scopeKey, productionId: productionId)
          .where((record) => record.printState != null)
          .map((record) => _toRecovery(record, record.printState!))
          .toList(growable: false);

  @override
  List<PrintRecoveryRecord> forSession(ProductionSession session) => forScope(
        scopeKey: session.apiBase,
        productionId: session.productionId,
      );

  @override
  Future<void> record(PrintRecoveryRecord record) =>
      _outbox.recordPrintRecovery(record);

  @override
  Future<void> markPhysicalPrintConfirmed(String orderId) =>
      _outbox.markPhysicalPrintConfirmed(orderId);

  @override
  Future<void> clear(String orderId) => _outbox.clearPrintIntent(orderId);

  @override
  Future<void> clearServerConfirmed(Iterable<String> orderIds) =>
      _outbox.clearServerConfirmedPrints(orderIds);

  PrintRecoveryRecord _toRecovery(
    OrderMutationRecord record,
    PrintRecoveryState state,
  ) =>
      PrintRecoveryRecord(
        apiBase: record.scopeKey,
        productionId: record.productionId,
        orderId: record.orderId,
        personName: record.personName,
        drink: record.drink,
        createdAt: record.createdAt,
        state: state,
      );
}
