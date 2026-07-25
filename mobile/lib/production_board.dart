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

const _maximumRosterEntries = 1000;

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
  });

  final String id;
  final String name;
  final String shootDate;
  final String location;
  final String runnerName;
  final String status;
  final String clientName;

  bool get isActive => status == 'active';

  factory BoardProduction.fromJson(Map<String, dynamic> json) =>
      BoardProduction(
        id: _requiredString(json, 'id'),
        name: _optionalString(json, 'name', fallback: 'Production'),
        shootDate: _optionalString(json, 'shoot_date'),
        location: _optionalString(json, 'location'),
        runnerName: _optionalString(json, 'runner_name'),
        status: _requiredString(json, 'status'),
        clientName: _optionalString(json, 'client_name'),
      );

  Map<String, Object?> toJson() => {
        'id': id,
        'name': name,
        'shoot_date': shootDate,
        'location': location,
        'runner_name': runnerName,
        'status': status,
        'client_name': clientName,
      };
}

class ProductionBoard {
  const ProductionBoard({required this.production, required this.roster});

  final BoardProduction production;
  final List<BoardRosterEntry> roster;

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

class QueueLabel {
  const QueueLabel({
    required this.orderId,
    required this.personName,
    required this.drink,
    required this.group,
    required this.status,
    required this.labelPrinted,
  });

  final String orderId;
  final String personName;
  final String drink;
  final String group;
  final String status;
  final bool labelPrinted;
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
  });

  final String productionName;
  final String productionStatus;
  final String clientName;
  final List<QueueLabel> labels;

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
      ));
    }

    return PrinterQueue(
      productionName: board.production.name,
      productionStatus: board.production.status,
      clientName: board.production.clientName,
      labels: List.unmodifiable(labels),
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
