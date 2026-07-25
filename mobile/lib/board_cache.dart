/// Durable on-device copy of the last board the server returned.
///
/// Without this, a cold start with no signal shows an empty app: the session
/// survives in the Keychain but the roster does not. With local label rendering
/// already landed, this is the second half of printing on a stage with no bars.
///
/// The cache is scoped to `apiBase` + `productionId` for the same reason
/// `PrintRecoveryRecord.belongsTo` is — showing yesterday's roster under today's
/// production name would be worse than showing nothing.
///
/// Storage is `shared_preferences` (app-sandboxed), matching
/// `PreferencesPrintRecoveryRepository`. The capability token stays in the
/// Keychain and is never written here. Cached roster data is cleared when the
/// production is unlinked.
library;

import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'production_session.dart';
import 'production_board.dart';

const _boardCachePreferencesKey = 'ctc_board_cache_v1';

/// Refuse to persist an implausibly large board rather than bloat the
/// preferences store. Matches the queue transfer cap in `ctc_api.dart`.
const _maximumCachedBoardBytes = 2 * 1024 * 1024;

class CachedBoard {
  const CachedBoard({
    required this.apiBase,
    required this.productionId,
    required this.syncedAt,
    required this.board,
  });

  final String apiBase;
  final String productionId;

  /// When the server last confirmed this board — not when it was read back.
  /// The operator needs the age of the data, not the age of the app launch.
  final DateTime syncedAt;

  final ProductionBoard board;

  bool belongsTo(ProductionSession session) =>
      apiBase == session.apiBase && productionId == session.productionId;

  Map<String, Object?> toJson() => {
        'apiBase': apiBase,
        'productionId': productionId,
        'syncedAt': syncedAt.toUtc().toIso8601String(),
        'board': board.toJson(),
      };

  static CachedBoard? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final apiBase = value['apiBase'];
    final productionId = value['productionId'];
    final syncedAt = DateTime.tryParse(value['syncedAt']?.toString() ?? '');
    final board = value['board'];
    if (apiBase is! String ||
        productionId is! String ||
        apiBase.isEmpty ||
        productionId.isEmpty ||
        syncedAt == null ||
        board is! Map<String, dynamic>) {
      return null;
    }

    try {
      return CachedBoard(
        apiBase: apiBase,
        productionId: productionId,
        syncedAt: syncedAt,
        board: ProductionBoard.fromJson(board),
      );
    } on FormatException {
      // A cache written by an older build is not worth failing a launch over.
      return null;
    }
  }
}

abstract interface class BoardCacheRepository {
  Future<CachedBoard?> read();

  Future<void> write(CachedBoard board);

  Future<void> clear();
}

class PreferencesBoardCacheRepository implements BoardCacheRepository {
  @override
  Future<CachedBoard?> read() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_boardCachePreferencesKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return CachedBoard.tryFromJson(jsonDecode(raw));
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(CachedBoard board) async {
    final encoded = jsonEncode(board.toJson());
    if (encoded.length > _maximumCachedBoardBytes) return;
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_boardCachePreferencesKey, encoded);
  }

  @override
  Future<void> clear() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_boardCachePreferencesKey);
  }
}

class MemoryBoardCacheRepository implements BoardCacheRepository {
  MemoryBoardCacheRepository([this.value]);

  CachedBoard? value;

  @override
  Future<CachedBoard?> read() async => value;

  @override
  Future<void> write(CachedBoard board) async => value = board;

  @override
  Future<void> clear() async => value = null;
}
