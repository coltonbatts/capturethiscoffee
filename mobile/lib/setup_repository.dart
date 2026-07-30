import 'dart:async';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

import 'setup_models.dart';

enum SetupFailureKind {
  onlineRequired,
  unauthorized,
  duplicate,
  notFound,
  invalidData,
  other,
}

class SetupRepositoryException implements Exception {
  const SetupRepositoryException(this.message, {required this.kind});

  final String message;
  final SetupFailureKind kind;

  bool get retryable => kind == SetupFailureKind.onlineRequired;

  @override
  String toString() => message;
}

abstract interface class SetupRepository {
  Future<List<SetupClient>> fetchClients();

  Future<List<SetupPerson>> fetchPeople();

  Future<SetupDay> fetchDay(String productionId);

  Future<SetupRosterSnapshot> fetchRoster(String productionId);

  Future<SetupDay> createDay(DayDraft draft);

  Future<SetupDay> updateDay(String productionId, DayDraft draft);

  Future<void> deleteDay(String productionId);

  Future<SetupPerson> createPerson(PersonDraft draft);

  Future<SetupPerson> updatePerson(String personId, PersonDraft draft);

  Future<String> uploadPersonPhoto(SetupPhotoUpload photo);

  Future<String?> createPersonPhotoDisplayUrl(String storedReference);

  Future<SetupRosterMember> addExistingPerson({
    required String productionId,
    required String personId,
  });

  Future<SetupRosterMember> createPersonAndAdd({
    required String productionId,
    required PersonDraft person,
    bool linkToClient = false,
  });

  Future<List<SetupRosterMember>> bulkAdd({
    required String productionId,
    required List<BulkRosterCandidate> people,
  });

  Future<Map<String, dynamic>> updateRosterMember({
    required String productionId,
    required String rosterId,
    required String groupLabel,
    required bool onSetToday,
  });

  Future<void> removeRosterMember({
    required String productionId,
    required String rosterId,
  });

  Future<List<Map<String, dynamic>>> reorderRoster({
    required String productionId,
    required List<String> rosterIds,
  });
}

class SupabaseSetupRepository implements SetupRepository {
  SupabaseSetupRepository(this._client);

  final SupabaseClient _client;

  static const _dayColumns =
      'id,name,client_id,shoot_date,location,runner_name,notes,status';
  static const _clientColumns = 'id,name,active';
  static const _personColumns =
      'id,name,type,role,department,company,photo_url,usual_order,'
      'dietary_notes,notes,active';
  static const _rosterColumns =
      'id,production_id,person_id,group_label,on_set_today,sort_order';
  static const _orderIdentityColumns = 'id,production_id,roster_id,person_id';
  static const _photoBucket = 'person-photos';
  static const _maxPhotoBytes = 8 * 1024 * 1024;
  static const _photoContentTypes = {
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  };

  @override
  Future<List<SetupClient>> fetchClients() => _read(() async {
        final rows = _rows(await _client
            .from('clients')
            .select(_clientColumns)
            .order('name')
            .limit(1000));
        return rows.map(SetupClient.fromJson).toList(growable: false);
      }, invalidMessage: 'The workspace returned invalid client data.');

  @override
  Future<List<SetupPerson>> fetchPeople() => _read(() async {
        final rows = _rows(await _client
            .from('people')
            .select(_personColumns)
            .order('name')
            .limit(1000));
        return rows.map(SetupPerson.fromJson).toList(growable: false);
      }, invalidMessage: 'The workspace returned invalid people data.');

  @override
  Future<SetupDay> fetchDay(String productionId) => _read(() async {
        final productionValue = await _client
            .from('productions')
            .select(_dayColumns)
            .eq('id', productionId)
            .maybeSingle();
        if (productionValue == null) {
          throw const SetupRepositoryException(
            'This day is no longer available.',
            kind: SetupFailureKind.notFound,
          );
        }
        final production = _row(productionValue);
        final clientValue = await _client
            .from('clients')
            .select(_clientColumns)
            .eq('id', production['client_id'])
            .maybeSingle();
        return SetupDay.fromRows(
          production: production,
          client: clientValue == null ? null : _row(clientValue),
        );
      }, invalidMessage: 'The workspace returned invalid day data.');

