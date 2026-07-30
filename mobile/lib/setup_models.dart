import 'dart:typed_data';

enum SetupPersonType {
  clientContact('client_contact', 'Client contact'),
  agency('agency', 'Agency'),
  crew('crew', 'Crew'),
  guest('guest', 'Guest');

  const SetupPersonType(this.value, this.label);

  final String value;
  final String label;

  static SetupPersonType fromValue(Object? value) {
    for (final type in values) {
      if (type.value == value) return type;
    }
    throw const FormatException('Invalid person type.');
  }
}

const setupProductionStatuses = {'planning', 'active', 'complete'};

class SetupClient {
  const SetupClient({
    required this.id,
    required this.name,
    required this.active,
  });

  final String id;
  final String name;
  final bool active;

  factory SetupClient.fromJson(Map<String, dynamic> json) => SetupClient(
        id: _requiredString(json, 'id'),
        name: _requiredString(json, 'name'),
        active: _requiredBool(json, 'active'),
      );
}

class SetupDay {
  const SetupDay({
    required this.id,
    required this.name,
    required this.clientId,
    required this.clientName,
    required this.shootDate,
    required this.location,
    required this.runnerName,
    required this.notes,
    required this.status,
  });

  final String id;
  final String name;
  final String clientId;
  final String clientName;
  final DateTime? shootDate;
  final String location;
  final String runnerName;
  final String notes;
  final String status;

  factory SetupDay.fromRows({
    required Map<String, dynamic> production,
    Map<String, dynamic>? client,
  }) {
    final status = _requiredString(production, 'status');
    if (!setupProductionStatuses.contains(status)) {
      throw const FormatException('Invalid production status.');
    }
    return SetupDay(
      id: _requiredString(production, 'id'),
      name: _requiredString(production, 'name'),
      clientId: _requiredString(production, 'client_id'),
      clientName: _optionalString(client?['name']),
      shootDate: _optionalDate(production['shoot_date']),
      location: _optionalString(production['location']),
      runnerName: _optionalString(production['runner_name']),
      notes: _optionalString(production['notes']),
      status: status,
    );
  }

  DayDraft toDraft() => DayDraft(
        name: name,
        clientId: clientId,
        clientName: clientName,
        shootDate: shootDate,
        location: location,
        runnerName: runnerName,
        notes: notes,
        status: status,
      );
}

class DayDraft {
  const DayDraft({
    required this.name,
    this.clientId,
    this.clientName = '',
    this.shootDate,
    this.location = '',
    this.runnerName = '',
    this.notes = '',
    this.status = 'planning',
  });

  final String name;
  final String? clientId;
  final String clientName;
  final DateTime? shootDate;
  final String location;
  final String runnerName;
  final String notes;
  final String status;

  DayDraft copyWith({
    String? name,
    String? clientId,
    bool clearClientId = false,
    String? clientName,
    DateTime? shootDate,
    bool clearShootDate = false,
    String? location,
    String? runnerName,
    String? notes,
    String? status,
  }) =>
      DayDraft(
        name: name ?? this.name,
        clientId: clearClientId ? null : clientId ?? this.clientId,
        clientName: clientName ?? this.clientName,
        shootDate: clearShootDate ? null : shootDate ?? this.shootDate,
        location: location ?? this.location,
        runnerName: runnerName ?? this.runnerName,
        notes: notes ?? this.notes,
        status: status ?? this.status,
      );

  DayDraft normalized() {
    final normalizedName = normalizeSetupName(name);
    if (normalizedName.isEmpty) {
      throw const FormatException('Day name is required.');
    }
    if (!setupProductionStatuses.contains(status)) {
      throw const FormatException('Choose a valid day status.');
    }
    return DayDraft(
      name: _bounded(normalizedName, 200, 'Day name'),
      clientId: clientId?.trim(),
      clientName: _bounded(clientName.trim(), 200, 'Client / brand'),
      shootDate: shootDate,
      location: _bounded(location.trim(), 500, 'Location'),
      runnerName: _bounded(runnerName.trim(), 200, 'Runner'),
      notes: _bounded(notes.trim(), 2000, 'Notes'),
      status: status,
    );
  }
}

class SetupPerson {
  const SetupPerson({
    required this.id,
    required this.name,
    required this.type,
    required this.role,
    required this.department,
    required this.company,
    required this.photoUrl,
    required this.usualOrder,
    required this.dietaryNotes,
    required this.notes,
    required this.active,
  });

  final String id;
  final String name;
  final SetupPersonType type;
  final String role;
  final String department;
  final String company;
  final String photoUrl;
  final String usualOrder;
  final String dietaryNotes;
  final String notes;
  final bool active;

