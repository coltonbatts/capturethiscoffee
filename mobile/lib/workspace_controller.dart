import 'dart:async';

import 'package:flutter/widgets.dart';

import 'authenticated_workspace_cache.dart';
import 'board_controller.dart';
import 'board_cache.dart';
import 'ctc_api.dart';
import 'print_recovery.dart';
import 'production_board.dart';
import 'production_session.dart';
import 'session_store.dart';
import 'workspace_models.dart';
import 'workspace_repository.dart';

const _workspaceRefreshInterval = Duration(seconds: 10);

typedef LegacyApiFactory = CtcApi Function(ProductionSession session);

enum WorkspaceMode {
  none,
  authenticated,
  legacy,
}

/// Owns day selection and the authoritative board for both Build 9 and the
/// secondary Build 8 legacy-link fallback.
///
/// It knows nothing about Bluetooth or physical print outcomes. The printer
/// controller consumes its queue and calls [markLabelPrinted] only after paper
/// has actually come out.
class WorkspaceController extends ChangeNotifier with WidgetsBindingObserver {
  WorkspaceController({
    WorkspaceRepository? repository,
    BoardController? boardController,
    OrderMutationOutbox? mutationOutbox,
    AuthenticatedBoardCacheRepository? authenticatedCacheRepository,
    SelectedDayRepository? selectedDayRepository,
    SessionRepository? legacySessionRepository,
    BoardCacheRepository? legacyCacheRepository,
    LegacyApiFactory? legacyApiFactory,
    this.legacyTestMode = false,
  })  : _repository = repository,
        _boardController = boardController ??
            BoardController(
              repository: repository,
              cacheRepository: authenticatedCacheRepository ??
                  PreferencesAuthenticatedBoardCacheRepository(),
              outbox: mutationOutbox ??
                  OrderMutationOutbox(
                    MemoryOrderMutationOutboxRepository(),
                  ),
            ),
        _selectedDayRepository =
            selectedDayRepository ?? PreferencesSelectedDayRepository(),
        _legacySessionRepository =
            legacySessionRepository ?? KeychainSessionRepository(),
        _legacyCacheRepository =
            legacyCacheRepository ?? PreferencesBoardCacheRepository(),
        _legacyApiFactory = legacyApiFactory ?? CtcApi.new {
    _boardController.addListener(_handleAuthenticatedBoardChanged);
  }

  final WorkspaceRepository? _repository;
  final BoardController _boardController;
  final SelectedDayRepository _selectedDayRepository;
  final SessionRepository _legacySessionRepository;
  final BoardCacheRepository _legacyCacheRepository;
  final LegacyApiFactory _legacyApiFactory;
  final bool legacyTestMode;

  WorkspaceMode _mode = WorkspaceMode.none;
  String? _userId;
  List<DaySummary> _days = const [];
  String? _selectedDayId;
  ProductionBoard? _board;
  PrinterQueue? _queue;
  ProductionSession? _legacySession;
  CtcApi? _legacyApi;
  DateTime? _lastSyncedAt;
  bool _servingCachedBoard = false;
  String? _boardUnavailableReason;
  String? _error;
  bool _loadingLegacy = true;
  bool _loadingDays = false;
  bool _busy = false;
  bool _disposed = false;
  Timer? _refreshTimer;
  int _generation = 0;

  WorkspaceMode get mode => _mode;
  BoardController get authenticatedBoard => _boardController;
  String? get userId => _userId;
  List<DaySummary> get days => _days;
  GroupedDays get groupedDays => groupDays(_days);
  String? get selectedDayId => _selectedDayId;
  DaySummary? get selectedDay {
    final id = _selectedDayId;
    if (id == null) return null;
    for (final day in _days) {
      if (day.id == id) return day;
    }
    return null;
  }

  ProductionBoard? get board =>
      _mode == WorkspaceMode.authenticated ? _boardController.board : _board;
  PrinterQueue? get queue =>
      _mode == WorkspaceMode.authenticated ? _boardController.queue : _queue;
  ProductionSession? get legacySession => _legacySession;
  bool get hasLegacySession => _legacySession != null;
  bool get loadingLegacy => _loadingLegacy;
  bool get loadingDays => _loadingDays;
  bool get busy => _busy || _boardController.busy;
  String? get error =>
      _error ??
      (_mode == WorkspaceMode.authenticated ? _boardController.error : null);
  DateTime? get lastSyncedAt => _mode == WorkspaceMode.authenticated
      ? _boardController.lastSyncedAt
      : _lastSyncedAt;
  bool get servingCachedBoard => _mode == WorkspaceMode.authenticated
      ? _boardController.servingCachedBoard
      : _servingCachedBoard;
  String? get boardUnavailableReason => _mode == WorkspaceMode.authenticated
      ? _boardController.boardUnavailableReason
      : _boardUnavailableReason;
  String? get syncBlockedReason => _mode == WorkspaceMode.authenticated
      ? _boardController.syncBlockedReason
      : null;