  @override
  Future<SetupRosterSnapshot> fetchRoster(String productionId) =>
      _read(() async {
        final day = await fetchDay(productionId);
        final roster = _rows(await _client
            .from('production_roster')
            .select(_rosterColumns)
            .eq('production_id', productionId)
            .order('sort_order'));
        if (roster.isEmpty) {
          return SetupRosterSnapshot(day: day, members: const []);
        }
        final personIds =
            roster.map((row) => _requiredId(row, 'person_id')).toSet().toList();
        final people = _rows(await _client
            .from('people')
            .select(_personColumns)
            .inFilter('id', personIds));
        final orders = _rows(await _client
            .from('orders')
            .select(_orderIdentityColumns)
            .eq('production_id', productionId));
        final peopleById = {
          for (final person in people) _requiredId(person, 'id'): person,
        };
        final ordersByRoster = <String, Map<String, dynamic>>{};
        for (final order in orders) {
          final rosterId = _requiredId(order, 'roster_id');
          if (ordersByRoster.containsKey(rosterId)) {
            throw const FormatException('Roster has duplicate orders.');
          }
          ordersByRoster[rosterId] = order;
        }
        final members = <SetupRosterMember>[];
        for (final row in roster) {
          final rosterId = _requiredId(row, 'id');
          final person = peopleById[_requiredId(row, 'person_id')];
          final order = ordersByRoster[rosterId];
          if (person == null || order == null) {
            throw const FormatException('Roster is missing a person or order.');
          }
          members.add(SetupRosterMember.fromRows(
            roster: row,
            person: person,
            order: order,
          ));
        }
        return SetupRosterSnapshot(
          day: day,
          members: List.unmodifiable(members),
        );
      }, invalidMessage: 'The workspace returned an invalid roster.');

  @override
  Future<SetupDay> createDay(DayDraft draft) => _write(() async {
        final value = draft.normalized();
        final result = await _client.rpc('setup_create_day', params: {
          'p_name': value.name,
          'p_client_id': _nullable(value.clientId),
          'p_client_name': _nullable(value.clientName),
          'p_shoot_date': _dateValue(value.shootDate),
          'p_location': _nullable(value.location),
          'p_runner_name': _nullable(value.runnerName),
          'p_notes': _nullable(value.notes),
          'p_status': value.status,
          'p_seed_default_roster': false,
        });
        final payload = _row(result);
        return SetupDay.fromRows(
          production: _row(payload['production']),
          client: _row(payload['client']),
        );
      });

  @override
  Future<SetupDay> updateDay(String productionId, DayDraft draft) =>
      _write(() async {
        final value = draft.normalized();
        final result = await _client.rpc('setup_update_day', params: {
          'p_production_id': productionId,
          'p_name': value.name,
          'p_client_id': _nullable(value.clientId),
          'p_client_name': _nullable(value.clientName),
          'p_shoot_date': _dateValue(value.shootDate),
          'p_location': _nullable(value.location),
          'p_runner_name': _nullable(value.runnerName),
          'p_notes': _nullable(value.notes),
          'p_status': value.status,
        });
        final payload = _row(result);
        return SetupDay.fromRows(
          production: _row(payload['production']),
          client: _row(payload['client']),
        );
      });

  @override
  Future<void> deleteDay(String productionId) => _write(() async {
        final result = await _client.rpc(
          'setup_delete_planning_day',
          params: {'p_production_id': productionId},
        );
        if (result != productionId) {
          throw const SetupRepositoryException(
            'The workspace returned invalid day deletion data.',
            kind: SetupFailureKind.invalidData,
          );
        }
      });

