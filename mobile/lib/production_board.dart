/// Dart model of `ProductionBoardDTO` from `src/server/productions/dto.ts`.
///
/// The app reads the board endpoint rather than the printer-queue endpoint
/// because the queue only contains *captured* orders. The board carries the
/// whole on-set roster, including people who have not been asked yet, which is
/// what offline capture will need — and caching the narrower shape now would
/// mean rewriting the cache later.
///
/// The print queue is derived locally by [PrinterQueue.fromBoard], mirroring
/// `buildPrinterQueue` in `src/lib/printer-queue.ts`.
library;

import 'dart:convert';

import 'drink_format.dart';
import 'label_template.dart';

const _maximumRosterEntries = 1000;
const orderTextLimit = 500;

enum OrderField {
  drinkType('drink_type'),
  size('size'),
  temperature('temperature'),
  milkType('milk_type'),
  sweetener('sweetener'),
  caffeine('caffeine'),
  specialNotes('special_notes'),
  vendor('vendor'),
  status('status');

  const OrderField(this.column);

  final String column;

  static OrderField? fromColumn(String column) {
    for (final field in values) {
      if (field.column == column) return field;
    }
    return null;
  }
}

const validOrderStatuses = {
  'not_asked',
  'confirmed',
  'ordered',
  'picked_up',
  'delivered',
  'no_order',
};

/// A typed, sparse ordinary-order patch.
///
/// `label_printed` deliberately cannot appear here. It is a monotonic physical
/// fact and replays independently from compare-and-swap drink edits.
class OrderPatch {
  OrderPatch(Map<OrderField, String> values)
      : values = Map.unmodifiable(_validatedValues(values));

  factory OrderPatch.capture(BoardOrder order) => OrderPatch({
        OrderField.drinkType: order.drinkType,
        OrderField.size: order.size,
        OrderField.temperature: order.temperature,
        OrderField.milkType: order.milkType,
        OrderField.sweetener: order.sweetener,
        OrderField.caffeine: order.caffeine,
        OrderField.specialNotes: order.specialNotes,
        OrderField.vendor: order.vendor,
        OrderField.status:
            order.status == 'not_asked' || order.status == 'no_order'
                ? 'confirmed'
                : order.status,
      });

  factory OrderPatch.noDrink() => OrderPatch({OrderField.status: 'no_order'});

  factory OrderPatch.fromJson(Object? value) {
    if (value is! Map) throw const FormatException('Invalid order patch.');
    final fields = <OrderField, String>{};
    for (final entry in value.entries) {
      final field = OrderField.fromColumn(entry.key.toString());
      final fieldValue = entry.value;
      if (field == null || fieldValue is! String) {
        throw const FormatException('Invalid order patch field.');
      }
      fields[field] = fieldValue;
    }
    return OrderPatch(fields);
  }

  final Map<OrderField, String> values;

  bool get isEmpty => values.isEmpty;

  OrderPatch merge(OrderPatch later) =>
      OrderPatch({...values, ...later.values});

  BoardOrder apply(BoardOrder order) => order.copyWith(
        drinkType: values[OrderField.drinkType],
        size: values[OrderField.size],
        temperature: values[OrderField.temperature],
        milkType: values[OrderField.milkType],
        sweetener: values[OrderField.sweetener],
        caffeine: values[OrderField.caffeine],
        specialNotes: values[OrderField.specialNotes],
        vendor: values[OrderField.vendor],
        status: values[OrderField.status],
      );

  Map<String, String> toColumns() => {
        for (final entry in values.entries) entry.key.column: entry.value,
      };

  Map<String, String> toJson() => toColumns();

  static Map<OrderField, String> snapshot(BoardOrder order) => {
        OrderField.drinkType: order.drinkType,
        OrderField.size: order.size,
        OrderField.temperature: order.temperature,
        OrderField.milkType: order.milkType,
        OrderField.sweetener: order.sweetener,
        OrderField.caffeine: order.caffeine,
        OrderField.specialNotes: order.specialNotes,
        OrderField.vendor: order.vendor,
        OrderField.status: order.status,
      };

