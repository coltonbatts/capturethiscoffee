import 'production_board.dart';

enum DayGroup {
  active,
  planning,
  complete,
}

class DaySummary {
  const DaySummary({
    required this.id,
    required this.name,
    required this.clientName,
    required this.shootDate,
    required this.status,
    required this.total,
    required this.captured,
    required this.skipped,
    required this.printed,
  });

  final String id;
  final String name;
  final String clientName;
  final DateTime? shootDate;
  final String status;
  final int total;
  final int captured;
  final int skipped;
  final int printed;

  DayGroup get group => switch (status) {
        'active' => DayGroup.active,
        'complete' => DayGroup.complete,
        _ => DayGroup.planning,
      };

  int get decided => captured + skipped;
  int get needsOrder => total - decided;
  int get printable => captured;
  int get capturePercent => total == 0 ? 0 : ((decided / total) * 100).round();
  int get printPercent =>
      printable == 0 ? 0 : ((printed / printable) * 100).round();
}

class GroupedDays {
  const GroupedDays({
    required this.active,
    required this.planning,
    required this.complete,
  });

  final List<DaySummary> active;
  final List<DaySummary> planning;
  final List<DaySummary> complete;
}

GroupedDays groupDays(Iterable<DaySummary> days) {
  final active = <DaySummary>[];
  final planning = <DaySummary>[];
  final complete = <DaySummary>[];
  for (final day in days) {
    switch (day.group) {
      case DayGroup.active:
        active.add(day);
      case DayGroup.planning:
        planning.add(day);
      case DayGroup.complete:
        complete.add(day);
    }
  }
  active.sort(_compareUpcoming);
  planning.sort(_compareUpcoming);
  complete.sort((a, b) => _compareUpcoming(b, a));
  return GroupedDays(
    active: List.unmodifiable(active),
    planning: List.unmodifiable(planning),
    complete: List.unmodifiable(complete),
  );
}

int _compareUpcoming(DaySummary a, DaySummary b) {
  final aDate = a.shootDate;
  final bDate = b.shootDate;
  if (aDate == null && bDate == null) return a.name.compareTo(b.name);
  if (aDate == null) return 1;
  if (bDate == null) return -1;
  final date = aDate.compareTo(bDate);
  return date == 0 ? a.name.compareTo(b.name) : date;
}

/// Adapts authenticated table rows into the exact Build 8 board model.
///
/// This is intentionally separate from Supabase so the mapping is fixture
/// tested and no widget needs to know a database column name.
class ProductionBoardRowAdapter {
  const ProductionBoardRowAdapter._();

  static ProductionBoard fromRows({
    required Map<String, dynamic> production,
    required Map<String, dynamic>? client,
    required List<Map<String, dynamic>> roster,
    required List<Map<String, dynamic>> people,
    required List<Map<String, dynamic>> orders,
  }) {
    final peopleById = {
      for (final person in people) _requiredString(person, 'id'): person,
    };
    final ordersByRosterId = <String, Map<String, dynamic>>{};
    for (final order in orders) {
      ordersByRosterId[_requiredString(order, 'roster_id')] = order;
    }

    final boardRoster = roster.map((row) {
      final personId = _requiredString(row, 'person_id');
      final person = peopleById[personId];
      if (person == null) {
        throw FormatException('Roster person $personId is missing.');
      }
      final rosterId = _requiredString(row, 'id');
      final order = ordersByRosterId[rosterId];
      return BoardRosterEntry.fromJson({
        'roster_id': rosterId,
        'group_label': row['group_label'],
        'on_set_today': row['on_set_today'],
        'sort_order': row['sort_order'],
        'person': {
          'id': personId,
          'name': person['name'],
          'role': person['role'],
          'department': person['department'],
          'company': person['company'],
          'photo_url': person['photo_url'],
          'usual_order': person['usual_order'],
        },
        'order': order == null
            ? null
            : {
                'id': order['id'],
                'drink_type': order['drink_type'],
                'size': order['size'],
                'temperature': order['temperature'],
                'milk_type': order['milk_type'],
                'sweetener': order['sweetener'],
                'caffeine': order['caffeine'],
                'special_notes': order['special_notes'],
                'vendor': order['vendor'],
                'status': order['status'],
                'label_printed': order['label_printed'],
                'updated_at': order['updated_at'],
              },
      });
    }).toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

    return ProductionBoard(
      production: BoardProduction.fromJson({
        'id': production['id'],
        'name': production['name'],
        'shoot_date': production['shoot_date'],
        'location': production['location'],
        'runner_name': production['runner_name'],
        'status': production['status'],
        'client_name': client?['name'],
      }),
      roster: List.unmodifiable(boardRoster),
    );
  }

  static List<DaySummary> daysFromRows({
    required List<Map<String, dynamic>> productions,
    required List<Map<String, dynamic>> clients,
    required List<Map<String, dynamic>> roster,
    required List<Map<String, dynamic>> orders,
  }) {
    final clientNames = <String, String>{
      for (final client in clients)
        _requiredString(client, 'id'): _optionalString(client['name']),
    };
    final rosterByProduction = <String, List<Map<String, dynamic>>>{};
    for (final row in roster) {
      final productionId = _requiredString(row, 'production_id');
      rosterByProduction.putIfAbsent(productionId, () => []).add(row);
    }
    final ordersByRoster = <String, Map<String, dynamic>>{
      for (final order in orders) _requiredString(order, 'roster_id'): order,
    };

    return productions.map((production) {
      final id = _requiredString(production, 'id');
      final onSet = (rosterByProduction[id] ?? const [])
          .where((row) => row['on_set_today'] == true)
          .toList();
      var captured = 0;
      var skipped = 0;
      var printed = 0;
      for (final row in onSet) {
        final order = ordersByRoster[_requiredString(row, 'id')];
        final status = _optionalString(order?['status']);
        if (status == 'no_order') {
          skipped += 1;
        } else if (status.isNotEmpty && status != 'not_asked') {
          captured += 1;
          if (order?['label_printed'] == true) printed += 1;
        }
      }

      return DaySummary(
        id: id,
        name: _optionalString(production['name'], fallback: 'Production'),
        clientName: clientNames[_optionalString(production['client_id'])] ?? '',
        shootDate: _parseDate(production['shoot_date']),
        status: _optionalString(production['status'], fallback: 'planning'),
        total: onSet.length,
        captured: captured,
        skipped: skipped,
        printed: printed,
      );
    }).toList(growable: false);
  }
}

String _requiredString(Map<String, dynamic> row, String key) {
  final value = row[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Invalid $key row value.');
  }
  return value;
}

String _optionalString(Object? value, {String fallback = ''}) =>
    value is String ? value : fallback;

DateTime? _parseDate(Object? value) {
  if (value is! String || value.isEmpty) return null;
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return null;
  return DateTime(parsed.year, parsed.month, parsed.day);
}