  @override
  Future<SetupPerson> createPerson(PersonDraft draft) => _write(() async {
        final value = draft.normalized();
        final result = await _client.rpc('setup_create_person', params: {
          'p_name': value.name,
          'p_type': value.type.value,
          'p_role': _nullable(value.role),
          'p_department': _nullable(value.department),
          'p_company': _nullable(value.company),
          'p_photo_url': _nullable(value.photoUrl),
          'p_usual_order': _nullable(value.usualOrder),
          'p_dietary_notes': _nullable(value.dietaryNotes),
          'p_notes': _nullable(value.notes),
          'p_active': value.active,
        });
        return SetupPerson.fromJson(_row(result));
      });

  @override
  Future<SetupPerson> updatePerson(String personId, PersonDraft draft) =>
      _write(() async {
        final value = draft.normalized();
        final result = await _client.rpc('setup_update_person', params: {
          'p_person_id': personId,
          'p_name': value.name,
          'p_type': value.type.value,
          'p_role': _nullable(value.role),
          'p_department': _nullable(value.department),
          'p_company': _nullable(value.company),
          'p_photo_url': _nullable(value.photoUrl),
          'p_usual_order': _nullable(value.usualOrder),
          'p_dietary_notes': _nullable(value.dietaryNotes),
          'p_notes': _nullable(value.notes),
          'p_active': value.active,
        });
        return SetupPerson.fromJson(_row(result));
      });

  @override
  Future<String> uploadPersonPhoto(SetupPhotoUpload photo) => _write(() async {
        if (photo.bytes.isEmpty || photo.bytes.length > _maxPhotoBytes) {
          throw const SetupRepositoryException(
            'Choose a photo under 8 MB.',
            kind: SetupFailureKind.invalidData,
          );
        }
        if (!_photoContentTypes.contains(photo.contentType.toLowerCase())) {
          throw const SetupRepositoryException(
            'Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF image.',
            kind: SetupFailureKind.invalidData,
          );
        }
        final extension = _safeExtension(photo.fileName, photo.contentType);
        final now = DateTime.now().toUtc();
        final date =
            '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
        final path = '$date/${_randomStorageId()}.$extension';
        await _client.storage.from(_photoBucket).uploadBinary(
              path,
              photo.bytes,
              fileOptions: FileOptions(
                cacheControl: '31536000',
                contentType: photo.contentType,
                upsert: false,
              ),
            );
        // This URL is a stable storage reference, not a claim that the private
        // bucket is publicly readable. Both web and mobile extract the path and
        // mint a short-lived signed display URL.
        return _client.storage.from(_photoBucket).getPublicUrl(path);
      });

  @override
  Future<String?> createPersonPhotoDisplayUrl(String storedReference) async {
    final path = personPhotoStoragePath(storedReference);
    if (path == null) {
      return storedReference.trim().isEmpty ? null : storedReference;
    }
    return _read(
      () => _client.storage.from(_photoBucket).createSignedUrl(path, 3600),
      invalidMessage: 'The person photo reference is invalid.',
    );
  }

  @override
  Future<SetupRosterMember> addExistingPerson({
    required String productionId,
    required String personId,
  }) =>
      _write(() async {
        final result = await _client.rpc(
          'setup_add_person_to_roster',
          params: {
            'p_production_id': productionId,
            'p_person_id': personId,
          },
        );
        return _memberFromRpc(result);
      });

  @override
  Future<SetupRosterMember> createPersonAndAdd({
    required String productionId,
    required PersonDraft person,
    bool linkToClient = false,
  }) =>
      _write(() async {
        final value = person.normalized();
        final result = await _client.rpc(
          'setup_create_person_and_add_to_roster',
          params: {
            'p_production_id': productionId,
            'p_name': value.name,
            'p_type': value.type.value,
            'p_role': _nullable(value.role),
            'p_department': _nullable(value.department),
            'p_company': _nullable(value.company),
            'p_photo_url': _nullable(value.photoUrl),
            'p_usual_order': _nullable(value.usualOrder),
            'p_dietary_notes': _nullable(value.dietaryNotes),
            'p_notes': _nullable(value.notes),
            'p_group_label': _nullable(value.department),
            'p_on_set_today': true,
            'p_link_to_client': linkToClient,
          },
        );
        return _memberFromRpc(result);
      });