  static bool snapshotMatches(
    BoardOrder order,
    Map<OrderField, String> snapshot,
  ) {
    final current = OrderPatch.snapshot(order);
    for (final field in OrderField.values) {
      if (current[field] != snapshot[field]) return false;
    }
    return true;
  }
}

Map<OrderField, String> _validatedValues(Map<OrderField, String> values) {
  final result = <OrderField, String>{};
  for (final entry in values.entries) {
    final normalized = entry.value.trim();
    if (normalized.length > orderTextLimit) {
      throw FormatException('${entry.key.column} is too long.');
    }
    if (entry.key == OrderField.status &&
        !validOrderStatuses.contains(normalized)) {
      throw const FormatException('Invalid order status.');
    }
    result[entry.key] = normalized;
  }
  if (result.isEmpty) throw const FormatException('Order patch is empty.');
  return result;
}

class BoardPerson {
  const BoardPerson({
    required this.id,
    required this.name,
    required this.role,
    required this.department,
    required this.company,
    required this.photoUrl,
    required this.usualOrder,
  });

  final String id;
  final String name;
  final String role;
  final String department;
  final String company;
  final String photoUrl;
  final String usualOrder;

  BoardPerson copyWith({String? usualOrder}) => BoardPerson(
        id: id,
        name: name,
        role: role,
        department: department,
        company: company,
        photoUrl: photoUrl,
        usualOrder: usualOrder ?? this.usualOrder,
      );

  factory BoardPerson.fromJson(Map<String, dynamic> json) => BoardPerson(
        id: _requiredString(json, 'id'),
        name: _requiredString(json, 'name'),
        role: _optionalString(json, 'role'),
        department: _optionalString(json, 'department'),
        company: _optionalString(json, 'company'),
        photoUrl: _optionalString(json, 'photo_url'),
        usualOrder: _optionalString(json, 'usual_order'),
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'name': name,
        'role': role,
        'department': department,
        'company': company,
        'photo_url': photoUrl,
        'usual_order': usualOrder,
      };
}

class BoardOrder implements DrinkSummaryOrder {
  const BoardOrder({
    required this.id,
    required this.drinkType,
    required this.size,
    required this.temperature,
    required this.milkType,
    required this.sweetener,
    required this.caffeine,
    required this.specialNotes,
    required this.vendor,
    required this.status,
    required this.labelPrinted,
    required this.updatedAt,
  });

  final String id;
  @override
  final String drinkType;
  @override
  final String size;
  @override
  final String temperature;
  @override
  final String milkType;
  @override
  final String sweetener;
  @override
  final String caffeine;
  @override
  final String specialNotes;
  final String vendor;
  @override
  final String status;
  final bool labelPrinted;
  final String updatedAt;

  bool get isCaptured => isOrderCaptured(status);

  bool get isNoDrink => status == 'no_order';

  bool get needsOrder => status == 'not_asked';

