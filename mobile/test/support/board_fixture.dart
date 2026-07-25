/// Board fixtures for widget and screenshot tests.
///
/// The app reads `GET /api/public/productions/[id]` and derives its print queue
/// locally, so fixtures are boards now, not queues. Drink text goes in
/// `drink_type` so `formatDrink` returns it unchanged — these fixtures are about
/// screen layout, not drink composition, which `drink_format_test.dart` covers.
library;

import 'package:ctc_printer/production_board.dart';

BoardRosterEntry boardEntry({
  required String orderId,
  required String personName,
  required String drink,
  required String group,
  String status = 'confirmed',
  bool labelPrinted = false,
  int sortOrder = 0,
}) =>
    BoardRosterEntry(
      rosterId: 'roster-$orderId',
      groupLabel: group,
      onSetToday: true,
      sortOrder: sortOrder,
      person: BoardPerson(
        id: 'person-$orderId',
        name: personName,
        role: '',
        department: '',
        company: '',
        photoUrl: '',
        usualOrder: '',
      ),
      order: BoardOrder(
        id: orderId,
        drinkType: drink,
        size: '',
        temperature: '',
        milkType: '',
        sweetener: '',
        caffeine: '',
        specialNotes: '',
        vendor: '',
        status: status,
        labelPrinted: labelPrinted,
        updatedAt: '2026-07-15T18:00:00.000Z',
      ),
    );

ProductionBoard boardFixture({
  required String name,
  required String status,
  String clientName = 'Capture This',
  String productionId = 'fixture-production',
  required List<BoardRosterEntry> roster,
}) =>
    ProductionBoard(
      production: BoardProduction(
        id: productionId,
        name: name,
        shootDate: '',
        location: '',
        runnerName: '',
        status: status,
        clientName: clientName,
      ),
      roster: roster,
    );
