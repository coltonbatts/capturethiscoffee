import 'dart:typed_data';

import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/setup_controller.dart';
import 'package:ctc_printer/setup_models.dart';
import 'package:ctc_printer/setup_repository.dart';
import 'package:ctc_printer/workspace_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('controller builds and organizes a 40-person day atomically', () async {
    final repository = MemorySetupRepository();
    final controller = SetupController(repository);
    addTearDown(controller.dispose);

    final day = await controller.createDay(DayDraft(
      name: 'Fictional Build 12 Day',
      clientName: 'Northstar Fictional',
      shootDate: DateTime(2026, 8, 4),
      location: 'Stage 12',
      notes: 'Fictional setup verification.',
    ));
    expect(day, isNotNull);

    final created = await controller.createPerson(const PersonDraft(
      name: 'Crew Person 1',
      role: 'Camera operator',
      department: 'Camera',
      company: 'Fictional Unit',
      usualOrder: 'Oat cortado',
      dietaryNotes: 'Fictional private note',
      notes: 'Fictional general note',
    ));
    expect(created?.usualOrder, 'Oat cortado');

    final photo = await controller.uploadPhoto(SetupPhotoUpload(
      bytes: Uint8List.fromList([137, 80, 78, 71]),
      fileName: 'fictional.png',
      contentType: 'image/png',
    ));
    expect(photo, contains('/person-photos/'));
    final edited = await controller.updatePerson(
      created!.id,
      created.toDraft().copyWith(
            role: 'Director of photography',
            photoUrl: photo,
          ),
    );
    expect(edited?.role, 'Director of photography');
    expect(edited?.photoUrl, photo);
    expect(await controller.photoDisplayUrl(photo!), photo);
    expect(await controller.photoDisplayUrl(photo), photo);
    expect(repository.photoDisplayRequestCount, 1);

    final pasted = [
      for (var index = 1; index <= 40; index += 1) 'Crew Person $index',
      ' crew   person 1 ',
      'CREW PERSON 40',
    ].join('\n');
    final preview = controller.previewBulk(pasted);
    expect(preview.accepted, hasLength(40));
    expect(preview.issues, hasLength(2));
    expect(await controller.commitBulk(day!.id, preview), isTrue);

    expect(controller.roster, hasLength(40));
    expect(
      controller.roster.map((member) => member.person.id).toSet(),
      hasLength(40),
    );
    expect(
      controller.roster.map((member) => member.rosterId).toSet(),
      hasLength(40),
    );
    expect(
      controller.roster.map((member) => member.orderId).toSet(),
      hasLength(40),
    );
    expect(
      controller.roster.every(
        (member) =>
            member.rosterId.isNotEmpty &&
            member.orderId.isNotEmpty &&
            member.productionId == day.id,
      ),
      isTrue,
    );

    final first = controller.roster.first;
    expect(
      await controller.updateRosterMember(
        productionId: day.id,
        rosterId: first.rosterId,
        groupLabel: 'Unit B',
        onSetToday: false,
      ),
      isTrue,
    );
    expect(controller.roster.first.groupLabel, 'Unit B');
    expect(controller.roster.first.onSetToday, isFalse);

    final lastId = controller.roster.last.rosterId;
    expect(
      await controller.reorderRoster(day.id, 39, 0),
      isTrue,
    );
    expect(controller.roster.first.rosterId, lastId);

    final removedId = controller.roster.last.rosterId;
    expect(
      await controller.removeRosterMember(
        productionId: day.id,
        rosterId: removedId,
      ),
      isTrue,
    );
    expect(controller.roster, hasLength(39));

    final board = _boardFromSetup(day, controller.roster);
    expect(board.roster, hasLength(39));
    expect(
      board.roster.every((row) => row.order?.status == 'not_asked'),
      isTrue,
    );
    expect(PrinterQueue.fromBoard(board).labels, isEmpty);
  });

  test('failed mutations never become optimistic controller success', () async {
    final day = _day();
    final person = _person();
    final repository = MemorySetupRepository(
      days: [day],
      people: [person],
    );
    final controller = SetupController(repository);
    addTearDown(controller.dispose);
    await controller.loadRoster(day.id);
    final beforePeople = controller.people.length;
    final beforeRoster = controller.roster.length;

    repository.failNextMutation = const SetupRepositoryException(
      'Setup needs a connection. Check Wi-Fi or signal, then retry.',
      kind: SetupFailureKind.onlineRequired,
    );
    final created = await controller
        .createPerson(const PersonDraft(name: 'Failure Person'));

    expect(created, isNull);
    expect(controller.people, hasLength(beforePeople));
    expect(controller.roster, hasLength(beforeRoster));
    expect(controller.failure?.kind, SetupFailureKind.onlineRequired);
    expect(controller.onlineRetryAvailable, isTrue);

    repository.failNextMutation = const SetupRepositoryException(
      'Setup needs a connection. Check Wi-Fi or signal, then retry.',
      kind: SetupFailureKind.onlineRequired,
    );
    expect(await controller.addExisting(day.id, person.id), isFalse);
    expect(controller.roster, hasLength(beforeRoster));

    final preview = controller.previewBulk('Bulk Failure Person');
    repository.failNextMutation = const SetupRepositoryException(
      'Setup needs a connection. Check Wi-Fi or signal, then retry.',
      kind: SetupFailureKind.onlineRequired,
    );
    expect(await controller.commitBulk(day.id, preview), isFalse);
    expect(controller.people, hasLength(beforePeople));
    expect(controller.roster, hasLength(beforeRoster));
  });

  test('memory bulk validation rolls back the entire logical write', () async {
    final person = _person();
    final day = _day();
    final repository = MemorySetupRepository(
      days: [day],
      people: [person],
    );
    await repository.addExistingPerson(
      productionId: day.id,
      personId: person.id,
    );
    final peopleBefore = repository.people.length;
    final rosterBefore = repository.rosters[day.id]!.length;

    await expectLater(
      repository.bulkAdd(
        productionId: day.id,
        people: [
          const BulkRosterCandidate(
            name: 'New Before Failure',
            normalizedName: 'new before failure',
            groupLabel: 'Set',
          ),
          BulkRosterCandidate(
            name: person.name,
            normalizedName: normalizeSetupNameKey(person.name),
            groupLabel: 'Set',
            existingPersonId: person.id,
          ),
        ],
      ),
      throwsA(isA<SetupRepositoryException>()),
    );
    expect(repository.people, hasLength(peopleBefore));
    expect(repository.rosters[day.id], hasLength(rosterBefore));
  });

  test('unreachable setup loads expose an honest retryable state', () async {
    final repository = MemorySetupRepository()
      ..fetchFailure = const SetupRepositoryException(
        'Setup needs a connection. Check Wi-Fi or signal, then retry.',
        kind: SetupFailureKind.onlineRequired,
      );
    final controller = SetupController(repository);
    addTearDown(controller.dispose);

    expect(await controller.loadRoster('day-1'), isFalse);
    expect(controller.failure?.kind, SetupFailureKind.onlineRequired);
    expect(controller.onlineRetryAvailable, isTrue);
    expect(controller.day, isNull);
    expect(controller.roster, isEmpty);
  });

  test('duplicate people and duplicate roster membership are rejected',
      () async {
    final person = _person();
    final day = _day();
    final repository = MemorySetupRepository(days: [day], people: [person]);

    await expectLater(
      repository.createPerson(const PersonDraft(name: '  avery   stone ')),
      throwsA(
        isA<SetupRepositoryException>().having(
          (error) => error.kind,
          'kind',
          SetupFailureKind.duplicate,
        ),
      ),
    );
    await repository.addExistingPerson(
      productionId: day.id,
      personId: person.id,
    );
    await expectLater(
      repository.addExistingPerson(
        productionId: day.id,
        personId: person.id,
      ),
      throwsA(isA<SetupRepositoryException>()),
    );
  });

  test('only planning days can be deleted', () async {
    const activeDay = SetupDay(
      id: 'active-day',
      name: 'Active Fictional Day',
      clientId: 'client-1',
      clientName: 'Fictional Client',
      shootDate: null,
      location: '',
      runnerName: '',
      notes: '',
      status: 'active',
    );
    final repository = MemorySetupRepository(days: [activeDay]);
    final controller = SetupController(repository);
    addTearDown(controller.dispose);
    await controller.loadRoster(activeDay.id);

    expect(await controller.deleteDay(activeDay.id), isFalse);
    expect(repository.days, contains(activeDay.id));
    expect(controller.day?.id, activeDay.id);
    expect(controller.failure?.kind, SetupFailureKind.invalidData);
  });

  test('malformed reorder results never replace local roster order', () async {
    final day = _day();
    final first = _person();
    const second = SetupPerson(
      id: 'person-2',
      name: 'Morgan Reed',
      type: SetupPersonType.crew,
      role: 'Producer',
      department: 'Production',
      company: 'Fictional Unit',
      photoUrl: '',
      usualOrder: '',
      dietaryNotes: '',
      notes: '',
      active: true,
    );
    final repository = MemorySetupRepository(
      days: [day],
      people: [first, second],
    );
    await repository.addExistingPerson(
      productionId: day.id,
      personId: first.id,
    );
    await repository.addExistingPerson(
      productionId: day.id,
      personId: second.id,
    );
    final controller = SetupController(repository);
    addTearDown(controller.dispose);
    await controller.loadRoster(day.id);
    final before = controller.roster.map((member) => member.rosterId).toList();
    repository.reorderResponseOverride = [
      {
        'id': before.last,
        'sort_order': 1,
      },
      {
        'id': 'unknown-roster',
        'sort_order': 2,
      },
    ];

    expect(await controller.reorderRoster(day.id, 1, 0), isFalse);
    expect(
      controller.roster.map((member) => member.rosterId),
      before,
    );
    expect(controller.failure?.kind, SetupFailureKind.invalidData);
  });
}