  @override
  Future<List<SetupRosterMember>> bulkAdd({
    required String productionId,
    required List<BulkRosterCandidate> people,
  }) =>
      _write(() async {
        final result = await _client.rpc('setup_bulk_add_roster', params: {
          'p_production_id': productionId,
          'p_people': people.map((person) => person.toJson()).toList(),
        });
        return _rows(result).map(_memberFromRpc).toList(growable: false);
      });

  @override
  Future<Map<String, dynamic>> updateRosterMember({
    required String productionId,
    required String rosterId,
    required String groupLabel,
    required bool onSetToday,
  }) =>
      _write(() async {
        final result = await _client
            .from('production_roster')
            .update({
              'group_label': _nullable(groupLabel.trim()),
              'on_set_today': onSetToday,
            })
            .eq('id', rosterId)
            .eq('production_id', productionId)
            .select(_rosterColumns)
            .maybeSingle();
        if (result == null) {
          throw const SetupRepositoryException(
            'Roster member not found.',
            kind: SetupFailureKind.notFound,
          );
        }
        return _row(result);
      });

  @override
  Future<void> removeRosterMember({
    required String productionId,
    required String rosterId,
  }) =>
      _write(() async {
        final result = await _client
            .from('production_roster')
            .delete()
            .eq('id', rosterId)
            .eq('production_id', productionId)
            .select('id')
            .maybeSingle();
        if (result == null) {
          throw const SetupRepositoryException(
            'Roster member not found.',
            kind: SetupFailureKind.notFound,
          );
        }
      });

  @override
  Future<List<Map<String, dynamic>>> reorderRoster({
    required String productionId,
    required List<String> rosterIds,
  }) =>
      _write(() async {
        final result = await _client.rpc('setup_reorder_roster', params: {
          'p_production_id': productionId,
          'p_roster_ids': rosterIds,
        });
        return _rows(result);
      });

  SetupRosterMember _memberFromRpc(Object? value) {
    final payload = _row(value);
    return SetupRosterMember.fromRows(
      roster: _row(payload['roster']),
      person: _row(payload['person']),
      order: _row(payload['order']),
    );
  }

  Future<T> _read<T>(
    Future<T> Function() operation, {
    required String invalidMessage,
  }) async {
    try {
      return await operation().timeout(const Duration(seconds: 20));
    } on SetupRepositoryException {
      rethrow;
    } on FormatException {
      throw SetupRepositoryException(
        invalidMessage,
        kind: SetupFailureKind.invalidData,
      );
    } on PostgrestException catch (error) {
      throw _postgrestFailure(error);
    } on StorageException catch (error) {
      throw _storageFailure(error);
    } on TimeoutException {
      throw _onlineFailure();
    } on SocketException {
      throw _onlineFailure();
    } catch (_) {
      throw _onlineFailure();
    }
  }

  Future<T> _write<T>(Future<T> Function() operation) => _read(
        operation,
        invalidMessage: 'The workspace returned invalid setup data.',
      );
}

class MemorySetupRepository implements SetupRepository {
  MemorySetupRepository({
    List<SetupClient> clients = const [],
    List<SetupPerson> people = const [],
    List<SetupDay> days = const [],
    Map<String, List<SetupRosterMember>> rosters = const {},
  })  : clients = List.of(clients),
        people = List.of(people),
        days = {for (final day in days) day.id: day},
        rosters = {
          for (final entry in rosters.entries) entry.key: List.of(entry.value),
        };