  factory SetupPerson.fromJson(Map<String, dynamic> json) => SetupPerson(
        id: _requiredString(json, 'id'),
        name: _requiredString(json, 'name'),
        type: SetupPersonType.fromValue(json['type']),
        role: _optionalString(json['role']),
        department: _optionalString(json['department']),
        company: _optionalString(json['company']),
        photoUrl: _optionalString(json['photo_url']),
        usualOrder: _optionalString(json['usual_order']),
        dietaryNotes: _optionalString(json['dietary_notes']),
        notes: _optionalString(json['notes']),
        active: _requiredBool(json, 'active'),
      );

  PersonDraft toDraft() => PersonDraft(
        name: name,
        type: type,
        role: role,
        department: department,
        company: company,
        photoUrl: photoUrl,
        usualOrder: usualOrder,
        dietaryNotes: dietaryNotes,
        notes: notes,
        active: active,
      );
}

class PersonDraft {
  const PersonDraft({
    required this.name,
    this.type = SetupPersonType.crew,
    this.role = '',
    this.department = '',
    this.company = '',
    this.photoUrl = '',
    this.usualOrder = '',
    this.dietaryNotes = '',
    this.notes = '',
    this.active = true,
  });

  final String name;
  final SetupPersonType type;
  final String role;
  final String department;
  final String company;
  final String photoUrl;
  final String usualOrder;
  final String dietaryNotes;
  final String notes;
  final bool active;

  PersonDraft copyWith({
    String? name,
    SetupPersonType? type,
    String? role,
    String? department,
    String? company,
    String? photoUrl,
    String? usualOrder,
    String? dietaryNotes,
    String? notes,
    bool? active,
  }) =>
      PersonDraft(
        name: name ?? this.name,
        type: type ?? this.type,
        role: role ?? this.role,
        department: department ?? this.department,
        company: company ?? this.company,
        photoUrl: photoUrl ?? this.photoUrl,
        usualOrder: usualOrder ?? this.usualOrder,
        dietaryNotes: dietaryNotes ?? this.dietaryNotes,
        notes: notes ?? this.notes,
        active: active ?? this.active,
      );

  PersonDraft normalized() {
    final normalizedName = normalizeSetupName(name);
    if (normalizedName.isEmpty) {
      throw const FormatException('Name is required.');
    }
    return PersonDraft(
      name: _bounded(normalizedName, 200, 'Name'),
      type: type,
      role: _bounded(role.trim(), 200, 'Role'),
      department: _bounded(department.trim(), 200, 'Department'),
      company: _bounded(company.trim(), 200, 'Company'),
      photoUrl: _bounded(photoUrl.trim(), 2048, 'Photo'),
      usualOrder: _bounded(usualOrder.trim(), 500, 'Usual order'),
      dietaryNotes: _bounded(dietaryNotes.trim(), 500, 'Dietary notes'),
      notes: _bounded(notes.trim(), 2000, 'Notes'),
      active: active,
    );
  }
}

class SetupRosterMember {
  const SetupRosterMember({
    required this.rosterId,
    required this.productionId,
    required this.person,
    required this.orderId,
    required this.groupLabel,
    required this.onSetToday,
    required this.sortOrder,
  });

  final String rosterId;
  final String productionId;
  final SetupPerson person;
  final String orderId;
  final String groupLabel;
  final bool onSetToday;
  final int sortOrder;

  factory SetupRosterMember.fromRows({
    required Map<String, dynamic> roster,
    required Map<String, dynamic> person,
    required Map<String, dynamic> order,
  }) {
    final rosterId = _requiredString(roster, 'id');
    final productionId = _requiredString(roster, 'production_id');
    final personId = _requiredString(roster, 'person_id');
    if (_requiredString(person, 'id') != personId ||
        _requiredString(order, 'roster_id') != rosterId ||
        _requiredString(order, 'production_id') != productionId ||
        _requiredString(order, 'person_id') != personId) {
      throw const FormatException('Roster relationship is inconsistent.');
    }
    return SetupRosterMember(
      rosterId: rosterId,
      productionId: productionId,
      person: SetupPerson.fromJson(person),
      orderId: _requiredString(order, 'id'),
      groupLabel: _optionalString(roster['group_label']),
      onSetToday: _requiredBool(roster, 'on_set_today'),
      sortOrder: _requiredInt(roster, 'sort_order'),
    );
  }

  SetupRosterMember copyWith({
    String? groupLabel,
    bool? onSetToday,
    int? sortOrder,
    SetupPerson? person,
  }) =>
      SetupRosterMember(
        rosterId: rosterId,
        productionId: productionId,
        person: person ?? this.person,
        orderId: orderId,
        groupLabel: groupLabel ?? this.groupLabel,
        onSetToday: onSetToday ?? this.onSetToday,
        sortOrder: sortOrder ?? this.sortOrder,
      );
}

class SetupRosterSnapshot {
  const SetupRosterSnapshot({
    required this.day,
    required this.members,
  });

  final SetupDay day;
  final List<SetupRosterMember> members;
}

class SetupPhotoUpload {
  const SetupPhotoUpload({
    required this.bytes,
    required this.fileName,
    required this.contentType,
  });

  final Uint8List bytes;
  final String fileName;
  final String contentType;
}