  BoardOrder copyWith({
    String? drinkType,
    String? size,
    String? temperature,
    String? milkType,
    String? sweetener,
    String? caffeine,
    String? specialNotes,
    String? vendor,
    String? status,
    bool? labelPrinted,
    String? updatedAt,
  }) =>
      BoardOrder(
        id: id,
        drinkType: drinkType ?? this.drinkType,
        size: size ?? this.size,
        temperature: temperature ?? this.temperature,
        milkType: milkType ?? this.milkType,
        sweetener: sweetener ?? this.sweetener,
        caffeine: caffeine ?? this.caffeine,
        specialNotes: specialNotes ?? this.specialNotes,
        vendor: vendor ?? this.vendor,
        status: status ?? this.status,
        labelPrinted: labelPrinted ?? this.labelPrinted,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  factory BoardOrder.fromJson(Map<String, dynamic> json) {
    final labelPrinted = json['label_printed'];
    if (labelPrinted is! bool) {
      throw const FormatException('Invalid label_printed value.');
    }
    return BoardOrder(
      id: _requiredString(json, 'id'),
      drinkType: _optionalString(json, 'drink_type'),
      size: _optionalString(json, 'size'),
      temperature: _optionalString(json, 'temperature'),
      milkType: _optionalString(json, 'milk_type'),
      sweetener: _optionalString(json, 'sweetener'),
      caffeine: _optionalString(json, 'caffeine'),
      specialNotes: _optionalString(json, 'special_notes'),
      vendor: _optionalString(json, 'vendor'),
      status: _requiredString(json, 'status'),
      labelPrinted: labelPrinted,
      updatedAt: _optionalString(json, 'updated_at'),
    );
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'drink_type': drinkType,
        'size': size,
        'temperature': temperature,
        'milk_type': milkType,
        'sweetener': sweetener,
        'caffeine': caffeine,
        'special_notes': specialNotes,
        'vendor': vendor,
        'status': status,
        'label_printed': labelPrinted,
        'updated_at': updatedAt,
      };
}

class BoardRosterEntry {
  const BoardRosterEntry({
    required this.rosterId,
    required this.groupLabel,
    required this.onSetToday,
    required this.sortOrder,
    required this.person,
    required this.order,
  });

  final String rosterId;
  final String groupLabel;
  final bool onSetToday;
  final int sortOrder;
  final BoardPerson person;

  /// Null when the roster entry has no order row. The public API never creates
  /// orders, so the app can display these people but cannot capture for them.
  final BoardOrder? order;

  BoardRosterEntry copyWith({
    BoardPerson? person,
    BoardOrder? order,
  }) =>
      BoardRosterEntry(
        rosterId: rosterId,
        groupLabel: groupLabel,
        onSetToday: onSetToday,
        sortOrder: sortOrder,
        person: person ?? this.person,
        order: order ?? this.order,
      );

  /// `roster.group_label || person.department || "Set"` — the same resolution
  /// `buildPrinterQueue` and `buildCoffeeLabels` apply on the web.
  String get group {
    if (groupLabel.trim().isNotEmpty) return groupLabel.trim();
    if (person.department.trim().isNotEmpty) return person.department.trim();
    return 'Set';
  }

  factory BoardRosterEntry.fromJson(Map<String, dynamic> json) {
    final person = json['person'];
    if (person is! Map<String, dynamic>) {
      throw const FormatException('Invalid roster person.');
    }
    final order = json['order'];
    if (order != null && order is! Map<String, dynamic>) {
      throw const FormatException('Invalid roster order.');
    }
    final onSetToday = json['on_set_today'];
    final sortOrder = json['sort_order'];
    if (onSetToday is! bool || sortOrder is! num) {
      throw const FormatException('Invalid roster entry.');
    }

    return BoardRosterEntry(
      rosterId: _requiredString(json, 'roster_id'),
      groupLabel: _optionalString(json, 'group_label'),
      onSetToday: onSetToday,
      sortOrder: sortOrder.toInt(),
      person: BoardPerson.fromJson(person),
      order: order == null
          ? null
          : BoardOrder.fromJson(order as Map<String, dynamic>),
    );
  }

  Map<String, Object?> toJson() => {
        'roster_id': rosterId,
        'group_label': groupLabel,
        'on_set_today': onSetToday,
        'sort_order': sortOrder,
        'person': person.toJson(),
        'order': order?.toJson(),
      };
}

class BoardProduction {
  const BoardProduction({
    required this.id,
    required this.name,
    required this.shootDate,
    required this.location,
    required this.runnerName,
    required this.status,
    required this.clientName,
    this.labelTemplate,
  });

  final String id;
  final String name;
  final String shootDate;
  final String location;
  final String runnerName;
  final String status;
  final String clientName;
  final LabelTemplateVersion? labelTemplate;

  bool get isActive => status == 'active';