SetupDay _day() => const SetupDay(
      id: 'day-1',
      name: 'Fictional Day',
      clientId: 'client-1',
      clientName: 'Fictional Client',
      shootDate: null,
      location: '',
      runnerName: '',
      notes: '',
      status: 'planning',
    );

SetupPerson _person() => const SetupPerson(
      id: 'person-1',
      name: 'Avery Stone',
      type: SetupPersonType.crew,
      role: 'Camera operator',
      department: 'Camera',
      company: 'Fictional Unit',
      photoUrl: '',
      usualOrder: 'Oat cortado',
      dietaryNotes: '',
      notes: '',
      active: true,
    );

ProductionBoard _boardFromSetup(
  SetupDay day,
  List<SetupRosterMember> members,
) =>
    ProductionBoardRowAdapter.fromRows(
      production: {
        'id': day.id,
        'name': day.name,
        'client_id': day.clientId,
        'shoot_date': day.shootDate?.toIso8601String(),
        'location': day.location,
        'runner_name': day.runnerName,
        'notes': day.notes,
        'status': day.status,
      },
      client: {'id': day.clientId, 'name': day.clientName},
      roster: [
        for (final member in members)
          {
            'id': member.rosterId,
            'production_id': day.id,
            'person_id': member.person.id,
            'group_label': member.groupLabel,
            'on_set_today': member.onSetToday,
            'sort_order': member.sortOrder,
          },
      ],
      people: [
        for (final member in members)
          {
            'id': member.person.id,
            'name': member.person.name,
            'role': member.person.role,
            'department': member.person.department,
            'company': member.person.company,
            'photo_url': member.person.photoUrl,
            'usual_order': member.person.usualOrder,
          },
      ],
      orders: [
        for (final member in members)
          {
            'id': member.orderId,
            'production_id': day.id,
            'roster_id': member.rosterId,
            'person_id': member.person.id,
            'drink_type': '',
            'size': '',
            'temperature': '',
            'milk_type': '',
            'sweetener': '',
            'caffeine': '',
            'special_notes': '',
            'vendor': '',
            'status': 'not_asked',
            'label_printed': false,
            'updated_at': '2026-07-29T12:00:00Z',
          },
      ],
    );
