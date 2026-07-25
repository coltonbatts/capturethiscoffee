import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'production_board.dart';

const _authenticatedBoardCacheKey = 'ctc_authenticated_board_cache_v1';
const _selectedDayKey = 'ctc_selected_day_v1';
const _maximumCachedBoardBytes = 2 * 1024 * 1024;
const _maximumCachedBoardsPerUser = 12;

class AuthenticatedCachedBoard {
  const AuthenticatedCachedBoard({
    required this.userId,
    required this.productionId,
    required this.syncedAt,
    required this.board,
  });

  final String userId;
  final String productionId;
  final DateTime syncedAt;
  final ProductionBoard board;

  Map<String, Object?> toJson() => {
        'userId': userId,
        'productionId': productionId,
        'syncedAt': syncedAt.toUtc().toIso8601String(),
        'board': board.toJson(),
      };

  static AuthenticatedCachedBoard? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final userId = value['userId'];
    final productionId = value['productionId'];
    final syncedAt = DateTime.tryParse(value['syncedAt']?.toString() ?? '');
    final board = value['board'];
    if (userId is! String ||
        userId.isEmpty ||
        productionId is! String ||
        productionId.isEmpty ||
        syncedAt == null ||
        board is! Map<String, dynamic>) {
      return null;
    }
    try {
      return AuthenticatedCachedBoard(
        userId: userId,
        productionId: productionId,
        syncedAt: syncedAt,
        board: ProductionBoard.fromJson(board),
      );
    } on FormatException {
      return null;
    }
  }
}

abstract interface class AuthenticatedBoardCacheRepository {
  Future<AuthenticatedCachedBoard?> read({
    required String userId,
    required String productionId,
  });

  Future<void> write(AuthenticatedCachedBoard board);

  Future<void> clearUser(String userId);
}

class PreferencesAuthenticatedBoardCacheRepository
    implements AuthenticatedBoardCacheRepository {
  @override
  Future<AuthenticatedCachedBoard?> read({
    required String userId,
    required String productionId,
  }) async {
    final records = await _readAll();
    return records
        .where((item) =>
            item.userId == userId && item.productionId == productionId)
        .firstOrNull;
  }

  @override
  Future<void> write(AuthenticatedCachedBoard board) async {
    final encodedBoard = jsonEncode(board.toJson());
    if (encodedBoard.length > _maximumCachedBoardBytes) return;
    final records = await _readAll()
      ..removeWhere((item) =>
          item.userId == board.userId &&
          item.productionId == board.productionId)
      ..add(board);
    final sameUser = records
        .where((item) => item.userId == board.userId)
        .toList()
      ..sort((a, b) => b.syncedAt.compareTo(a.syncedAt));
    final remove = sameUser.skip(_maximumCachedBoardsPerUser).toSet();
    records.removeWhere(remove.contains);
    await _writeAll(records);
  }

  @override
  Future<void> clearUser(String userId) async {
    final records = await _readAll()
      ..removeWhere((item) => item.userId == userId);
    await _writeAll(records);
  }

  Future<List<AuthenticatedCachedBoard>> _readAll() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_authenticatedBoardCacheKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .map(AuthenticatedCachedBoard.tryFromJson)
          .whereType<AuthenticatedCachedBoard>()
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _writeAll(List<AuthenticatedCachedBoard> records) async {
    final preferences = await SharedPreferences.getInstance();
    if (records.isEmpty) {
      await preferences.remove(_authenticatedBoardCacheKey);
      return;
    }
    await preferences.setString(
      _authenticatedBoardCacheKey,
      jsonEncode(records.map((item) => item.toJson()).toList()),
    );
  }
}

class MemoryAuthenticatedBoardCacheRepository
    implements AuthenticatedBoardCacheRepository {
  MemoryAuthenticatedBoardCacheRepository([
    Iterable<AuthenticatedCachedBoard> initial = const [],
  ]) : records = List.of(initial);

  final List<AuthenticatedCachedBoard> records;

  @override
  Future<AuthenticatedCachedBoard?> read({
    required String userId,
    required String productionId,
  }) async =>
      records
          .where((item) =>
              item.userId == userId && item.productionId == productionId)
          .firstOrNull;

  @override
  Future<void> write(AuthenticatedCachedBoard board) async {
    records.removeWhere((item) =>
        item.userId == board.userId && item.productionId == board.productionId);
    records.add(board);
  }

  @override
  Future<void> clearUser(String userId) async {
    records.removeWhere((item) => item.userId == userId);
  }
}

abstract interface class SelectedDayRepository {
  Future<String?> read(String userId);

  Future<void> write(String userId, String productionId);

  Future<void> clear(String userId);
}

class PreferencesSelectedDayRepository implements SelectedDayRepository {
  @override
  Future<String?> read(String userId) async {
    final values = await _readAll();
    final value = values[userId];
    return value is String && value.isNotEmpty ? value : null;
  }

  @override
  Future<void> write(String userId, String productionId) async {
    final values = await _readAll();
    values[userId] = productionId;
    await _writeAll(values);
  }

  @override
  Future<void> clear(String userId) async {
    final values = await _readAll();
    values.remove(userId);
    await _writeAll(values);
  }

  Future<Map<String, dynamic>> _readAll() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_selectedDayKey);
    if (raw == null || raw.isEmpty) return {};
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : {};
    } catch (_) {
      return {};
    }
  }

  Future<void> _writeAll(Map<String, dynamic> values) async {
    final preferences = await SharedPreferences.getInstance();
    if (values.isEmpty) {
      await preferences.remove(_selectedDayKey);
      return;
    }
    await preferences.setString(_selectedDayKey, jsonEncode(values));
  }
}

class MemorySelectedDayRepository implements SelectedDayRepository {
  MemorySelectedDayRepository([Map<String, String> initial = const {}])
      : values = Map.of(initial);

  final Map<String, String> values;

  @override
  Future<String?> read(String userId) async => values[userId];

  @override
  Future<void> write(String userId, String productionId) async {
    values[userId] = productionId;
  }

  @override
  Future<void> clear(String userId) async {
    values.remove(userId);
  }
}
