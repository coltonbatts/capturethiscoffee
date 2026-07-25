// The app now derives its own print queue from the board instead of reading a
// server-built one. These tests pin that derivation against `buildPrinterQueue`
// in src/lib/printer-queue.ts — the two must select the same people, in the
// same order, with the same group and drink text.

import 'package:ctc_printer/production_board.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

Map<String, Object?> _rosterJson({
  String rosterId = 'roster-1',
  String orderId = 'order-1',
  String groupLabel = 'Camera',
  String department = '',
  bool onSetToday = true,
  int sortOrder = 1,
  String status = 'confirmed',
  bool labelPrinted = false,
  bool withOrder = true,
}) =>
    {
      'roster_id': rosterId,
      'group_label': groupLabel,
      'on_set_today': onSetToday,
      'sort_order': sortOrder,
      'person': {
        'id': 'person-$rosterId',
        'name': 'Ava Stone',
        'role': 'DP',
        'department': department,
        'company': '',
        'photo_url': '',
        'usual_order': '',
      },
      'order': withOrder
          ? {
              'id': orderId,
              'drink_type': 'Latte',
              'size': '',
              'temperature': 'Iced',
              'milk_type': 'Oat',
              'sweetener': '',
              'caffeine': '',
              'special_notes': '',
              'vendor': '',
              'status': status,
              'label_printed': labelPrinted,
              'updated_at': '2026-07-15T18:00:00.000Z',
            }
          : null,
    };

Map<String, Object?> _boardJson(List<Map<String, Object?>> roster) => {
      'data': {
        'production': {
          'id': 'prod-1',
          'name': 'Launch shoot',
          'shoot_date': '',
          'location': '',
          'runner_name': '',
          'status': 'active',
          'client_name': 'Capture This',
        },
        'roster': roster,
      },
    };