  factory BoardProduction.fromJson(Map<String, dynamic> json) {
    final template = json['label_template'];
    return BoardProduction(
      id: _requiredString(json, 'id'),
      name: _optionalString(json, 'name', fallback: 'Production'),
      shootDate: _optionalString(json, 'shoot_date'),
      location: _optionalString(json, 'location'),
      runnerName: _optionalString(json, 'runner_name'),
      status: _requiredString(json, 'status'),
      clientName: _optionalString(json, 'client_name'),
      labelTemplate: template == null
          ? null
          : LabelTemplateVersion.fromCacheJson(template),
    );
  }

  BoardProduction copyWith({
    String? status,
    LabelTemplateVersion? labelTemplate,
  }) =>
      BoardProduction(
        id: id,
        name: name,
        shootDate: shootDate,
        location: location,
        runnerName: runnerName,
        status: status ?? this.status,
        clientName: clientName,
        labelTemplate: labelTemplate ?? this.labelTemplate,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'name': name,
        'shoot_date': shootDate,
        'location': location,
        'runner_name': runnerName,
        'status': status,
        'client_name': clientName,
        'label_template': labelTemplate?.toCacheJson(),
      };
}

class ProductionBoard {
  const ProductionBoard({required this.production, required this.roster});

  final BoardProduction production;
  final List<BoardRosterEntry> roster;

  BoardOrder? orderById(String orderId) {
    for (final entry in roster) {
      if (entry.order?.id == orderId) return entry.order;
    }
    return null;
  }

  BoardRosterEntry? entryByOrderId(String orderId) {
    for (final entry in roster) {
      if (entry.order?.id == orderId) return entry;
    }
    return null;
  }

  ProductionBoard replaceOrder(BoardOrder order) => ProductionBoard(
        production: production,
        roster: List.unmodifiable([
          for (final entry in roster)
            if (entry.order?.id == order.id)
              entry.copyWith(order: order)
            else
              entry,
        ]),
      );

  ProductionBoard withLabelTemplate(LabelTemplateVersion template) =>
      ProductionBoard(
        production: production.copyWith(labelTemplate: template),
        roster: roster,
      );

  ProductionBoard replacePersonUsual(String personId, String usualOrder) =>
      ProductionBoard(
        production: production,
        roster: List.unmodifiable([
          for (final entry in roster)
            if (entry.person.id == personId)
              entry.copyWith(
                person: entry.person.copyWith(usualOrder: usualOrder),
              )
            else
              entry,
        ]),
      );

  factory ProductionBoard.fromJson(Map<String, dynamic> json) {
    // The route wraps the board as { data: ProductionBoardDTO }.
    final envelope = json['data'];
    final source = envelope is Map<String, dynamic> ? envelope : json;

    final production = source['production'];
    final rawRoster = source['roster'];
    if (production is! Map<String, dynamic> || rawRoster is! List<dynamic>) {
      throw const FormatException('Invalid board response.');
    }
    if (rawRoster.length > _maximumRosterEntries) {
      throw const FormatException('Roster is unexpectedly large.');
    }

    final roster = rawRoster.map((item) {
      if (item is! Map<String, dynamic>) {
        throw const FormatException('Invalid roster entry.');
      }
      return BoardRosterEntry.fromJson(item);
    }).toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

    return ProductionBoard(
      production: BoardProduction.fromJson(production),
      roster: List.unmodifiable(roster),
    );
  }

  Map<String, Object?> toJson() => {
        'production': production.toJson(),
        'roster': roster.map((entry) => entry.toJson()).toList(),
      };

  String encode() => jsonEncode(toJson());

  static ProductionBoard? tryDecode(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final json = jsonDecode(raw);
      if (json is! Map<String, dynamic>) return null;
      return ProductionBoard.fromJson(json);
    } catch (_) {
      return null;
    }
  }
}

class BoardProgress {
  const BoardProgress({
    required this.total,
    required this.needsOrder,
    required this.captured,
    required this.noDrink,
    required this.printed,
  });