  String? get productionId => switch (_mode) {
        WorkspaceMode.authenticated => _selectedDayId,
        WorkspaceMode.legacy => _legacySession?.productionId,
        WorkspaceMode.none => null,
      };

  String? get scopeKey => switch (_mode) {
        WorkspaceMode.authenticated =>
          _userId == null ? null : 'user:${_userId!}',
        WorkspaceMode.legacy => _legacySession?.apiBase,
        WorkspaceMode.none => null,
      };

  bool get hasSelectedBoard =>
      productionId != null && board != null && queue != null;

  static const staleBoardThreshold = Duration(minutes: 10);

  bool get boardIsStale {
    if (boardUnavailableReason != null) return false;
    final syncedAt = lastSyncedAt;
    if (syncedAt == null || !servingCachedBoard) return false;
    return DateTime.now().difference(syncedAt) >= staleBoardThreshold;
  }

  String? get boardAgeLabel {
    final syncedAt = lastSyncedAt;
    return syncedAt == null ? null : _ageLabel(syncedAt);
  }

  String get syncStatusLabel {
    final syncedAt = lastSyncedAt;
    if (syncedAt == null) return 'Not synced yet';
    if (servingCachedBoard) return 'Offline · synced ${_ageLabel(syncedAt)}';
    return 'Synced ${_timeLabel(syncedAt)}';
  }

  String? get productionStatusLabel {
    final current = queue;
    if (current == null || current.isProductionActive) return null;
    return 'Production ${current.productionStatus}';
  }