  final List<SetupClient> clients;
  final List<SetupPerson> people;
  final Map<String, SetupDay> days;
  final Map<String, List<SetupRosterMember>> rosters;
  SetupRepositoryException? failNextMutation;
  SetupRepositoryException? fetchFailure;
  List<Map<String, dynamic>>? reorderResponseOverride;
  int mutationCount = 0;
  int photoDisplayRequestCount = 0;
  int _id = 1;

  @override
  Future<List<SetupClient>> fetchClients() async {
    _throwFetch();
    return List.unmodifiable(clients);
  }

  @override
  Future<List<SetupPerson>> fetchPeople() async {
    _throwFetch();
    return List.unmodifiable(people);
  }

  @override
  Future<SetupDay> fetchDay(String productionId) async {
    _throwFetch();
    final day = days[productionId];
    if (day == null) throw _notFound('Day not found.');
    return day;
  }

  @override
  Future<SetupRosterSnapshot> fetchRoster(String productionId) async {
    final day = await fetchDay(productionId);
    return SetupRosterSnapshot(
      day: day,
      members: List.unmodifiable(rosters[productionId] ?? const []),
    );
  }

  @override
  Future<SetupDay> createDay(DayDraft draft) async {
    _beginMutation();
    final value = draft.normalized();
    final client = _resolveClient(value);
    final day = SetupDay(
      id: _next('day'),
      name: value.name,
      clientId: client.id,
      clientName: client.name,
      shootDate: value.shootDate,
      location: value.location,
      runnerName: value.runnerName,
      notes: value.notes,
      status: value.status,
    );
    days[day.id] = day;
    rosters[day.id] = [];
    return day;
  }

  @override
  Future<SetupDay> updateDay(String productionId, DayDraft draft) async {
    _beginMutation();
    if (!days.containsKey(productionId)) throw _notFound('Day not found.');
    final value = draft.normalized();
    final client = _resolveClient(value);
    final day = SetupDay(
      id: productionId,
      name: value.name,
      clientId: client.id,
      clientName: client.name,
      shootDate: value.shootDate,
      location: value.location,
      runnerName: value.runnerName,
      notes: value.notes,
      status: value.status,
    );
    days[productionId] = day;
    return day;
  }

  @override
  Future<void> deleteDay(String productionId) async {
    _beginMutation();
    final day = days[productionId];
    if (day == null) throw _notFound('Day not found.');
    if (day.status != 'planning') {
      throw const SetupRepositoryException(
        'Only planning days can be deleted.',
        kind: SetupFailureKind.invalidData,
      );
    }
    days.remove(productionId);
    rosters.remove(productionId);
  }

  @override
  Future<SetupPerson> createPerson(PersonDraft draft) async {
    _beginMutation();
    final value = draft.normalized();
    _assertUniquePerson(value.name);
    final person = _personFromDraft(_next('person'), value);
    people.add(person);
    return person;
  }

  @override
  Future<SetupPerson> updatePerson(String personId, PersonDraft draft) async {
    _beginMutation();
    final index = people.indexWhere((person) => person.id == personId);
    if (index == -1) throw _notFound('Person not found.');
    final value = draft.normalized();
    _assertUniquePerson(value.name, exceptId: personId);
    final person = _personFromDraft(personId, value);
    people[index] = person;
    for (final entry in rosters.entries) {
      entry.value.replaceRange(0, entry.value.length, [
        for (final member in entry.value)
          if (member.person.id == personId)
            member.copyWith(person: person)
          else
            member,
      ]);
    }
    return person;
  }

  @override
  Future<String> uploadPersonPhoto(SetupPhotoUpload photo) async {
    _beginMutation();
    if (photo.bytes.isEmpty || photo.bytes.length > 8 * 1024 * 1024) {
      throw const SetupRepositoryException(
        'Choose a photo under 8 MB.',
        kind: SetupFailureKind.invalidData,
      );
    }
    if (!const {
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
    }.contains(photo.contentType.toLowerCase())) {
      throw const SetupRepositoryException(
        'Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF image.',
        kind: SetupFailureKind.invalidData,
      );
    }
    return 'https://example.supabase.co/storage/v1/object/public/'
        'person-photos/fictional/${_next('photo')}.jpg';
  }

