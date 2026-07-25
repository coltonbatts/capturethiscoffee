// Bluetooth printing and durable physical-print recovery.
//
// Build 9 moved authentication, days, selected-board loading, and board caches
// into SessionController and WorkspaceController. This controller consumes the
// workspace's shared ProductionBoard → PrinterQueue projection; it does not own
// account or navigation state.
//
// The split line is confirmation. This class never shows a dialog and never
// takes a BuildContext: `printAllPending` prints, `clearSession` clears, and
// `retryUncertainPrint` retries, unconditionally. Deciding whether the operator
// meant it belongs to the screen that asked. That keeps every destructive
// operation testable without pumping a widget, and it keeps the confirmation
// copy next to the button that triggers it.
//
// Translation notes from the State it replaces:
//   * `setState(...)` became a mutation followed by `notifyListeners()`.
//   * `if (!mounted) return` became `if (_disposed) return`. The checks are not
//     defensive noise — every one of them guards an await that can outlive the
//     thing that started it.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:niim_blue_flutter/niim_blue_flutter.dart';

import 'board_cache.dart';
import 'ctc_api.dart';
import 'label_content.dart';
import 'label_painter.dart';
import 'print_recovery.dart';
import 'printer_validation.dart';
import 'production_board.dart';
import 'production_session.dart';
import 'session_store.dart';
import 'widgets/print_deck.dart';
import 'widgets/roster_section.dart';
import 'workspace_controller.dart';

// M2_H @ 300 DPI. The library metadata reports a 567-dot printhead for model
// 4608, while the server PNG is 591x354 with safe margins for 50x30mm stock.
const int kPrintheadWidth = 567;
const int kDensity = 3;
const int kLabelType = 1;
const int kMinimumTextSideInkPixels = 300;
const _printerScanTimeout = Duration(seconds: 8);
const _printOperationTimeout = Duration(seconds: 60);
typedef CtcApiFactory = CtcApi Function(ProductionSession session);

enum PrinterStatus {
  disconnected,
  connecting,
  connected,
  printing,
  error,
}

/// Thrown when paper came out but the server did not record it. Distinct from a
/// print failure because the operator must not reprint.
class PrintSyncPendingException implements Exception {
  const PrintSyncPendingException(this.message);

  final String message;

  @override
  String toString() => message;
}

class _LabelPrintSize {
  const _LabelPrintSize(this.width, this.height);

  final int width;
  final int height;
}

class PrinterController extends ChangeNotifier with WidgetsBindingObserver {
  PrinterController({
    SessionRepository? sessionRepository,
    PrintRecoveryRepository? printRecoveryRepository,
    BoardCacheRepository? boardCacheRepository,
    CtcApiFactory? apiFactory,
    WorkspaceController? workspaceController,
  })  : _printRecoveryRepository =
            printRecoveryRepository ?? PreferencesPrintRecoveryRepository(),
        _workspace = workspaceController ??
            WorkspaceController(
              legacySessionRepository:
                  sessionRepository ?? KeychainSessionRepository(),
              legacyCacheRepository:
                  boardCacheRepository ?? PreferencesBoardCacheRepository(),
              legacyApiFactory: apiFactory ?? CtcApi.new,
              legacyTestMode: sessionRepository != null ||
                  boardCacheRepository != null ||
                  apiFactory != null,
            ),
        _ownsWorkspace = workspaceController == null;

  final NiimbotBluetoothClient _client = NiimbotBluetoothClient();
  final PrintRecoveryRepository _printRecoveryRepository;
  final WorkspaceController _workspace;
  final bool _ownsWorkspace;

  final List<String> _log = [];

  PrintRecoveryLedger? _printRecoveryLedger;
  bool _disposed = false;
  RosterFilter _rosterFilter = RosterFilter.toPrint;

