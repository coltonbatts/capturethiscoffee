import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/workspace_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('days group by status and expose capture and print progress', () {
    final days = ProductionBoardRowAdapter.daysFromRows(
      productions: [
        _production('planning', status: 'planning', date: '2026-07-27'),
        _production('active', status: 'active', date: '2026-07-25'),
        _production('complete', status: 'complete', date: '2026-07-20'),
      ],
      clients: [
        {'id': 'client-1', 'name': 'Northstar'},
      ],
      roster: [
        _roster('r1', 'active'),
        _roster('r2', 'active'),
        _roster('r3', 'active'),
      ],
      orders: [
        _order('o1', 'r1', status: 'confirmed', printed: true),
        _order('o2', 'r2', status: 'no_order'),
        _order('o3', 'r3', status: 'not_asked'),
      ],
    );

    final active = days.singleWhere((day) => day.id == 'active');
    expect(active.total, 3);
    expect(active.captured, 1);
    expect(active.skipped, 1);
    expect(active.needsOrder, 1);
    expect(active.printed, 1);
    expect(active.capturePercent, 67);
    expect(active.printPercent, 100);

    final grouped = groupDays(days);
    expect(grouped.active.single.id, 'active');
    expect(grouped.planning.single.id, 'planning');
    expect(grouped.complete.single.id, 'complete');
  });

  test('direct rows adapt into the shared ProductionBoard and PrinterQueue',
      () {
    final board = ProductionBoardRowAdapter.fromRows(
      production: _production(
        'active',
        status: 'active',
        date: '2026-07-25',
      ),
      client: {'id': 'client-1', 'name': 'Northstar'},
      roster: [
        _roster('r1', 'active', personId: 'person-1', sortOrder: 2),
        _roster('r2', 'active', personId: 'person-2', sortOrder: 1),
      ],
      people: [
        _person('person-1', 'Maya Rodriguez'),
        _person('person-2', 'Jonah Bell'),
      ],
      orders: [
        _order('o1', 'r1', status: 'confirmed'),
        _order('o2', 'r2', status: 'not_asked'),
      ],
    );

    expect(board.production.clientName, 'Northstar');
    expect(board.roster.map((row) => row.rosterId), ['r2', 'r1']);
    final queue = PrinterQueue.fromBoard(board);
    expect(queue.labels, hasLength(1));
    expect(queue.labels.single.personName, 'Maya Rodriguez');
    expect(queue.productionName, 'active day');
  });
}

Map<String, dynamic> _production(
  String id, {
  required String status,
  required String date,
}) =>
    {
      'id': id,
      'name': '$id day',
      'client_id': 'client-1',
      'shoot_date': date,
      'location': 'Stage A',
      'runner_name': 'Taylor',
      'status': status,
    };

Map<String, dynamic> _roster(
  String id,
  String productionId, {
  String? personId,
  int sortOrder = 0,
}) =>
    {
      'id': id,
      'production_id': productionId,
      'person_id': personId ?? 'person-$id',
      'group_label': 'Crew',
      'on_set_today': true,
      'sort_order': sortOrder,
    };

Map<String, dynamic> _person(String id, String name) => {
      'id': id,
      'name': name,
      'role': 'Crew',
      'department': 'Production',
      'company': '',
      'photo_url': '',
      'usual_order': '',
    };

Map<String, dynamic> _order(
  String id,
  String rosterId, {
  required String status,
  bool printed = false,
}) =>
    {
      'id': id,
      'production_id': 'active',
      'roster_id': rosterId,
      'person_id': 'person-$rosterId',
      'drink_type': 'Latte',
      'size': '12 oz',
      'temperature': 'Hot',
      'milk_type': 'Oat',
      'sweetener': '',
      'caffeine': '',
      'special_notes': '',
      'vendor': '',
      'status': status,
      'label_printed': printed,
      'updated_at': '2026-07-25T12:00:00Z',
    };