  @override
  Future<String?> createPersonPhotoDisplayUrl(String storedReference) async {
    photoDisplayRequestCount += 1;
    return storedReference.trim().isEmpty ? null : storedReference;
  }

  @override
  Future<SetupRosterMember> addExistingPerson({
    required String productionId,
    required String personId,
  }) async {
    _beginMutation();
    final person = people.where((item) => item.id == personId).firstOrNull;
    if (person == null || !person.active) throw _notFound('Person not found.');
    return _addMember(productionId, person);
  }

  @override
  Future<SetupRosterMember> createPersonAndAdd({
    required String productionId,
    required PersonDraft person,
    bool linkToClient = false,
  }) async {
    _beginMutation();
    _requireDay(productionId);
    final value = person.normalized();
    _assertUniquePerson(value.name);
    final created = _personFromDraft(_next('person'), value);
    final member = _newMember(productionId, created);
    people.add(created);
    rosters.putIfAbsent(productionId, () => []).add(member);
    return member;
  }

  @override
  Future<List<SetupRosterMember>> bulkAdd({
    required String productionId,
    required List<BulkRosterCandidate> people,
  }) async {
    _beginMutation();
    _requireDay(productionId);
    if (people.isEmpty || people.length > 200) {
      throw const SetupRepositoryException(
        'Bulk roster must contain between 1 and 200 people.',
        kind: SetupFailureKind.invalidData,
      );
    }
    final roster = rosters.putIfAbsent(productionId, () => []);
    final rosterPersonIds = roster.map((member) => member.person.id).toSet();
    final names = <String>{};
    final resolved = <SetupPerson>[];
    for (final candidate in people) {
      if (!names.add(candidate.normalizedName)) throw _duplicate();
      final existing = candidate.existingPersonId == null
          ? this
              .people
              .where((person) =>
                  normalizeSetupNameKey(person.name) ==
                  candidate.normalizedName)
              .firstOrNull
          : this
              .people
              .where((person) => person.id == candidate.existingPersonId)
              .firstOrNull;
      if (existing != null) {
        if (!existing.active || rosterPersonIds.contains(existing.id)) {
          throw _duplicate();
        }
        resolved.add(existing);
      } else {
        _assertUniquePerson(candidate.name);
        resolved.add(_personFromDraft(
          _next('person'),
          PersonDraft(name: candidate.name),
        ));
      }
    }
    final added = <SetupRosterMember>[];
    for (var index = 0; index < resolved.length; index += 1) {
      final person = resolved[index];
      if (!this.people.any((item) => item.id == person.id)) {
        this.people.add(person);
      }
      final member = _newMember(
        productionId,
        person,
        groupLabel: people[index].groupLabel,
      );
      roster.add(member);
      added.add(member);
    }
    return List.unmodifiable(added);
  }

  @override
  Future<Map<String, dynamic>> updateRosterMember({
    required String productionId,
    required String rosterId,
    required String groupLabel,
    required bool onSetToday,
  }) async {
    _beginMutation();
    final roster = rosters[productionId];
    final index =
        roster?.indexWhere((member) => member.rosterId == rosterId) ?? -1;
    if (roster == null || index == -1) {
      throw _notFound('Roster member not found.');
    }
    final updated = roster[index].copyWith(
      groupLabel: groupLabel.trim(),
      onSetToday: onSetToday,
    );
    roster[index] = updated;
    return _rosterRow(updated);
  }