  final int total;
  final int needsOrder;
  final int captured;
  final int noDrink;
  final int printed;

  int get decided => captured + noDrink;
}

BoardProgress productionBoardProgress(ProductionBoard? board) {
  var total = 0;
  var needsOrder = 0;
  var captured = 0;
  var noDrink = 0;
  var printed = 0;
  for (final entry in board?.roster ?? const <BoardRosterEntry>[]) {
    if (!entry.onSetToday) continue;
    total += 1;
    final order = entry.order;
    if (order == null || order.needsOrder) {
      needsOrder += 1;
    } else if (order.isNoDrink) {
      noDrink += 1;
    } else {
      captured += 1;
      if (order.labelPrinted) printed += 1;
    }
  }
  return BoardProgress(
    total: total,
    needsOrder: needsOrder,
    captured: captured,
    noDrink: noDrink,
    printed: printed,
  );
}

class QueueLabel {
  const QueueLabel({
    required this.orderId,
    required this.personName,
    required this.drink,
    required this.group,
    required this.status,
    required this.labelPrinted,
    this.role = '',
    this.department = '',
  });

  final String orderId;
  final String personName;
  final String drink;
  final String group;
  final String status;
  final bool labelPrinted;

  /// Carried for the expanded roster row only — never printed on a label.
  ///
  /// Optional because print-recovery records reconstruct a QueueLabel from the
  /// ledger, which stores only what a label needs. A recovery row genuinely has
  /// no role to show.
  final String role;
  final String department;

  /// `Producer · Camera`, skipping whichever is missing.
  ///
  /// Falls back to the roster group so a row is never left with a blank second
  /// line — the group is what the operator sorted by, so it is never useless.
  String get roleLine {
    final parts = [role.trim(), department.trim()]
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return group.trim();
    return parts.join(' · ');
  }

  /// Up to two initials, matching the web's `Avatar` fallback: the first letter
  /// of each space-separated name part.
  String get initials {
    final letters = personName
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .map((part) => part[0].toUpperCase())
        .take(2)
        .join();
    return letters.isEmpty ? '?' : letters;
  }
}

/// The printable subset of a board, derived on device.
///
/// Mirrors `buildPrinterQueue` in `src/lib/printer-queue.ts`: on-set roster
/// entries whose order is captured, in roster order. Waiting (`not_asked`) and
/// declined (`no_order`) people produce no label; already-printed ones stay so
/// reprints remain possible.
class PrinterQueue {
  const PrinterQueue({
    required this.productionName,
    required this.productionStatus,
    required this.clientName,
    required this.labels,
    this.labelTemplate,
  });

  final String productionName;
  final String productionStatus;
  final String clientName;
  final List<QueueLabel> labels;
  final LabelTemplateVersion? labelTemplate;

  bool get isProductionActive => productionStatus == 'active';

  factory PrinterQueue.fromBoard(ProductionBoard board) {
    final labels = <QueueLabel>[];
    for (final entry in board.roster) {
      final order = entry.order;
      if (!entry.onSetToday || order == null || !order.isCaptured) continue;
      labels.add(QueueLabel(
        orderId: order.id,
        personName: entry.person.name,
        drink: formatDrink(order),
        group: entry.group,
        status: order.status,
        labelPrinted: order.labelPrinted,
        role: entry.person.role,
        department: entry.person.department,
      ));
    }

    return PrinterQueue(
      productionName: board.production.name,
      productionStatus: board.production.status,
      clientName: board.production.clientName,
      labels: List.unmodifiable(labels),
      labelTemplate: board.production.labelTemplate,
    );
  }
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty || value.length > 10000) {
    throw FormatException('Invalid $key value.');
  }
  return value;
}

String _optionalString(
  Map<String, dynamic> json,
  String key, {
  String fallback = '',
}) {
  final value = json[key];
  if (value == null) return fallback;
  if (value is! String || value.length > 10000) {
    throw FormatException('Invalid $key value.');
  }
  return value;
}
