import 'package:flutter/foundation.dart';

import 'setup_models.dart';
import 'setup_repository.dart';

class SetupController extends ChangeNotifier {
  SetupController(this.repository);

  final SetupRepository repository;

  List<SetupClient> _clients = const [];
  List<SetupPerson> _people = const [];
  SetupDay? _day;
  List<SetupRosterMember> _roster = const [];
  SetupRepositoryException? _failure;
  final Map<String, _PhotoDisplayCache> _photoDisplayCache = {};
  bool _busy = false;
  bool _disposed = false;

  List<SetupClient> get clients => _clients;
  List<SetupPerson> get people => _people;
  SetupDay? get day => _day;
  List<SetupRosterMember> get roster => _roster;
  SetupRepositoryException? get failure => _failure;
  String? get error => _failure?.message;
  bool get onlineRetryAvailable => _failure?.retryable == true;
  bool get busy => _busy;

  List<SetupPerson> searchPeople(String query, {bool includeArchived = false}) {
    final needle = normalizeSetupNameKey(query);
    return _people.where((person) {
      if (!includeArchived && !person.active) return false;
      if (needle.isEmpty) return true;
      return [
        person.name,
        person.role,
        person.department,
        person.company,
        person.usualOrder,
      ].join(' ').toLowerCase().contains(needle);
    }).toList(growable: false);
  }

  List<SetupPerson> peopleNotOnRoster(String query) {
    final rosterIds = _roster.map((member) => member.person.id).toSet();
    return searchPeople(query)
        .where((person) => !rosterIds.contains(person.id))
        .toList(growable: false);
  }

  BulkRosterPreview previewBulk(String raw) => BulkRosterPreview.parse(
        raw: raw,
        people: _people,
        rosterPersonIds: _roster.map((member) => member.person.id),
      );

  Future<bool> loadPeople() => _run(() async {
        _people = List.unmodifiable(await repository.fetchPeople());
      });

  Future<bool> loadRoster(String productionId) => _run(() async {
        final snapshot = await repository.fetchRoster(productionId);
        final allPeople = await repository.fetchPeople();
        final allClients = await repository.fetchClients();
        _day = snapshot.day;
        _roster = List.unmodifiable(snapshot.members);
        _people = List.unmodifiable(allPeople);
        _clients = List.unmodifiable(allClients);
      });

  Future<SetupDay?> createDay(DayDraft draft) async {
    SetupDay? created;
    final ok = await _run(() async {
      created = await repository.createDay(draft);
      _day = created;
      _roster = const [];
    });
    return ok ? created : null;
  }

  Future<bool> updateDay(String productionId, DayDraft draft) => _run(() async {
        _day = await repository.updateDay(productionId, draft);
      });

  Future<bool> deleteDay(String productionId) => _run(() async {
        await repository.deleteDay(productionId);
        if (_day?.id == productionId) {
          _day = null;
          _roster = const [];
        }
      });

  Future<SetupPerson?> createPerson(PersonDraft draft) async {
    SetupPerson? created;
    final ok = await _run(() async {
      created = await repository.createPerson(draft);
      _people = List.unmodifiable([created!, ..._people]);
    });
    return ok ? created : null;
  }

  Future<SetupPerson?> updatePerson(
    String personId,
    PersonDraft draft,
  ) async {
    SetupPerson? updated;
    final ok = await _run(() async {
      updated = await repository.updatePerson(personId, draft);
      _people = List.unmodifiable([
        for (final person in _people)
          if (person.id == personId) updated! else person,
      ]);
      _roster = List.unmodifiable([
        for (final member in _roster)
          if (member.person.id == personId)
            member.copyWith(person: updated)
          else
            member,
      ]);
    });
    return ok ? updated : null;
  }

  Future<String?> uploadPhoto(SetupPhotoUpload photo) async {
    String? reference;
    final ok = await _run(() async {
      reference = await repository.uploadPersonPhoto(photo);
    });
    return ok ? reference : null;
  }

  Future<String?> photoDisplayUrl(String storedReference) {
    final reference = storedReference.trim();
    if (reference.isEmpty) return Future.value();
    final now = DateTime.now();
    final cached = _photoDisplayCache[reference];
    if (cached != null && now.isBefore(cached.expiresAt)) {
      return cached.request;
    }

    late final Future<String?> request;
    request = () async {
      try {
        return await repository.createPersonPhotoDisplayUrl(reference);
      } catch (_) {
        if (identical(_photoDisplayCache[reference]?.request, request)) {
          _photoDisplayCache.remove(reference);
        }
        rethrow;
      }
    }();
    _photoDisplayCache[reference] = _PhotoDisplayCache(
      request: request,
      // Signed URLs live for an hour. Refresh before expiry without reminting
      // one for every rebuild of a dense roster.
      expiresAt: now.add(const Duration(minutes: 50)),
    );
    return request;
  }

  Future<bool> addExisting(String productionId, String personId) =>
      _run(() async {
        final member = await repository.addExistingPerson(
          productionId: productionId,
          personId: personId,
        );
        _roster = _sorted([..._roster, member]);
      });