  @override
  Future<void> removeRosterMember({
    required String productionId,
    required String rosterId,
  }) async {
    _beginMutation();
    final roster = rosters[productionId];
    final before = roster?.length ?? 0;
    roster?.removeWhere((member) => member.rosterId == rosterId);
    if (roster == null || roster.length == before) {
      throw _notFound('Roster member not found.');
    }
  }

  @override
  Future<List<Map<String, dynamic>>> reorderRoster({
    required String productionId,
    required List<String> rosterIds,
  }) async {
    _beginMutation();
    final roster = rosters[productionId] ?? [];
    if (rosterIds.length != roster.length ||
        rosterIds.toSet().length != roster.length ||
        !rosterIds
            .toSet()
            .containsAll(roster.map((member) => member.rosterId))) {
      throw const SetupRepositoryException(
        'Roster reorder must include every member exactly once.',
        kind: SetupFailureKind.invalidData,
      );
    }
    final byId = {for (final member in roster) member.rosterId: member};
    final ordered = [
      for (var index = 0; index < rosterIds.length; index += 1)
        byId[rosterIds[index]]!.copyWith(sortOrder: index + 1),
    ];
    rosters[productionId] = ordered;
    return reorderResponseOverride ??
        ordered.map(_rosterRow).toList(growable: false);
  }

  SetupClient _resolveClient(DayDraft draft) {
    if (draft.clientId != null) {
      final client =
          clients.where((client) => client.id == draft.clientId).firstOrNull;
      if (client == null) throw _notFound('Client not found.');
      return client;
    }
    final requested = draft.clientName.isEmpty ? draft.name : draft.clientName;
    final existing = clients
        .where((client) =>
            normalizeSetupNameKey(client.name) ==
            normalizeSetupNameKey(requested))
        .firstOrNull;
    if (existing != null) return existing;
    final client =
        SetupClient(id: _next('client'), name: requested, active: true);
    clients.add(client);
    return client;
  }

  SetupPerson _personFromDraft(String id, PersonDraft value) => SetupPerson(
        id: id,
        name: value.name,
        type: value.type,
        role: value.role,
        department: value.department,
        company: value.company,
        photoUrl: value.photoUrl,
        usualOrder: value.usualOrder,
        dietaryNotes: value.dietaryNotes,
        notes: value.notes,
        active: value.active,
      );

  SetupRosterMember _addMember(String productionId, SetupPerson person) {
    _requireDay(productionId);
    final roster = rosters.putIfAbsent(productionId, () => []);
    if (roster.any((member) => member.person.id == person.id)) {
      throw _duplicate();
    }
    final member = _newMember(productionId, person);
    roster.add(member);
    return member;
  }

  SetupRosterMember _newMember(
    String productionId,
    SetupPerson person, {
    String? groupLabel,
  }) {
    final sortOrder = (rosters[productionId]?.length ?? 0) + 1;
    return SetupRosterMember(
      rosterId: _next('roster'),
      productionId: productionId,
      person: person,
      orderId: _next('order'),
      groupLabel: groupLabel ??
          (person.department.isNotEmpty
              ? person.department
              : person.company.isNotEmpty
                  ? person.company
                  : 'Set'),
      onSetToday: true,
      sortOrder: sortOrder,
    );
  }

  void _requireDay(String productionId) {
    if (!days.containsKey(productionId)) throw _notFound('Day not found.');
  }

  void _assertUniquePerson(String name, {String? exceptId}) {
    final key = normalizeSetupNameKey(name);
    if (people.any((person) =>
        person.id != exceptId && normalizeSetupNameKey(person.name) == key)) {
      throw _duplicate();
    }
  }

  void _beginMutation() {
    mutationCount += 1;
    final failure = failNextMutation;
    failNextMutation = null;
    if (failure != null) throw failure;
  }

  void _throwFetch() {
    final failure = fetchFailure;
    if (failure != null) throw failure;
  }

  String _next(String prefix) => '$prefix-${_id++}';
}

