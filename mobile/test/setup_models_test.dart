import 'package:ctc_printer/setup_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('setup DTOs parse valid rows and reject broken relationships', () {
    final person = SetupPerson.fromJson(_person('person-1', 'Avery Stone'));
    expect(person.name, 'Avery Stone');
    expect(person.type, SetupPersonType.crew);
    expect(person.usualOrder, 'Oat cortado');

    final member = SetupRosterMember.fromRows(
      roster: _roster('roster-1', 'person-1'),
      person: _person('person-1', 'Avery Stone'),
      order: _order('order-1', 'roster-1', 'person-1'),
    );
    expect(member.orderId, 'order-1');
    expect(member.groupLabel, 'Camera');

    expect(
      () => SetupRosterMember.fromRows(
        roster: _roster('roster-1', 'person-1'),
        person: _person('person-2', 'Wrong Person'),
        order: _order('order-1', 'roster-1', 'person-1'),
      ),
      throwsFormatException,
    );
  });

  test('bulk preview normalizes 40 names and resolves duplicates before write',
      () {
    final existing = SetupPerson.fromJson(_person('person-1', 'Crew Person 1'));
    final archived = SetupPerson.fromJson({
      ..._person('person-2', 'Retired Person'),
      'active': false,
    });
    final names = [
      for (var index = 1; index <= 40; index += 1) 'Crew Person $index',
    ];
    final raw = [
      ...names.take(20),
      '  crew   person 1 ',
      'Retired Person',
      ...names.skip(20),
      'CREW PERSON 40',
      '',
    ].join(',\n');

    final preview = BulkRosterPreview.parse(
      raw: raw,
      people: [existing, archived],
      rosterPersonIds: const [],
    );

    expect(preview.accepted, hasLength(40));
    expect(preview.accepted.first.name, 'Crew Person 1');
    expect(preview.accepted.first.existingPersonId, 'person-1');
    expect(
      preview.issues.map((issue) => issue.kind),
      containsAll([
        BulkRosterIssueKind.duplicatePaste,
        BulkRosterIssueKind.archivedMatch,
      ]),
    );
    expect(preview.canCommit, isTrue);
  });

  test('bulk preview excludes people already on the roster', () {
    final existing = SetupPerson.fromJson(_person('person-1', 'Avery Stone'));
    final preview = BulkRosterPreview.parse(
      raw: ' Avery   Stone, New Person ',
      people: [existing],
      rosterPersonIds: const ['person-1'],
    );

    expect(preview.accepted.single.name, 'New Person');
    expect(preview.issues.single.kind, BulkRosterIssueKind.alreadyOnRoster);
  });

  test('draft validation rejects blank and overlong values', () {
    expect(
        () => const PersonDraft(name: ' ').normalized(), throwsFormatException);
    expect(
      () => PersonDraft(name: 'A', notes: 'x' * 2001).normalized(),
      throwsFormatException,
    );
    expect(
      () => const DayDraft(name: 'Day', status: 'unknown').normalized(),
      throwsFormatException,
    );
  });
}

Map<String, dynamic> _person(String id, String name) => {
      'id': id,
      'name': name,
      'type': 'crew',
      'role': 'Camera operator',
      'department': 'Camera',
      'company': 'Fictional Unit',
      'photo_url': '',
      'usual_order': 'Oat cortado',
      'dietary_notes': 'Fictional note',
      'notes': 'Fictional person',
      'active': true,
    };

Map<String, dynamic> _roster(String id, String personId) => {
      'id': id,
      'production_id': 'day-1',
      'person_id': personId,
      'group_label': 'Camera',
      'on_set_today': true,
      'sort_order': 1,
    };

Map<String, dynamic> _order(String id, String rosterId, String personId) => {
      'id': id,
      'production_id': 'day-1',
      'roster_id': rosterId,
      'person_id': personId,
    };