  Future<void> start() async {
    WidgetsBinding.instance.addObserver(this);
    await _restoreLegacy();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startRefreshTimer();
      if (productionId != null) unawaited(refreshBoard(silent: true));
      if (_mode == WorkspaceMode.authenticated) {
        unawaited(refreshDays(silent: true));
      }
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _stopRefreshTimer();
    }
  }

  Future<void> activateUser(String userId) async {
    if (userId.isEmpty) return;
    if (_mode == WorkspaceMode.authenticated && _userId == userId) return;
    final generation = ++_generation;
    _legacyApi?.close();
    _legacyApi = null;
    _mode = WorkspaceMode.authenticated;
    _userId = userId;
    _days = const [];
    _selectedDayId = null;
    _boardController.deactivate();
    _clearLegacyBoard();
    _loadingDays = true;
    _error = null;
    _emit();

    try {
      final selected = await _selectedDayRepository.read(userId);
      if (!_isCurrent(generation, userId)) return;
      _selectedDayId = selected;
      if (selected != null) {
        await _boardController.activate(
          userId: userId,
          productionId: selected,
        );
        if (!_isCurrent(generation, userId)) return;
      }

      await refreshDays(silent: true);
      if (!_isCurrent(generation, userId)) return;
    } finally {
      if (_isCurrent(generation, userId)) {
        _loadingDays = false;
        _emit();
        _startRefreshTimer();
      }
    }
  }

  void deactivateUser() {
    ++_generation;
    _stopRefreshTimer();
    _mode = WorkspaceMode.none;
    _userId = null;
    _days = const [];
    _selectedDayId = null;
    _loadingDays = false;
    _busy = false;
    _error = null;
    _boardController.deactivate();
    _clearLegacyBoard();
    _emit();
  }

  Future<bool> selectDay(String productionId) async {
    final userId = _userId;
    if (_mode != WorkspaceMode.authenticated || userId == null || _busy) {
      return false;
    }
    _busy = true;
    _error = null;
    _selectedDayId = productionId;
    _boardController.deactivate();
    _emit();
    try {
      await _selectedDayRepository.write(userId, productionId);
      await _boardController.activate(
        userId: userId,
        productionId: productionId,
      );
      if (_mode != WorkspaceMode.authenticated ||
          _userId != userId ||
          _selectedDayId != productionId) {
        return false;
      }
      return board != null;
    } finally {
      _busy = false;
      _emit();
    }
  }

  Future<void> refreshDays({bool silent = false}) async {
    final repository = _repository;
    if (_mode != WorkspaceMode.authenticated || repository == null) return;
    if (!silent) {
      _busy = true;
      _error = null;
      _emit();
    }
    try {
      final next = await repository.fetchDays();
      if (_mode != WorkspaceMode.authenticated) return;
      _days = List.unmodifiable(next);
      _error = null;
      _emit();
    } on WorkspaceRepositoryException catch (error) {
      if (_mode != WorkspaceMode.authenticated) return;
      _error = error.message;
      _emit();
    } finally {
      if (!silent) {
        _busy = false;
        _emit();
      }
    }
  }

  Future<void> refreshBoard({bool silent = false}) async {
    if (!silent) {
      _busy = true;
      _error = null;
      _emit();
    }
    try {
      switch (_mode) {
        case WorkspaceMode.authenticated:
          await _refreshAuthenticatedBoard();
        case WorkspaceMode.legacy:
          await _refreshLegacyBoard();
        case WorkspaceMode.none:
          if (!silent) {
            _error = 'Select a day before refreshing.';
            _emit();
          }
      }
    } catch (error) {
      _handleBoardFailure(error);
    } finally {
      if (!silent) {
        _busy = false;
        _emit();
      }
    }
  }

  Future<void> _refreshAuthenticatedBoard() async {
    await _boardController.refresh(silent: true);
  }

  Future<void> _refreshLegacyBoard() async {
    final api = _legacyApi;
    final session = _legacySession;
    if (api == null || session == null) return;
    final board = await api.fetchBoard();
    if (_mode != WorkspaceMode.legacy || _legacySession != session) return;
    final syncedAt = DateTime.now();
    _applyBoard(board, syncedAt: syncedAt);
    try {
      await _legacyCacheRepository.write(CachedBoard(
        apiBase: session.apiBase,
        productionId: session.productionId,
        syncedAt: syncedAt,
        board: board,
      ));
    } catch (_) {
      // Cache failure degrades only the next cold start.
    }
  }

  Future<void> markLabelPrinted(String orderId) async {
    switch (_mode) {
      case WorkspaceMode.authenticated:
        final repository = _repository;
        final productionId = _selectedDayId;
        if (repository == null || productionId == null) {
          throw StateError('No authenticated day is selected.');
        }
        await _boardController.ensureLabelPrinted(orderId);
      case WorkspaceMode.legacy:
        final api = _legacyApi;
        if (api == null) throw StateError('No legacy production is linked.');
        await api.markLabelPrinted(orderId);
      case WorkspaceMode.none:
        throw StateError('No day is selected.');
    }
  }

  void enterLegacy() {
    ++_generation;
    _stopRefreshTimer();
    _userId = null;
    _days = const [];
    _selectedDayId = null;
    _boardController.deactivate();
    _mode = WorkspaceMode.legacy;
    final session = _legacySession;
    if (session != null) {
      _legacyApi = _legacyApiFactory(session);
      _startRefreshTimer();
    }
    _emit();
  }

  void leaveLegacy() {
    if (_mode != WorkspaceMode.legacy) return;
    _legacyApi?.close();
    _legacyApi = null;
    _mode = WorkspaceMode.none;
    _boardController.deactivate();
    _clearLegacyBoard();
    _error = null;
    _emit();
  }

  Future<bool> linkLegacyProduction(String url) async {
    if (_busy) return false;
    final parsed = parseProductionShareUrl(url);
    if (parsed == null) {
      _error = 'Paste the full production share URL (must include ?token=…).';
      _emit();
      return false;
    }
    _busy = true;
    _error = null;
    _emit();
    final api = _legacyApiFactory(parsed);
    try {
      final board = await api.fetchBoard();
      await _legacySessionRepository.write(parsed);
      _legacyApi?.close();
      _legacySession = parsed;
      _legacyApi = api;
      _mode = WorkspaceMode.legacy;
      final syncedAt = DateTime.now();
      _applyBoard(board, syncedAt: syncedAt);
      await _legacyCacheRepository.write(CachedBoard(
        apiBase: parsed.apiBase,
        productionId: parsed.productionId,
        syncedAt: syncedAt,
        board: board,
      ));
      _startRefreshTimer();
      return true;
    } catch (error) {
      api.close();
      _handleBoardFailure(error);
      return false;
    } finally {
      _busy = false;
      _emit();
    }
  }

  Future<void> clearLegacySession() async {
    await _legacySessionRepository.clear();
    await _legacyCacheRepository.clear();
    _legacyApi?.close();
    _legacyApi = null;
    _legacySession = null;
    _mode = WorkspaceMode.legacy;
    _clearLegacyBoard();
    _error = null;
    _emit();
  }

  void dismissError() {
    if (_error == null && _boardController.error == null) return;
    _error = null;
    _boardController.dismissError();
    _emit();
  }

  Future<void> _restoreLegacy() async {
    try {
      final saved = await _legacySessionRepository.read();
      final cached = await _readLegacyCache();
      if (_disposed) return;
      _legacySession = saved;
      if (saved != null) {
        _mode = WorkspaceMode.legacy;
        _legacyApi = _legacyApiFactory(saved);
        if (cached != null && cached.belongsTo(saved)) {
          _applyBoard(
            cached.board,
            syncedAt: cached.syncedAt,
            fromCache: true,
          );
        }
      }
      _loadingLegacy = false;
      _emit();
      if (saved != null) {
        _startRefreshTimer();
        await refreshBoard(silent: true);
      }
    } catch (_) {
      if (_disposed) return;
      _loadingLegacy = false;
      _error = 'Could not open the saved legacy production securely.';
      _emit();
    }
  }

  Future<CachedBoard?> _readLegacyCache() async {
    try {
      return await _legacyCacheRepository.read();
    } catch (_) {
      return null;
    }
  }

  void _applyBoard(
    ProductionBoard board, {
    required DateTime syncedAt,
    bool fromCache = false,
  }) {
    _board = board;
    _queue = PrinterQueue.fromBoard(board);
    _lastSyncedAt = syncedAt;
    _servingCachedBoard = fromCache;
    if (!fromCache) _boardUnavailableReason = null;
    _error = null;
    _emit();
  }

  void _handleBoardFailure(Object error) {
    _error = _errorText(error);
    if (_queue != null) _servingCachedBoard = true;
    if (error is CtcApiException && error.kind == CtcApiErrorKind.gone) {
      _boardUnavailableReason = error.message;
    } else if (error is WorkspaceRepositoryException &&
        (error.kind == WorkspaceFailureKind.notFound ||
            error.kind == WorkspaceFailureKind.unauthorized)) {
      _boardUnavailableReason = error.message;
    }
    _emit();
  }

  void _clearLegacyBoard() {
    _board = null;
    _queue = null;
    _lastSyncedAt = null;
    _servingCachedBoard = false;
    _boardUnavailableReason = null;
  }

  void _handleAuthenticatedBoardChanged() {
    if (_disposed || _mode != WorkspaceMode.authenticated) return;
    _emit();
  }

  bool _isCurrent(int generation, String userId) =>
      !_disposed &&
      generation == _generation &&
      _mode == WorkspaceMode.authenticated &&
      _userId == userId;

  void _startRefreshTimer() {
    _stopRefreshTimer();
    if (productionId == null) return;
    _refreshTimer = Timer.periodic(_workspaceRefreshInterval, (_) {
      if (_disposed || _busy) return;
      unawaited(refreshBoard(silent: true));
    });
  }

  void _stopRefreshTimer() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  String _errorText(Object error) {
    final text = error.toString();
    return text.startsWith('Exception: ')
        ? text.substring('Exception: '.length)
        : text;
  }

  String _timeLabel(DateTime value) {
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    final second = value.second.toString().padLeft(2, '0');
    return '$hour:$minute:$second';
  }

  String _ageLabel(DateTime value) {
    final minutes = DateTime.now().difference(value).inMinutes;
    if (minutes < 1) return 'moments ago';
    if (minutes == 1) return '1 min ago';
    if (minutes < 60) return '$minutes min ago';
    final hours = (minutes / 60).floor();
    if (hours == 1) return '1 hour ago';
    if (hours < 24) return '$hours hours ago';
    final days = (hours / 24).floor();
    return days == 1 ? '1 day ago' : '$days days ago';
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    WidgetsBinding.instance.removeObserver(this);
    _stopRefreshTimer();
    _legacyApi?.close();
    _boardController.removeListener(_handleAuthenticatedBoardChanged);
    _boardController.dispose();
    super.dispose();
  }
}