void main() {
  group('board parsing', () {
    test('unwraps the route envelope and reads the production', () {
      final board = ProductionBoard.fromJson(_boardJson([_rosterJson()]));

      expect(board.production.name, 'Launch shoot');
      expect(board.production.clientName, 'Capture This');
      expect(board.production.isActive, isTrue);
      expect(board.roster.single.person.name, 'Ava Stone');
    });

    test('sorts the roster by sort order', () {
      final board = ProductionBoard.fromJson(_boardJson([
        _rosterJson(rosterId: 'roster-3', orderId: 'order-3', sortOrder: 3),
        _rosterJson(rosterId: 'roster-1', orderId: 'order-1', sortOrder: 1),
        _rosterJson(rosterId: 'roster-2', orderId: 'order-2', sortOrder: 2),
      ]));

      expect(
        board.roster.map((entry) => entry.rosterId),
        ['roster-1', 'roster-2', 'roster-3'],
      );
    });

    test('keeps roster entries that have no order row', () {
      // The public API never creates orders, so these people exist but cannot
      // be captured for. Dropping them would hide someone who is on set.
      final board =
          ProductionBoard.fromJson(_boardJson([_rosterJson(withOrder: false)]));

      expect(board.roster, hasLength(1));
      expect(board.roster.single.order, isNull);
    });

    test('rejects a malformed roster entry', () {
      expect(
        () => ProductionBoard.fromJson(_boardJson([
          {'roster_id': 'roster-1', 'on_set_today': true},
        ])),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('group resolution', () {
    test('prefers the roster group label', () {
      final board = ProductionBoard.fromJson(
        _boardJson([_rosterJson(groupLabel: 'Camera', department: 'Grip')]),
      );
      expect(board.roster.single.group, 'Camera');
    });

    test('falls back to the person department', () {
      final board = ProductionBoard.fromJson(
        _boardJson([_rosterJson(groupLabel: '', department: 'Grip')]),
      );
      expect(board.roster.single.group, 'Grip');
    });

    test('falls back to Set when neither is known', () {
      // Matches buildPrinterQueue: group_label -> department -> "Set". The
      // label renderer's own "ON SET" default is unreachable through this path.
      final board = ProductionBoard.fromJson(
        _boardJson([_rosterJson(groupLabel: '', department: '')]),
      );
      expect(board.roster.single.group, 'Set');
    });
  });

  group('print queue derivation', () {
    test('formats the drink from raw order columns', () {
      final board = ProductionBoard.fromJson(_boardJson([_rosterJson()]));
      final queue = PrinterQueue.fromBoard(board);

      // Same string the server queue used to send for this order.
      expect(queue.labels.single.drink, 'Iced, Latte, Oat milk');
      expect(queue.labels.single.personName, 'Ava Stone');
      expect(queue.labels.single.group, 'Camera');
    });

    test('carries the production identity for the label brand line', () {
      final queue =
          PrinterQueue.fromBoard(ProductionBoard.fromJson(_boardJson([])));

      expect(queue.productionName, 'Launch shoot');
      expect(queue.clientName, 'Capture This');
      expect(queue.isProductionActive, isTrue);
    });

    test('excludes waiting and declined orders', () {
      for (final status in ['not_asked', 'no_order']) {
        final queue = PrinterQueue.fromBoard(
          ProductionBoard.fromJson(_boardJson([_rosterJson(status: status)])),
        );
        expect(queue.labels, isEmpty, reason: status);
      }
    });

    test('includes every captured status, printed ones included', () {
      for (final status in ['confirmed', 'ordered', 'picked_up', 'delivered']) {
        final queue = PrinterQueue.fromBoard(ProductionBoard.fromJson(
          _boardJson([_rosterJson(status: status, labelPrinted: true)]),
        ));
        // Already-printed labels stay so reprints remain possible.
        expect(queue.labels.single.labelPrinted, isTrue, reason: status);
      }
    });

    test('excludes people who are not on set today', () {
      final queue = PrinterQueue.fromBoard(
        ProductionBoard.fromJson(_boardJson([_rosterJson(onSetToday: false)])),
      );
      expect(queue.labels, isEmpty);
    });

    test('excludes roster entries with no order row', () {
      final queue = PrinterQueue.fromBoard(
        ProductionBoard.fromJson(_boardJson([_rosterJson(withOrder: false)])),
      );
      expect(queue.labels, isEmpty);
    });

    test('preserves roster order', () {
      final queue = PrinterQueue.fromBoard(ProductionBoard.fromJson(_boardJson([
        _rosterJson(rosterId: 'roster-2', orderId: 'order-2', sortOrder: 2),
        _rosterJson(rosterId: 'roster-1', orderId: 'order-1', sortOrder: 1),
      ])));

      expect(
        queue.labels.map((label) => label.orderId),
        ['order-1', 'order-2'],
      );
    });
  });

  group('cache round trip', () {
    test('survives encode and decode unchanged', () {
      final original = boardFixture(
        name: 'Review Day',
        status: 'active',
        roster: [
          boardEntry(
            orderId: 'order-1',
            personName: 'Jamie Example',
            drink: 'Iced oat latte',
            group: 'Crew',
          ),
        ],
      );

      final restored = ProductionBoard.tryDecode(original.encode());

      expect(restored, isNotNull);
      expect(restored!.production.name, 'Review Day');
      expect(restored.production.clientName, 'Capture This');
      expect(restored.roster.single.person.name, 'Jamie Example');
      expect(
        PrinterQueue.fromBoard(restored).labels.single.drink,
        PrinterQueue.fromBoard(original).labels.single.drink,
      );
    });

    test('returns null for junk rather than throwing', () {
      expect(ProductionBoard.tryDecode(null), isNull);
      expect(ProductionBoard.tryDecode(''), isNull);
      expect(ProductionBoard.tryDecode('not json'), isNull);
      expect(ProductionBoard.tryDecode('{"data":{}}'), isNull);
    });
  });
}