  Future<bool> createPersonAndAdd(
    String productionId,
    PersonDraft draft, {
    bool linkToClient = false,
  }) =>
      _run(() async {
        final member = await repository.createPersonAndAdd(
          productionId: productionId,
          person: draft,
          linkToClient: linkToClient,
        );
        _people = List.unmodifiable([member.person, ..._people]);
        _roster = _sorted([..._roster, member]);
      });

  Future<bool> commitBulk(
    String productionId,
    BulkRosterPreview preview,
  ) =>
      _run(() async {
        if (!preview.canCommit) {
          throw const SetupRepositoryException(
            'Preview at least one valid name before committing.',
            kind: SetupFailureKind.invalidData,
          );
        }
        final added = await repository.bulkAdd(
          productionId: productionId,
          people: preview.accepted,
        );
        final peopleById = {for (final person in _people) person.id: person};
        for (final member in added) {
          peopleById[member.person.id] = member.person;
        }
        _people = List.unmodifiable(peopleById.values);
        _roster = _sorted([..._roster, ...added]);
      });

  Future<bool> updateRosterMember({
    required String productionId,
    required String rosterId,
    required String groupLabel,
    required bool onSetToday,
  }) =>
      _run(() async {
        final row = await repository.updateRosterMember(
          productionId: productionId,
          rosterId: rosterId,
          groupLabel: groupLabel,
          onSetToday: onSetToday,
        );
        final returnedId = row['id'];
        final returnedGroup = row['group_label'];
        final returnedOnSet = row['on_set_today'];
        if (returnedId != rosterId ||
            returnedGroup is! String? ||
            returnedOnSet is! bool) {
          throw const SetupRepositoryException(
            'The workspace returned invalid roster data.',
            kind: SetupFailureKind.invalidData,
          );
        }
        _roster = List.unmodifiable([
          for (final member in _roster)
            if (member.rosterId == rosterId)
              member.copyWith(
                groupLabel: returnedGroup ?? '',
                onSetToday: returnedOnSet,
              )
            else
              member,
        ]);
      });

  Future<bool> removeRosterMember({
    required String productionId,
    required String rosterId,
  }) =>
      _run(() async {
        await repository.removeRosterMember(
          productionId: productionId,
          rosterId: rosterId,
        );
        _roster = List.unmodifiable(
          _roster.where((member) => member.rosterId != rosterId),
        );
      });

  Future<bool> reorderRoster(
    String productionId,
    int oldIndex,
    int newIndex,
  ) =>
      _run(() async {
        final ids = _roster.map((member) => member.rosterId).toList();
        final moved = ids.removeAt(oldIndex);
        ids.insert(newIndex, moved);
        final rows = await repository.reorderRoster(
          productionId: productionId,
          rosterIds: ids,
        );
        final sortById = <String, int>{};
        for (final row in rows) {
          final id = row['id'];
          final sortOrder = row['sort_order'];
          if (id is! String || sortOrder is! num || sortById.containsKey(id)) {
            throw const SetupRepositoryException(
              'The workspace returned invalid reorder data.',
              kind: SetupFailureKind.invalidData,
            );
          }
          sortById[id] = sortOrder.toInt();
        }
        final currentIds = _roster.map((member) => member.rosterId).toSet();
        if (sortById.length != _roster.length ||
            !sortById.keys.toSet().containsAll(currentIds) ||
            !currentIds.containsAll(sortById.keys)) {
          throw const SetupRepositoryException(
            'The workspace returned an incomplete reorder.',
            kind: SetupFailureKind.invalidData,
          );
        }
        _roster = _sorted([
          for (final member in _roster)
            member.copyWith(sortOrder: sortById[member.rosterId]),
        ]);
      });

  void dismissError() {
    if (_failure == null) return;
    _failure = null;
    _emit();
  }

  void clear() {
    _clients = const [];
    _people = const [];
    _day = null;
    _roster = const [];
    _failure = null;
    _photoDisplayCache.clear();
    _busy = false;
    _emit();
  }

  Future<bool> _run(Future<void> Function() operation) async {
    if (_busy) return false;
    _busy = true;
    _failure = null;
    _emit();
    try {
      await operation();
      return true;
    } on SetupRepositoryException catch (error) {
      _failure = error;
      return false;
    } on FormatException catch (error) {
      _failure = SetupRepositoryException(
        error.message,
        kind: SetupFailureKind.invalidData,
      );
      return false;
    } catch (_) {
      _failure = const SetupRepositoryException(
        'Setup needs a connection. Check Wi-Fi or signal, then retry.',
        kind: SetupFailureKind.onlineRequired,
      );
      return false;
    } finally {
      _busy = false;
      _emit();
    }
  }

  List<SetupRosterMember> _sorted(Iterable<SetupRosterMember> members) {
    final result = members.toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return List.unmodifiable(result);
  }

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

class _PhotoDisplayCache {
  const _PhotoDisplayCache({
    required this.request,
    required this.expiresAt,
  });

  final Future<String?> request;
  final DateTime expiresAt;
}