class BulkRosterCandidate {
  const BulkRosterCandidate({
    required this.name,
    required this.normalizedName,
    required this.groupLabel,
    this.existingPersonId,
  });

  final String name;
  final String normalizedName;
  final String groupLabel;
  final String? existingPersonId;

  bool get usesExistingPerson => existingPersonId != null;

  Map<String, Object?> toJson() => {
        'name': name,
        if (existingPersonId != null) 'person_id': existingPersonId,
        'group_label': groupLabel,
        'on_set_today': true,
      };
}

enum BulkRosterIssueKind {
  duplicatePaste,
  alreadyOnRoster,
  archivedMatch,
}

class BulkRosterIssue {
  const BulkRosterIssue({
    required this.input,
    required this.normalizedName,
    required this.kind,
  });

  final String input;
  final String normalizedName;
  final BulkRosterIssueKind kind;

  String get message => switch (kind) {
        BulkRosterIssueKind.duplicatePaste => 'Duplicate in paste',
        BulkRosterIssueKind.alreadyOnRoster => 'Already on this roster',
        BulkRosterIssueKind.archivedMatch => 'Matches an archived person',
      };
}

class BulkRosterPreview {
  const BulkRosterPreview({
    required this.accepted,
    required this.issues,
    required this.blankEntriesIgnored,
  });

  final List<BulkRosterCandidate> accepted;
  final List<BulkRosterIssue> issues;
  final int blankEntriesIgnored;

  bool get canCommit => accepted.isNotEmpty && accepted.length <= 200;
  bool get tooLarge => accepted.length > 200;

  static BulkRosterPreview parse({
    required String raw,
    required Iterable<SetupPerson> people,
    required Iterable<String> rosterPersonIds,
  }) {
    final activeByName = <String, SetupPerson>{};
    final archivedByName = <String, SetupPerson>{};
    for (final person in people) {
      final key = normalizeSetupNameKey(person.name);
      if (person.active) {
        activeByName.putIfAbsent(key, () => person);
      } else {
        archivedByName.putIfAbsent(key, () => person);
      }
    }
    final rosterIds = rosterPersonIds.toSet();
    final seen = <String>{};
    final accepted = <BulkRosterCandidate>[];
    final issues = <BulkRosterIssue>[];
    var blanks = 0;

    for (final piece in raw.split(RegExp(r'[\n,]'))) {
      final name = normalizeSetupName(piece);
      if (name.isEmpty) {
        blanks += 1;
        continue;
      }
      final key = normalizeSetupNameKey(name);
      if (!seen.add(key)) {
        issues.add(BulkRosterIssue(
          input: piece,
          normalizedName: name,
          kind: BulkRosterIssueKind.duplicatePaste,
        ));
        continue;
      }

      final active = activeByName[key];
      if (active != null && rosterIds.contains(active.id)) {
        issues.add(BulkRosterIssue(
          input: piece,
          normalizedName: name,
          kind: BulkRosterIssueKind.alreadyOnRoster,
        ));
        continue;
      }
      if (active == null && archivedByName.containsKey(key)) {
        issues.add(BulkRosterIssue(
          input: piece,
          normalizedName: name,
          kind: BulkRosterIssueKind.archivedMatch,
        ));
        continue;
      }
      accepted.add(BulkRosterCandidate(
        name: active?.name ?? name,
        normalizedName: key,
        existingPersonId: active?.id,
        groupLabel: active?.department.trim().isNotEmpty == true
            ? active!.department.trim()
            : active?.company.trim().isNotEmpty == true
                ? active!.company.trim()
                : 'Set',
      ));
    }

    return BulkRosterPreview(
      accepted: List.unmodifiable(accepted),
      issues: List.unmodifiable(issues),
      blankEntriesIgnored: blanks,
    );
  }
}

String normalizeSetupName(String value) =>
    value.trim().replaceAll(RegExp(r'\s+'), ' ');

String normalizeSetupNameKey(String value) =>
    normalizeSetupName(value).toLowerCase();

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty || value.length > 10000) {
    throw FormatException('Invalid $key value.');
  }
  return value;
}

String _optionalString(Object? value) {
  if (value == null) return '';
  if (value is! String || value.length > 10000) {
    throw const FormatException('Invalid optional text value.');
  }
  return value;
}

bool _requiredBool(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! bool) throw FormatException('Invalid $key value.');
  return value;
}

int _requiredInt(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! num) throw FormatException('Invalid $key value.');
  return value.toInt();
}

DateTime? _optionalDate(Object? value) {
  if (value == null || value == '') return null;
  if (value is! String) throw const FormatException('Invalid date value.');
  final parsed = DateTime.tryParse(value);
  if (parsed == null) throw const FormatException('Invalid date value.');
  return DateTime(parsed.year, parsed.month, parsed.day);
}

String _bounded(String value, int max, String label) {
  if (value.length > max) throw FormatException('$label is too long.');
  return value;
}