  /// Bumped once per label that physically printed; drives the deck's stamp.
  int _printSuccessToken = 0;
  String _rosterQuery = '';
  String _loggedQueueSignature = '';
  bool _connected = false;
  bool _busy = false;
  PrinterStatus _printerStatus = PrinterStatus.disconnected;
  String? _operatorError;
  String? _failedBatchLabel;
  String? _connectedDeviceName;

  // ---------------------------------------------------------------- lifecycle

  Future<void> start() async {
    WidgetsBinding.instance.addObserver(this);
    _workspace.addListener(_handleWorkspaceChanged);
    _printRecoveryLedger =
        await PrintRecoveryLedger.load(_printRecoveryRepository);
    if (_ownsWorkspace) {
      await _workspace.start();
    }
    await _reconcileServerConfirmedRecovery();
    _emit();
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _workspace.removeListener(_handleWorkspaceChanged);
    if (_ownsWorkspace) _workspace.dispose();
    _client.disconnect();
    super.dispose();
  }

  /// Only notifies while the controller is alive. Every mutation below routes
  /// through here rather than calling `notifyListeners` directly, because most
  /// of them land after an await that can outlive the screen that began it.
  void _emit() {
    if (_disposed) return;
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (_connected && !_busy) {
        unawaited(_verifyConnectionAfterResume());
      }
    }
  }

  // ------------------------------------------------------------------ getters

  List<String> get log => List.unmodifiable(_log);
  ProductionSession? get session => _workspace.legacySession;
  WorkspaceController get workspace => _workspace;
  PrinterQueue? get queue => _workspace.queue;
  PrintRecoveryLedger? get printRecoveryLedger => _printRecoveryLedger;
  bool get connected => _connected;
  String? get connectedDeviceName => _connectedDeviceName;
  bool get busy => _busy || _workspace.busy;
  bool get loadingSession => _workspace.loadingLegacy;
  PrinterStatus get printerStatus => _printerStatus;
  String? get operatorError => _operatorError ?? _workspace.error;
  String? get failedBatchLabel => _failedBatchLabel;
  bool get servingCachedBoard => _workspace.servingCachedBoard;
  DateTime? get lastSyncedAt => _workspace.lastSyncedAt;
  int get printSuccessToken => _printSuccessToken;
  RosterFilter get rosterFilter => _rosterFilter;
  String get rosterQuery => _rosterQuery;
  bool get isPrinting => _printerStatus == PrinterStatus.printing;

  int get printedCount =>
      queue?.labels.where((label) => label.labelPrinted).length ?? 0;

  int get totalCount => queue?.labels.length ?? 0;

  List<QueueLabel> get pendingLabels {
    final labels = queue?.labels ?? [];
    return labels
        .where(
          (label) =>
              !label.labelPrinted &&
              _printRecoveryLedger?[label.orderId] == null,
        )
        .toList();
  }

  List<PrintRecoveryRecord> get currentRecoveryRecords {
    final scopeKey = _workspace.scopeKey;
    final productionId = _workspace.productionId;
    final ledger = _printRecoveryLedger;
    if (scopeKey == null || productionId == null || ledger == null) {
      return const [];
    }
    return ledger.forScope(
      scopeKey: scopeKey,
      productionId: productionId,
    );
  }

  List<QueueLabel> get visibleLabels {
    final labels = queue?.labels ?? [];
    final knownOrderIds = labels.map((label) => label.orderId).toSet();
    final recoveryOnlyLabels = currentRecoveryRecords
        .where((record) => !knownOrderIds.contains(record.orderId))
        .map(
          (record) => QueueLabel(
            orderId: record.orderId,
            personName: record.personName,
            drink: record.drink,
            group: '',
            status: '',
            labelPrinted: false,
          ),
        );
    final combined = [...labels, ...recoveryOnlyLabels];
    final byFilter = switch (_rosterFilter) {
      RosterFilter.toPrint => combined.where((label) => !label.labelPrinted),
      RosterFilter.printed => combined.where((label) => label.labelPrinted),
      RosterFilter.all => combined,
    };

    final query = _rosterQuery.trim().toLowerCase();
    if (query.isEmpty) return byFilter.toList();

    // Name and drink both, so "oat" finds the drink and "priya" finds the
    // person. Group is deliberately excluded: searching "camera" would return
    // a department rather than the individual the operator is looking at.
    return byFilter
        .where((label) =>
            label.personName.toLowerCase().contains(query) ||
            label.drink.toLowerCase().contains(query))
        .toList();
  }

  /// How many rows each filter would show, ignoring the search query.
  ///
  /// Ignoring the query is the point: the counts sit on the filter chips, and a
  /// chip that changed its number as you typed would be answering a different
  /// question than the one it is labelled with.
  Map<RosterFilter, int> get rosterCounts {
    final labels = queue?.labels ?? const <QueueLabel>[];
    final printed = labels.where((label) => label.labelPrinted).length;
    final recoveryOnly = currentRecoveryRecords
        .where(
            (record) => !labels.any((label) => label.orderId == record.orderId))
        .length;
    final total = labels.length + recoveryOnly;
    return {
      RosterFilter.toPrint: total - printed,
      RosterFilter.printed: printed,
      RosterFilter.all: total,
    };
  }

  /// Why printing is unavailable, in the order the operator must resolve it.
  ///
  /// Ordering matters: a disconnected printer is the most common and most
  /// fixable cause, so it is reported before a paused production. Recovery
  /// outranks neither — it only blocks once the queue's own top item is the one
  /// awaiting a physical check.
  DeckBlock get deckBlock {
    if (!_connected) return DeckBlock.disconnected;
    // Ahead of the cached status, which is exactly the value not to trust here:
    // a completed production still says `active` in a cache written while it
    // was running.
    if (_workspace.boardUnavailableReason != null) {
      return DeckBlock.unavailable;
    }
    if (queue?.isProductionActive != true) {
      return DeckBlock.productionInactive;
    }
    if (pendingLabels.isEmpty && currentRecoveryRecords.isNotEmpty) {
      return DeckBlock.recoveryPending;
    }
    return DeckBlock.none;
  }

  /// Why the server refused this production, or null while it is readable.
  String? get boardUnavailableReason => _workspace.boardUnavailableReason;

  /// The label the deck is showing — the first pending one.
  QueueLabel? get deckLabel =>
      pendingLabels.isEmpty ? null : pendingLabels.first;

  LabelContent? get deckContent {
    final item = deckLabel;
    final currentQueue = queue;
    if (item == null || currentQueue == null) return null;
    return LabelContent.fromQueue(
      orderId: item.orderId,
      personName: item.personName,
      drink: item.drink,
      group: item.group,
      productionName: currentQueue.productionName,
      clientName: currentQueue.clientName,
    );
  }

  String? get productionStatusLabel {
    return _workspace.productionStatusLabel;
  }

  /// The line under the queue metrics. Never says "synced" about stale data.
  String get syncStatusLabel {
    return _workspace.syncStatusLabel;
  }

  /// A board older than this is called out loudly rather than in small print.
  static const staleBoardThreshold = WorkspaceController.staleBoardThreshold;

  bool get boardIsStale {
    // "Working offline" would be a lie about a production the server has
    // refused — that gets its own, louder notice.
    return _workspace.boardIsStale;
  }

  /// How old the board on screen is, in words — "12 min ago". Null when nothing
  /// has ever synced, which is a different sentence, not an age of zero.
  String? get boardAgeLabel {
    return _workspace.boardAgeLabel;
  }

  String labelTitle(QueueLabel item) {
    final drink = item.drink.trim();
    if (drink.isEmpty) return item.personName;
    return '${item.personName} - $drink';
  }

  PrintRecoveryRecord? recoveryFor(String orderId) =>
      _printRecoveryLedger?[orderId];

  // ------------------------------------------------------------- UI selection

  void setRosterFilter(RosterFilter filter) {
    if (_rosterFilter == filter) return;
    _rosterFilter = filter;
    _emit();
  }

  void setRosterQuery(String query) {
    if (_rosterQuery == query) return;
    _rosterQuery = query;
    _emit();
  }

  void dismissError() {
    if (_operatorError == null &&
        _failedBatchLabel == null &&
        _workspace.error == null) {
      return;
    }
    _operatorError = null;
    _failedBatchLabel = null;
    _workspace.dismissError();
    // Dismissing the message also clears the error *state*, otherwise the
    // printer stays latched in `error` with nothing on screen explaining why
    // and the deck refuses to print.
    if (_printerStatus == PrinterStatus.error) {
      _printerStatus =
          _connected ? PrinterStatus.connected : PrinterStatus.disconnected;
    }
    _emit();
  }

  // ----------------------------------------------------------- workspace bridge

  /// Unconditional. The screen decides whether to ask first — see
  /// [currentRecoveryRecords], which is what makes the question worth asking.
  Future<void> clearSession() async {
    await _workspace.clearLegacySession();
    _operatorError = null;
    _failedBatchLabel = null;
    _emit();
  }

  Future<bool> linkProduction(String url) =>
      _workspace.linkLegacyProduction(url);

  Future<void> refreshBoard({bool silent = false}) =>
      _workspace.refreshBoard(silent: silent);

  void _handleWorkspaceChanged() {
    if (_disposed) return;
    final currentQueue = queue;
    if (currentQueue != null) {
      final signature = currentQueue.labels
          .map((label) =>
              '${label.orderId}|${label.drink}|${label.status}|${label.labelPrinted}')
          .join('\n');
      if (signature != _loggedQueueSignature) {
        _loggedQueueSignature = signature;
        final pending =
            currentQueue.labels.where((label) => !label.labelPrinted).length;
        _logLine(
          'Queue: ${currentQueue.labels.length} labels, $pending to print for '
          '${currentQueue.productionName}'
          '${_workspace.servingCachedBoard ? ' (cached)' : ''}.',
        );
      }
    } else {
      _loggedQueueSignature = '';
    }
    unawaited(_reconcileServerConfirmedRecovery());
    _emit();
  }

  Future<void> _reconcileServerConfirmedRecovery() async {
    final currentQueue = queue;
    if (_workspace.servingCachedBoard || currentQueue == null) return;
    final serverConfirmed = currentQueue.labels
        .where((label) => label.labelPrinted)
        .map((label) => label.orderId);
    await _printRecoveryLedger?.clearServerConfirmed(serverConfirmed);
    _emit();
  }

  // ----------------------------------------------------------------- printer

  Future<bool> connectPrinter() => _run('Connect printer', () async {
        _printerStatus = PrinterStatus.connecting;
        _emit();
        _logLine('Scanning for the NIIMBOT M2_H…');
        _logLine('(Force-quit the official NIIMBOT app first!)');
        final devices = await NiimbotBluetoothClient.listDevices(
          timeout: _printerScanTimeout,
        );
        if (devices.isEmpty) {
          throw Exception(
            'No NIIMBOT printer found. Wake the M2_H and force-quit the official NIIMBOT app.',
          );
        }
        if (devices.length > 1) {
          final names = devices
              .map((device) => device.platformName)
              .where((name) => name.isNotEmpty)
              .join(', ');
          throw Exception(
            'Multiple NIIMBOT printers are nearby${names.isEmpty ? '' : ' ($names)'}. '
            'Power off the others so this app cannot select the wrong printer.',
          );
        }
        final scannedName = devices.single.platformName;
        if (!looksLikeM2HDeviceName(scannedName)) {
          throw Exception(
            'Found ${scannedName.isEmpty ? 'an unnamed NIIMBOT' : scannedName}, not an M2_H. '
            'This release supports only the NIIMBOT M2_H.',
          );
        }
        try {
          final connection = await _client.connect();
          _connectedDeviceName = connection.deviceName ?? scannedName;
        } catch (error) {
          _connected = false;
          _connectedDeviceName = null;
          _printerStatus = PrinterStatus.error;
          _emit();
          throw Exception('Printer not connected. ${_errorText(error)}');
        }
        _client.setOnDisconnect(() {
          _logLine('Printer disconnected.');
          if (_disposed) return;
          _connected = false;
          _connectedDeviceName = null;
          _printerStatus = PrinterStatus.disconnected;
          _emit();
        });
        try {
          await _verifyModelDetection();
        } catch (_) {
          try {
            await _client.disconnect();
          } catch (_) {
            // Preserve the model-validation error shown to the operator.
          }
          _connectedDeviceName = null;
          rethrow;
        }
        unawaited(HapticFeedback.mediumImpact());
        _connected = true;
        _printerStatus = PrinterStatus.connected;
        _emit();
      }, affectsPrinter: true);

  // connect() swallows printer-info failures inside niim_blue_flutter, so a
  // green connection can still have modelId == null and be unable to print.
  Future<void> _verifyModelDetection() async {
    var meta = _client.getModelMetadata();
    for (var attempt = 1; meta == null && attempt <= 2; attempt += 1) {
      _logLine('Printer model not detected; retrying info fetch ($attempt)…');
      try {
        await _client.fetchPrinterInfo();
      } catch (error) {
        _logLine('Info fetch failed: ${_errorText(error)}');
      }
      meta = _client.getModelMetadata();
    }
    final info = _client.getPrinterInfo();
    if (meta == null) {
      if (!looksLikeM2HDeviceName(_connectedDeviceName)) {
        throw Exception(
          'Could not verify this printer as an M2_H. Disconnecting for safety.',
        );
      }
      _logLine(
        'Model ID unavailable, but the only scanned device identifies as '
        '${_connectedDeviceName ?? 'M2_H'}. Using the M2_H print task.',
      );
    } else {
      if (!isSupportedM2H(
        modelId: info.modelId,
        deviceName: _connectedDeviceName,
      )) {
        throw Exception(
          'Detected ${meta.model} (modelId ${info.modelId}), not M2_H. '
          'This release supports only model $niimbotM2HModelId.',
        );
      }
      _logLine('Detected ${meta.model} (modelId ${info.modelId}).');
    }
  }

  Future<bool> disconnectPrinter() => _run('Disconnect printer', () async {
        await _client.disconnect();
        _connected = false;
        _connectedDeviceName = null;
        _printerStatus = PrinterStatus.disconnected;
        _emit();
      }, affectsPrinter: true);

  Future<void> _verifyConnectionAfterResume() async {
    try {
      await _client.fetchPrinterInfo().timeout(const Duration(seconds: 8));
      await _verifyModelDetection();
      if (_disposed) return;
      _connected = true;
      _printerStatus = PrinterStatus.connected;
      _emit();
      _logLine('Printer connection verified after app resume.');
    } catch (_) {
      try {
        await _client.disconnect();
      } catch (_) {
        // The local UI still needs to return to a safe disconnected state.
      }
      if (_disposed) return;
      _connected = false;
      _connectedDeviceName = null;
      _printerStatus = PrinterStatus.disconnected;
      _operatorError =
          'Printer connection was lost while the app was in the background. Reconnect before printing.';
      _emit();
      _logLine('Printer must reconnect after app resume.');
    }
  }

  Future<void> _printPage(PrintPage page) async {
    _client.stopHeartbeat();
    _client.setPacketInterval(15);
    try {
      await (() async {
        final encoded = page.toEncodedImage();
        final options = PrintOptions(
          totalPages: 1,
          density: kDensity,
          labelType: LabelType.fromValue(kLabelType),
        );
        var task = _client.createPrintTask(options);
        if (task == null) {
          if (!looksLikeM2HDeviceName(_connectedDeviceName)) {
            throw Exception('Printer model is not verified as M2_H.');
          }
          _logLine('Using the M2_H (B1) print task for the verified device.');
          task = B1PrintTask(_client.abstraction, options);
        }
        await task.printInit();
        await task.printPage(encoded, 1);
        await task.waitForFinished();
      })()
          .timeout(_printOperationTimeout);
    } finally {
      _client.startHeartbeat();
    }
  }

  // ------------------------------------------------------------------ printing

  Future<bool> printLabel(QueueLabel item) => _run(
        item.labelPrinted
            ? 'Reprint ${item.personName}'
            : 'Print ${item.personName}',
        () => _printOneLabel(item),
        affectsPrinter: true,
      );

  /// Unconditional — the screen confirms first. Stops at the first failure and
  /// records which label it stopped on, because "the batch stopped" is useless
  /// without "and this is the one you are holding".
  Future<bool> printAllPending() async {
    final pending = pendingLabels;
    if (pending.isEmpty) {
      return _run('Print all pending', () async {
        throw Exception('No pending labels to print.');
      });
    }

    return _run('Print all pending', () async {
      for (final item in pending) {
        try {
          await _printOneLabel(item);
        } catch (_) {
          _failedBatchLabel = labelTitle(item);
          _emit();
          rethrow;
        }
      }
    }, affectsPrinter: true);
  }

  Future<void> _printOneLabel(QueueLabel item) async {
    // Checked before the cached status, which cannot be trusted once the server
    // has refused the production: a day marked complete still reads `active` in
    // a cache written while it was running.
    final unavailable = _workspace.boardUnavailableReason;
    if (unavailable != null) {
      throw Exception(
        'This production is no longer available. $unavailable Refresh, and ask '
        'the coordinator if it should still be open.',
      );
    }
    if (queue?.isProductionActive != true) {
      throw Exception(
        'Printing is paused until the coordinator marks this production Active. Refresh after its status changes.',
      );
    }
    if (!_connected) {
      throw Exception('Printer not connected. Tap Connect printer first.');
    }
    final currentQueue = queue;
    if (currentQueue == null || _workspace.productionId == null) {
      throw Exception('Select a day before printing.');
    }
    if (_printRecoveryLedger == null) {
      throw Exception(
        'Print recovery storage is unavailable. Restart the app before printing.',
      );
    }
    if (_printRecoveryLedger?[item.orderId] != null) {
      throw Exception(
        'This label has an unresolved print outcome. Use its recovery action instead of reprinting.',
      );
    }

    _printerStatus = PrinterStatus.printing;
    _emit();

    // Rendered on device, not fetched. Downloading one PNG per label made
    // printing impossible without a signal, even for orders captured hours
    // earlier — see docs/offline-first-ios-handoff.md.
    _logLine('Rendering label for ${item.personName}…');
    late final Uint8List bytes;
    try {
      bytes = await renderLabelPng(
        LabelContent.fromQueue(
          orderId: item.orderId,
          personName: item.personName,
          drink: item.drink,
          group: item.group,
          productionName: currentQueue.productionName,
          clientName: currentQueue.clientName,
        ),
      );
    } catch (error) {
      _printerStatus = PrinterStatus.error;
      _emit();
      throw Exception(
        'Could not render the label for ${item.personName}. ${_errorText(error)}',
      );
    }

    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      _printerStatus = PrinterStatus.error;
      _emit();
      throw Exception(
        'Could not decode the rendered label for ${item.personName}.',
      );
    }
    final printSize = _printSizeFor(decoded);
    final textSideInk = _countTextSideInk(decoded);
    _logLine(
      'PNG ${decoded.width}x${decoded.height}; '
      'print ${printSize.width}x${printSize.height}; '
      'text-side ink $textSideInk.',
    );

    final page = PrintPage(printSize.width, printSize.height);
    page.addImageFromBuffer(ImageFromBufferOptions(
      buffer: bytes,
      x: printSize.width ~/ 2,
      y: printSize.height ~/ 2,
      width: printSize.width,
      height: printSize.height,
      align: HAlignment.center,
      vAlign: VAlignment.middle,
      threshold: 128,
    ));
    if (textSideInk < kMinimumTextSideInkPixels) {
      _logLine(
        'PNG text area looks blank; adding emergency name/drink overlay.',
      );
      await _addEmergencyTextOverlay(page, item, printSize);
    }

    try {
      await _printPage(page);
    } catch (error) {
      await _recordPrintRecovery(item, PrintRecoveryState.uncertain);
      await _disconnectAfterAmbiguousPrint();
      unawaited(_hapticUncertain());
      _printerStatus = PrinterStatus.error;
      _emit();
      throw Exception(
        'The print outcome for ${item.personName} is uncertain. Check the physical printer, then choose “Label printed — sync only” or “Nothing printed — retry.” ${_errorText(error)}',
      );
    }

    await _recordPrintRecovery(item, PrintRecoveryState.printedNeedsSync);
    // Paper is out. The thump lands with the printer's own, so a print is
    // confirmed in the hand as well as on the screen — which matters on a set
    // loud enough that neither is audible.
    unawaited(HapticFeedback.heavyImpact());
    _printerStatus = PrinterStatus.connected;
    _printSuccessToken += 1;
    _emit();

    _logLine('Marking label_printed…');
    try {
      await _workspace.markLabelPrinted(item.orderId);
    } catch (error) {
      throw PrintSyncPendingException(
        'Printed ${item.personName}, but the workspace did not sync. Do not reprint. Tap “Sync only” on this label. ${_errorText(error)}',
      );
    }

    await _printRecoveryLedger?.clear(item.orderId);
    await refreshBoard(silent: true);
  }

  /// Two beats, not one. An uncertain print is the state the operator must not
  /// mistake for success, so it must not feel like success either.
  Future<void> _hapticUncertain() async {
    await HapticFeedback.heavyImpact();
    await Future<void>.delayed(const Duration(milliseconds: 140));
    await HapticFeedback.heavyImpact();
  }

  Future<void> _disconnectAfterAmbiguousPrint() async {
    try {
      await _client.disconnect();
    } catch (_) {
      // The UI must require a clean reconnect even if teardown also fails.
    }
    if (_disposed) return;
    _connected = false;
    _connectedDeviceName = null;
    _printerStatus = PrinterStatus.error;
    _emit();
  }

  // ------------------------------------------------------------------ recovery

  Future<void> _recordPrintRecovery(
    QueueLabel item,
    PrintRecoveryState state,
  ) async {
    final scopeKey = _workspace.scopeKey;
    final productionId = _workspace.productionId;
    final ledger = _printRecoveryLedger;
    if (scopeKey == null || productionId == null || ledger == null) {
      throw StateError('Print recovery storage is unavailable.');
    }
    try {
      await ledger.record(PrintRecoveryRecord(
        apiBase: scopeKey,
        productionId: productionId,
        orderId: item.orderId,
        personName: item.personName,
        drink: item.drink,
        createdAt: DateTime.now(),
        state: state,
      ));
    } catch (error) {
      // The ledger mutates before persistence. Keep the in-memory recovery and
      // continue to the server sync, which may still complete successfully.
      _logLine('Could not persist print recovery: ${error.runtimeType}.');
    } finally {
      _emit();
    }
  }

  Future<bool> syncPrintedLabel(QueueLabel item) => _run(
        'Sync ${item.personName}',
        () async {
          final recovery = _printRecoveryLedger?[item.orderId];
          if (_workspace.productionId == null || recovery == null) {
            throw Exception('No pending printed-status sync for this label.');
          }
          if (recovery.state == PrintRecoveryState.uncertain) {
            throw Exception(
                'Confirm whether the physical label printed first.');
          }
          await _workspace.markLabelPrinted(item.orderId);
          await _printRecoveryLedger?.clear(item.orderId);
          _emit();
          await refreshBoard(silent: true);
        },
      );

  Future<void> confirmUncertainLabelPrinted(QueueLabel item) async {
    await _printRecoveryLedger?.markPhysicalPrintConfirmed(item.orderId);
    _emit();
    await syncPrintedLabel(item);
  }

  /// Unconditional — the screen confirms first, and that confirmation is the
  /// only thing standing between this and a duplicate physical label.
  Future<void> retryUncertainPrint(QueueLabel item) async {
    await _printRecoveryLedger?.clear(item.orderId);
    _emit();
    await printLabel(item);
  }

  // ------------------------------------------------------------------ imaging

  _LabelPrintSize _printSizeFor(img.Image decoded) {
    final width =
        decoded.width > kPrintheadWidth ? kPrintheadWidth : decoded.width;
    final height = (decoded.height * width / decoded.width).round();
    return _LabelPrintSize(width, height);
  }

  int _countTextSideInk(img.Image decoded) {
    final startX = (decoded.width * 0.44).round();
    var count = 0;

    for (var y = 0; y < decoded.height; y += 1) {
      for (var x = startX; x < decoded.width; x += 1) {
        final pixel = decoded.getPixel(x, y);
        if (pixel.a.toInt() == 0) continue;

        final luminance =
            (pixel.r.toInt() + pixel.g.toInt() + pixel.b.toInt()) ~/ 3;
        if (luminance < 180) count += 1;
      }
    }

    return count;
  }

  Future<void> _addEmergencyTextOverlay(
    PrintPage page,
    QueueLabel item,
    _LabelPrintSize printSize,
  ) async {
    final name = item.personName.trim().toUpperCase();
    final drink = item.drink.trim();
    final textX = (printSize.width * 0.46).round();

    if (name.isNotEmpty) {
      await page.addText(
        name,
        TextOptions(
          x: textX,
          y: (printSize.height * 0.26).round(),
          fontSize: _emergencyNameFontSize(name),
          fontWeight: FontWeight.w900,
        ),
      );
    }

    if (drink.isNotEmpty) {
      await page.addText(
        drink,
        TextOptions(
          x: textX,
          y: (printSize.height * 0.66).round(),
          fontSize: 26,
          fontWeight: FontWeight.w700,
        ),
      );
    }
  }

  int _emergencyNameFontSize(String value) {
    final length = value.replaceAll(RegExp(r'\s+'), ' ').trim().length;
    if (length <= 10) return 58;
    if (length <= 20) return 46;
    if (length <= 24) return 38;
    return 30;
  }

  // ------------------------------------------------------------------ plumbing

  void _logLine(String message) {
    if (_disposed) return;
    final stamp = DateTime.now().toIso8601String().substring(11, 19);
    _log.insert(0, '[$stamp] $message');
    _emit();
    // ignore: avoid_print
    print('[printer] $message');
  }

  Future<bool> _run(
    String label,
    Future<void> Function() action, {
    bool affectsPrinter = false,
  }) async {
    if (_busy) return false;
    _busy = true;
    _operatorError = null;
    _failedBatchLabel = null;
    if (_printerStatus == PrinterStatus.error) {
      _printerStatus =
          _connected ? PrinterStatus.connected : PrinterStatus.disconnected;
    }
    _emit();
    _logLine('--- $label ---');
    try {
      await action();
      _logLine('$label: OK');
      return true;
    } catch (error, stack) {
      final message = '$label failed: ${_errorText(error)}';
      if (!_disposed) {
        _operatorError = message;
        if (affectsPrinter && error is! PrintSyncPendingException) {
          _printerStatus = PrinterStatus.error;
        }
        _emit();
      }
      _logLine('$label FAILED: ${_errorText(error)}');
      _logLine(stack.toString().split('\n').take(3).join(' | '));
      return false;
    } finally {
      _busy = false;
      _emit();
    }
  }

  String _errorText(Object error) {
    final text = error.toString();
    if (text.startsWith('Exception: ')) {
      return text.substring('Exception: '.length);
    }
    return text;
  }
}