Map<String, dynamic> _rosterRow(SetupRosterMember member) => {
      'id': member.rosterId,
      'production_id': member.productionId,
      'person_id': member.person.id,
      'group_label': member.groupLabel,
      'on_set_today': member.onSetToday,
      'sort_order': member.sortOrder,
    };

Map<String, dynamic> _row(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw const FormatException('Invalid table row.');
}

List<Map<String, dynamic>> _rows(Object? value) {
  if (value is! List) throw const FormatException('Invalid table rows.');
  return value.map(_row).toList(growable: false);
}

String _requiredId(Map<String, dynamic> row, String key) {
  final value = row[key];
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('Invalid $key.');
  }
  return value;
}

String? _nullable(String? value) {
  final normalized = value?.trim() ?? '';
  return normalized.isEmpty ? null : normalized;
}

String? _dateValue(DateTime? value) => value == null
    ? null
    : '${value.year.toString().padLeft(4, '0')}-'
        '${value.month.toString().padLeft(2, '0')}-'
        '${value.day.toString().padLeft(2, '0')}';

String? personPhotoStoragePath(String storedReference) {
  final value = storedReference.trim();
  if (value.isEmpty) return null;
  final uri = Uri.tryParse(value);
  if (uri == null) return null;
  const marker = '/storage/v1/object/public/person-photos/';
  final index = uri.path.indexOf(marker);
  if (index == -1) return null;
  final encoded = uri.path.substring(index + marker.length);
  return Uri.decodeComponent(encoded);
}

String _safeExtension(String fileName, String contentType) {
  final fromName = fileName.split('.').last.toLowerCase();
  if (const {
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'heic',
    'heif',
  }.contains(fromName)) {
    return fromName;
  }
  return switch (contentType) {
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
    'image/heic' => 'heic',
    'image/heif' => 'heif',
    _ => 'jpg',
  };
}

String _randomStorageId() {
  final micros = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
  return '$micros-${Object().hashCode.toRadixString(16)}';
}

SetupRepositoryException _postgrestFailure(PostgrestException error) {
  final text = '${error.code} ${error.message}'.toLowerCase();
  if (text.contains('23505') || text.contains('duplicate')) {
    return _duplicate();
  }
  if (text.contains('p0002') || text.contains('not found')) {
    return _notFound('The requested setup record was not found.');
  }
  if (text.contains('42501') ||
      text.contains('jwt') ||
      text.contains('permission') ||
      text.contains('row-level security')) {
    return const SetupRepositoryException(
      'Your invited session is not authorized for setup. Sign in again.',
      kind: SetupFailureKind.unauthorized,
    );
  }
  if (text.contains('22023') ||
      text.contains('22001') ||
      text.contains('23514')) {
    return SetupRepositoryException(
      error.message,
      kind: SetupFailureKind.invalidData,
    );
  }
  return const SetupRepositoryException(
    'The workspace rejected this setup change. Review it and try again.',
    kind: SetupFailureKind.other,
  );
}

SetupRepositoryException _storageFailure(StorageException error) {
  final text = error.message.toLowerCase();
  if (text.contains('jwt') ||
      text.contains('unauthorized') ||
      text.contains('row-level security')) {
    return const SetupRepositoryException(
      'Your invited session cannot access person photos. Sign in again.',
      kind: SetupFailureKind.unauthorized,
    );
  }
  return const SetupRepositoryException(
    'The private person photo could not be uploaded. Try again.',
    kind: SetupFailureKind.other,
  );
}

SetupRepositoryException _onlineFailure() => const SetupRepositoryException(
      'Setup needs a connection. Check Wi-Fi or signal, then retry.',
      kind: SetupFailureKind.onlineRequired,
    );

SetupRepositoryException _duplicate() => const SetupRepositoryException(
      'That person already exists or is already on this roster.',
      kind: SetupFailureKind.duplicate,
    );

SetupRepositoryException _notFound(String message) =>
    SetupRepositoryException(message, kind: SetupFailureKind.notFound);
