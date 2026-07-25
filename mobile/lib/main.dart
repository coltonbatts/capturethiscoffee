// Capture This Coffee — NIIMBOT M2_H direct BLE printer app.
//
// Load a production share link, render label PNGs on device, print over BLE,
// and mark label_printed via the public order PATCH route.
//
// Labels are rendered locally by label_painter.dart rather than downloaded, so
// printing does not require a signal. The queue fetch still does; caching it is
// Phase B of docs/offline-first-ios-handoff.md.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:niim_blue_flutter/niim_blue_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'board_cache.dart';
import 'ctc_api.dart';
import 'label_content.dart';
import 'label_painter.dart';
import 'print_recovery.dart';
import 'production_board.dart';
import 'printer_validation.dart';
import 'production_session.dart';
import 'session_store.dart';
import 'theme.dart';
import 'widgets/brand_mark.dart';
import 'widgets/print_deck.dart';
import 'widgets/roster_section.dart';

// M2_H @ 300 DPI. The library metadata reports a 567-dot printhead for model
// 4608, while the server PNG is 591x354 with safe margins for 50x30mm stock.
const int kPrintheadWidth = 567;
const int kDensity = 3;
const int kLabelType = 1;
const int kMinimumTextSideInkPixels = 300;
const String kAppVersion = '1.0.0 (8)';
const _printerScanTimeout = Duration(seconds: 8);
const _printOperationTimeout = Duration(seconds: 60);

const _queueRefreshInterval = Duration(seconds: 10);
final _privacyUri = Uri.parse('https://coffee.capturethis.com/privacy');
final _supportUri = Uri.parse('https://coffee.capturethis.com/support');

typedef CtcApiFactory = CtcApi Function(ProductionSession session);

void main() => runApp(const PrinterApp());

class PrinterApp extends StatelessWidget {
  const PrinterApp({
    super.key,
    this.sessionRepository,
    this.printRecoveryRepository,
    this.boardCacheRepository,
    this.apiFactory,
  });

  final SessionRepository? sessionRepository;
  final PrintRecoveryRepository? printRecoveryRepository;
  final BoardCacheRepository? boardCacheRepository;
  final CtcApiFactory? apiFactory;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Capture This Coffee',
      debugShowCheckedModeBanner: false,
      theme: buildCaptureTheme(),
      home: PrinterHome(
        sessionRepository: sessionRepository,
        printRecoveryRepository: printRecoveryRepository,
        boardCacheRepository: boardCacheRepository,
        apiFactory: apiFactory,
      ),
    );
  }
}

class _HelpStep extends StatelessWidget {
  const _HelpStep({
    required this.number,
    required this.title,
    required this.body,
  });

  final String number;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DecoratedBox(
            decoration: const BoxDecoration(
              color: CaptureColors.yellow,
              shape: BoxShape.circle,
            ),
            child: SizedBox(
              width: 36,
              height: 36,
              child: Center(
                child: Text(
                  number,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 2),
                Text(body),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PrinterHome extends StatefulWidget {
  const PrinterHome({
    super.key,
    this.sessionRepository,
    this.printRecoveryRepository,
    this.boardCacheRepository,
    this.apiFactory,
  });

  final SessionRepository? sessionRepository;
  final PrintRecoveryRepository? printRecoveryRepository;
  final BoardCacheRepository? boardCacheRepository;
  final CtcApiFactory? apiFactory;

  @override
  State<PrinterHome> createState() => _PrinterHomeState();
}

class _LabelPrintSize {
  const _LabelPrintSize(this.width, this.height);

  final int width;
  final int height;
}

enum _PrinterStatus {
  disconnected,
  connecting,
  connected,
  printing,
  error,
}

class _PrintSyncPendingException implements Exception {
  const _PrintSyncPendingException(this.message);

  final String message;

  @override
  String toString() => message;
}

class _PrinterHomeState extends State<PrinterHome> with WidgetsBindingObserver {
  final NiimbotBluetoothClient _client = NiimbotBluetoothClient();
  final List<String> _log = [];
  final _linkController = TextEditingController();
  final _rosterSearchController = TextEditingController();

  ProductionSession? _session;
  CtcApi? _api;
  late final SessionRepository _sessionRepository;
  late final PrintRecoveryRepository _printRecoveryRepository;
  late final BoardCacheRepository _boardCacheRepository;
  late final CtcApiFactory _apiFactory;
  PrintRecoveryLedger? _printRecoveryLedger;
  PrinterQueue? _queue;
  Timer? _queueRefreshTimer;

  /// When the server last confirmed the board on screen — not when the app last
  /// read it back off disk. An operator needs the age of the data.
  DateTime? _lastSyncedAt;

  /// True while the board on screen came from disk and has not been confirmed
  /// by the server since. Drives the offline banner.
  bool _servingCachedBoard = false;

  String _queueSignature = '';
  RosterFilter _rosterFilter = RosterFilter.toPrint;

  /// Bumped once per label that physically printed; drives the deck's stamp.
  int _printSuccessToken = 0;
  String _rosterQuery = '';
  bool _connected = false;
  bool _busy = false;
  bool _loadingSession = true;
  _PrinterStatus _printerStatus = _PrinterStatus.disconnected;
  String? _operatorError;
  String? _failedBatchLabel;
  String? _connectedDeviceName;

  @override
  void initState() {
    super.initState();
    _sessionRepository =
        widget.sessionRepository ?? KeychainSessionRepository();
    _printRecoveryRepository =
        widget.printRecoveryRepository ?? PreferencesPrintRecoveryRepository();
    _boardCacheRepository =
        widget.boardCacheRepository ?? PreferencesBoardCacheRepository();
    _apiFactory = widget.apiFactory ?? (session) => CtcApi(session);
    WidgetsBinding.instance.addObserver(this);
    _restoreSession();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopQueueRefreshTimer();
    _linkController.dispose();
    _rosterSearchController.dispose();
    _api?.close();
    _client.disconnect();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (_session != null) {
        _startQueueRefreshTimer();
        unawaited(_refreshBoard(silent: true));
      }
      if (_connected && !_busy) {
        unawaited(_verifyConnectionAfterResume());
      }
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _stopQueueRefreshTimer();
    }
  }

  Future<void> _restoreSession() async {
    try {
      final results = await Future.wait<Object?>([
        _sessionRepository.read(),
        PrintRecoveryLedger.load(_printRecoveryRepository),
        _readCachedBoard(),
      ]);
      final saved = results[0] as ProductionSession?;
      final ledger = results[1] as PrintRecoveryLedger;
      final cached = results[2] as CachedBoard?;
      if (!mounted) return;
      setState(() {
        _session = saved;
        _api = saved == null ? null : _apiFactory(saved);
        _printRecoveryLedger = ledger;
        _loadingSession = false;
      });

      if (saved == null) return;

      // Show the cached board before touching the network. On a stage with no
      // signal this is the entire difference between a usable app and an empty
      // one — the session survives in the Keychain, but the roster does not.
      if (cached != null && cached.belongsTo(saved)) {
        await _applyBoard(
          cached.board,
          silent: true,
          syncedAt: cached.syncedAt,
          fromCache: true,
        );
      }

      _startQueueRefreshTimer();
      await _refreshBoard(silent: true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingSession = false;
        _operatorError =
            'Could not open the saved production securely. Relink the production.';
      });
      _logLine('Secure session restore failed: ${error.runtimeType}.');
    }
  }

  Future<void> _verifyConnectionAfterResume() async {
    try {
      await _client.fetchPrinterInfo().timeout(const Duration(seconds: 8));
      await _verifyModelDetection();
      if (!mounted) return;
      setState(() {
        _connected = true;
        _printerStatus = _PrinterStatus.connected;
      });
      _logLine('Printer connection verified after app resume.');
    } catch (_) {
      try {
        await _client.disconnect();
      } catch (_) {
        // The local UI still needs to return to a safe disconnected state.
      }
      if (!mounted) return;
      setState(() {
        _connected = false;
        _connectedDeviceName = null;
        _printerStatus = _PrinterStatus.disconnected;
        _operatorError =
            'Printer connection was lost while the app was in the background. Reconnect before printing.';
      });
      _logLine('Printer must reconnect after app resume.');
    }
  }

  void _logLine(String message) {
    if (!mounted) return;
    final stamp = DateTime.now().toIso8601String().substring(11, 19);
    setState(() => _log.insert(0, '[$stamp] $message'));
    // ignore: avoid_print
    print('[printer] $message');
  }

  Future<bool> _run(
    String label,
    Future<void> Function() action, {
    bool affectsPrinter = false,
  }) async {
    if (_busy) return false;
    setState(() {
      _busy = true;
      _operatorError = null;
      _failedBatchLabel = null;
      if (_printerStatus == _PrinterStatus.error) {
        _printerStatus =
            _connected ? _PrinterStatus.connected : _PrinterStatus.disconnected;
      }
    });
    _logLine('--- $label ---');
    try {
      await action();
      _logLine('$label: OK');
      return true;
    } catch (error, stack) {
      final message = '$label failed: ${_errorText(error)}';
      if (mounted) {
        setState(() {
          _operatorError = message;
          if (affectsPrinter && error is! _PrintSyncPendingException) {
            _printerStatus = _PrinterStatus.error;
          }
        });
      }
      _logLine('$label FAILED: ${_errorText(error)}');
      _logLine(stack.toString().split('\n').take(3).join(' | '));
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _connectPrinter() => _run('Connect printer', () async {
        setState(() => _printerStatus = _PrinterStatus.connecting);
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
          setState(() {
            _connected = false;
            _connectedDeviceName = null;
            _printerStatus = _PrinterStatus.error;
          });
          throw Exception('Printer not connected. ${_errorText(error)}');
        }
        _client.setOnDisconnect(() {
          _logLine('Printer disconnected.');
          if (mounted) {
            setState(() {
              _connected = false;
              _connectedDeviceName = null;
              _printerStatus = _PrinterStatus.disconnected;
            });
          }
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
        setState(() {
          _connected = true;
          _printerStatus = _PrinterStatus.connected;
        });
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

  Future<bool> _disconnectPrinter() => _run('Disconnect printer', () async {
        await _client.disconnect();
        setState(() {
          _connected = false;
          _connectedDeviceName = null;
          _printerStatus = _PrinterStatus.disconnected;
        });
      }, affectsPrinter: true);

  Future<void> _saveSession(ProductionSession session) async {
    await _sessionRepository.write(session);
    _api?.close();
    setState(() {
      _session = session;
      _api = _apiFactory(session);
      _queueSignature = '';
    });
    _startQueueRefreshTimer();
  }

  Future<void> _clearSession() async {
    if (_currentRecoveryRecords.isNotEmpty) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Change with unresolved labels?'),
          content: const Text(
            'The recovery records will stay on this iPhone, but you will need the same production share URL to return and resolve them. No labels will be reprinted automatically.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Stay and resolve'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Change production'),
            ),
          ],
        ),
      );
      if (!mounted || confirmed != true) return;
    }
    await _sessionRepository.clear();
    // Unlinking must take the roster with it. The token is the access control,
    // but the cached crew names and drinks are the actual data.
    await _boardCacheRepository.clear();
    _stopQueueRefreshTimer();
    _api?.close();
    setState(() {
      _session = null;
      _api = null;
      _queue = null;
      _lastSyncedAt = null;
      _servingCachedBoard = false;
      _queueSignature = '';
      _operatorError = null;
      _failedBatchLabel = null;
      _linkController.clear();
    });
  }

  void _startQueueRefreshTimer() {
    _stopQueueRefreshTimer();
    _queueRefreshTimer = Timer.periodic(_queueRefreshInterval, (_) {
      if (!mounted || _busy || _api == null) return;
      unawaited(_refreshBoard(silent: true));
    });
  }

  void _stopQueueRefreshTimer() {
    _queueRefreshTimer?.cancel();
    _queueRefreshTimer = null;
  }

  Future<bool> _linkProduction() => _run('Link production', () async {
        final parsed = parseProductionShareUrl(_linkController.text);
        if (parsed == null) {
          throw Exception(
            'Paste the full production share URL (must include ?token=…).',
          );
        }
        final api = _apiFactory(parsed);
        late final ProductionBoard board;
        try {
          board = await _fetchBoard(api);
        } finally {
          api.close();
        }
        if (!mounted) return;
        await _saveSession(parsed);
        await _applyBoard(board, session: parsed);
      });

  Future<ProductionBoard> _fetchBoard(CtcApi api) async {
    try {
      return await api.fetchBoard();
    } catch (error) {
      throw Exception('Board fetch failed. ${_errorText(error)}');
    }
  }

  Future<CachedBoard?> _readCachedBoard() async {
    try {
      return await _boardCacheRepository.read();
    } catch (error) {
      // A damaged cache must never block a launch. The app falls back to the
      // network exactly as it did before there was a cache.
      _logLine('Cached board unavailable: ${error.runtimeType}.');
      return null;
    }
  }

  /// Puts a board on screen, from either the server or disk.
  ///
  /// [fromCache] is not cosmetic. Cached data must not be treated as server
  /// confirmation: clearing a print-recovery record needs the server to have
  /// said `label_printed`, and a cache written before the print was recorded
  /// would wrongly retire a label that still needs syncing.
  Future<void> _applyBoard(
    ProductionBoard board, {
    bool silent = false,
    bool fromCache = false,
    DateTime? syncedAt,
    ProductionSession? session,
  }) async {
    final queue = PrinterQueue.fromBoard(board);

    if (!fromCache) {
      final serverConfirmed = queue.labels
          .where((label) => label.labelPrinted)
          .map((label) => label.orderId);
      await _printRecoveryLedger?.clearServerConfirmed(serverConfirmed);
    }
    if (!mounted) return;

    final nextSignature = _signatureForQueue(queue);
    final changed = nextSignature != _queueSignature;
    final pendingCount =
        queue.labels.where((label) => !label.labelPrinted).length;
    final stamp = syncedAt ?? DateTime.now();

    setState(() {
      _queue = queue;
      _queueSignature = nextSignature;
      _lastSyncedAt = stamp;
      _servingCachedBoard = fromCache;
    });

    if (!fromCache) {
      await _writeCachedBoard(board, session: session, syncedAt: stamp);
    }

    if (!silent || changed) {
      _logLine(
        'Queue: ${queue.labels.length} labels, $pendingCount to print for '
        '${queue.productionName}${fromCache ? ' (cached)' : ''}.',
      );
    }
  }

  Future<void> _writeCachedBoard(
    ProductionBoard board, {
    ProductionSession? session,
    required DateTime syncedAt,
  }) async {
    final target = session ?? _session;
    if (target == null) return;
    try {
      await _boardCacheRepository.write(CachedBoard(
        apiBase: target.apiBase,
        productionId: target.productionId,
        syncedAt: syncedAt,
        board: board,
      ));
    } catch (error) {
      // Failing to cache degrades the next cold start; it must not fail the
      // refresh that just succeeded.
      _logLine('Could not cache the board: ${error.runtimeType}.');
    }
  }

  Future<void> _refreshBoard({bool silent = false}) async {
    final api = _api;
    if (api == null) {
      if (!silent) {
        setState(() {
          _operatorError =
              'Production not linked. Paste a production share URL first.';
        });
      }
      return;
    }

    Future<void> action() async {
      final board = await _fetchBoard(api);
      if (!mounted) return;
      await _applyBoard(board, silent: silent);
    }

    if (silent) {
      try {
        await action();
      } catch (error) {
        final message = _errorText(error);
        setState(() {
          _operatorError = message;
          // A failed refresh over an existing board means what is on screen is
          // now stale, whether it came from disk or from an earlier fetch.
          if (_queue != null) _servingCachedBoard = true;
        });
        _logLine(message);
      }
      return;
    }

    await _run('Refresh board', action);
  }

  String _signatureForQueue(PrinterQueue queue) => queue.labels
      .map((label) =>
          '${label.orderId}|${label.drink}|${label.status}|${label.labelPrinted}')
      .join('\n');

  String _timeLabel(DateTime value) {
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    final second = value.second.toString().padLeft(2, '0');
    return '$hour:$minute:$second';
  }

  /// How old the board on screen is, in words an operator can act on.
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

  /// The line under the queue metrics. Never says "synced" about stale data.
  String get _syncStatusLabel {
    final syncedAt = _lastSyncedAt;
    if (syncedAt == null) return 'Not synced yet';
    if (_servingCachedBoard) return 'Offline · synced ${_ageLabel(syncedAt)}';
    return 'Synced ${_timeLabel(syncedAt)}';
  }

  /// A board older than this is called out loudly rather than in small print.
  static const _staleBoardThreshold = Duration(minutes: 10);

  bool get _boardIsStale {
    final syncedAt = _lastSyncedAt;
    if (syncedAt == null || !_servingCachedBoard) return false;
    return DateTime.now().difference(syncedAt) >= _staleBoardThreshold;
  }

  String _errorText(Object error) {
    final text = error.toString();
    if (text.startsWith('Exception: ')) {
      return text.substring('Exception: '.length);
    }
    return text;
  }

  Future<void> _openExternalPage(Uri uri) async {
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      setState(() {
        _operatorError =
            'Could not open $uri. Check your connection and try again.';
      });
    }
  }

  Future<void> _showAppInformation() async {
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Capture This'),
        content: const Text(
          'Version $kAppVersion\n\nCoffee-label companion for Capture This production crews. Production access requires a share URL.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _openExternalPage(_privacyUri);
            },
            child: const Text('Privacy'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _openExternalPage(_supportUri);
            },
            child: const Text('Support'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              showLicensePage(
                context: this.context,
                applicationName: 'Capture This',
                applicationVersion: kAppVersion,
              );
            },
            child: const Text('Licenses'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Future<void> _showQuickStart() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: FractionallySizedBox(
          heightFactor: 0.9,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            children: [
              Text(
                'How to use Capture This',
                style: Theme.of(sheetContext).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              const Text(
                'The production board is the source of truth. Capture This prints its captured drink orders and syncs every successful label.',
              ),
              const SizedBox(height: 20),
              const _HelpStep(
                number: '1',
                title: 'Link an active production',
                body:
                    'Paste the complete private production link from the coordinator. Printing stays paused until the production is Active.',
              ),
              const _HelpStep(
                number: '2',
                title: 'Prepare the M2_H',
                body:
                    'Load the accepted ribbon and label stock. Force-quit the official NIIMBOT app on nearby devices and power off other NIIMBOT printers.',
              ),
              const _HelpStep(
                number: '3',
                title: 'Connect and review',
                body:
                    'Tap Connect printer, refresh the queue, and double-check the person and drink before printing.',
              ),
              const _HelpStep(
                number: '4',
                title: 'Print and wait for sync',
                body:
                    'Use Print, Print next, or Print all pending. Wait for the printed status to synchronize before moving on.',
              ),
              const _HelpStep(
                number: '5',
                title: 'Recover without duplicates',
                body:
                    'If a usable label came out, choose “Label printed — sync only.” If nothing printed, choose “Nothing printed — retry.” If you cannot tell, stop and ask the coordinator.',
              ),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Rules that prevent mistakes',
                        style: Theme.of(sheetContext)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                          '• Never share or screenshot the production link.'),
                      const Text('• Never update printer firmware on set.'),
                      const Text(
                          '• Never reprint when the app says Sync only.'),
                      const Text(
                          '• Keep internet access available while printing.'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _openExternalPage(_supportUri);
                },
                icon: const Icon(Icons.support_agent),
                label: const Text('Open support'),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _showAppInformation();
                },
                child: const Text('About, privacy, and licenses'),
              ),
              const Center(
                child: Text(
                  'Capture This $kAppVersion',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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

  Future<bool> _printLabel(QueueLabel item) => _run(
        item.labelPrinted
            ? 'Reprint ${item.personName}'
            : 'Print ${item.personName}',
        () => _printOneLabel(item),
        affectsPrinter: true,
      );

  Future<void> _confirmAndPrintAllPending() async {
    final pending = _pendingLabels;
    if (pending.isEmpty) {
      await _run('Print all pending', () async {
        throw Exception('No pending labels to print.');
      });
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Print all pending?'),
        content: Text(
          'This will print ${pending.length} labels. The batch will stop if any label fails.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.of(context).pop(true),
            icon: const Icon(Icons.print),
            label: const Text('Print all'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;

    await _run('Print all pending', () async {
      for (final item in pending) {
        try {
          await _printOneLabel(item);
        } catch (_) {
          setState(() => _failedBatchLabel = _labelTitle(item));
          rethrow;
        }
      }
    }, affectsPrinter: true);
  }

  Future<void> _printOneLabel(QueueLabel item) async {
    if (_queue?.isProductionActive != true) {
      throw Exception(
        'Printing is paused until the coordinator marks this production Active. Refresh after its status changes.',
      );
    }
    if (!_connected) {
      throw Exception('Printer not connected. Tap Connect printer first.');
    }
    final api = _api;
    final queue = _queue;
    if (api == null || queue == null) {
      throw Exception(
        'Production not linked. Paste a production share URL first.',
      );
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

    setState(() => _printerStatus = _PrinterStatus.printing);

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
          productionName: queue.productionName,
          clientName: queue.clientName,
        ),
      );
    } catch (error) {
      setState(() => _printerStatus = _PrinterStatus.error);
      throw Exception(
        'Could not render the label for ${item.personName}. ${_errorText(error)}',
      );
    }

    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      setState(() => _printerStatus = _PrinterStatus.error);
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
      setState(() => _printerStatus = _PrinterStatus.error);
      throw Exception(
        'The print outcome for ${item.personName} is uncertain. Check the physical printer, then choose “Label printed — sync only” or “Nothing printed — retry.” ${_errorText(error)}',
      );
    }

    await _recordPrintRecovery(item, PrintRecoveryState.printedNeedsSync);
    // Paper is out. The thump lands with the printer's own, so a print is
    // confirmed in the hand as well as on the screen — which matters on a set
    // loud enough that neither is audible.
    unawaited(HapticFeedback.heavyImpact());
    setState(() {
      _printerStatus = _PrinterStatus.connected;
      _printSuccessToken += 1;
    });

    _logLine('Marking label_printed…');
    try {
      await api.markLabelPrinted(item.orderId);
    } catch (error) {
      throw _PrintSyncPendingException(
        'Printed ${item.personName}, but the web app did not sync. Do not reprint. Tap “Sync only” on this label. ${_errorText(error)}',
      );
    }

    await _printRecoveryLedger?.clear(item.orderId);
    await _refreshBoard(silent: true);
  }

  /// Two beats, not one. An uncertain print is the state the operator must not
  /// mistake for success, so it must not feel like success either.
  Future<void> _hapticUncertain() async {
    await HapticFeedback.heavyImpact();
    await Future<void>.delayed(const Duration(milliseconds: 140));
    await HapticFeedback.heavyImpact();
  }

  Future<void> _recordPrintRecovery(
    QueueLabel item,
    PrintRecoveryState state,
  ) async {
    final session = _session;
    final ledger = _printRecoveryLedger;
    if (session == null || ledger == null) {
      throw StateError('Print recovery storage is unavailable.');
    }
    try {
      await ledger.record(PrintRecoveryRecord(
        apiBase: session.apiBase,
        productionId: session.productionId,
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
      if (mounted) setState(() {});
    }
  }

  Future<void> _disconnectAfterAmbiguousPrint() async {
    try {
      await _client.disconnect();
    } catch (_) {
      // The UI must require a clean reconnect even if teardown also fails.
    }
    if (!mounted) return;
    setState(() {
      _connected = false;
      _connectedDeviceName = null;
      _printerStatus = _PrinterStatus.error;
    });
  }

  Future<bool> _syncPrintedLabel(QueueLabel item) => _run(
        'Sync ${item.personName}',
        () async {
          final api = _api;
          final recovery = _printRecoveryLedger?[item.orderId];
          if (api == null || recovery == null) {
            throw Exception('No pending printed-status sync for this label.');
          }
          if (recovery.state == PrintRecoveryState.uncertain) {
            throw Exception(
                'Confirm whether the physical label printed first.');
          }
          await api.markLabelPrinted(item.orderId);
          await _printRecoveryLedger?.clear(item.orderId);
          if (mounted) setState(() {});
          await _refreshBoard(silent: true);
        },
      );

  Future<void> _confirmUncertainLabelPrinted(QueueLabel item) async {
    await _printRecoveryLedger?.markPhysicalPrintConfirmed(item.orderId);
    if (mounted) setState(() {});
    await _syncPrintedLabel(item);
  }

  Future<void> _confirmUncertainLabelNotPrinted(QueueLabel item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Retry this physical label?'),
        content: Text(
          'Only continue if no usable ${item.personName} label came out of the printer. This will start a new physical print.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Nothing printed — retry'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    await _printRecoveryLedger?.clear(item.orderId);
    setState(() {});
    await _printLabel(item);
  }

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

  List<QueueLabel> get _pendingLabels {
    final labels = _queue?.labels ?? [];
    return labels
        .where(
          (label) =>
              !label.labelPrinted &&
              _printRecoveryLedger?[label.orderId] == null,
        )
        .toList();
  }

  List<PrintRecoveryRecord> get _currentRecoveryRecords {
    final session = _session;
    final ledger = _printRecoveryLedger;
    if (session == null || ledger == null) return const [];
    return ledger.forSession(session);
  }

  List<QueueLabel> get _visibleLabels {
    final labels = _queue?.labels ?? [];
    final knownOrderIds = labels.map((label) => label.orderId).toSet();
    final recoveryOnlyLabels = _currentRecoveryRecords
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
      RosterFilter.toPrint =>
        combined.where((label) => !label.labelPrinted),
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

  String _labelTitle(QueueLabel item) {
    final drink = item.drink.trim();
    if (drink.isEmpty) return item.personName;
    return '${item.personName} - $drink';
  }

  Future<void> _confirmReprint(QueueLabel item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Reprint ${item.personName}?'),
        content: const Text(
          'The web app already records this label as printed. Continue only if you intentionally need a duplicate physical label.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Reprint label'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    await _printLabel(item);
  }

  /// Why printing is unavailable, in the order the operator must resolve it.
  ///
  /// Ordering matters: a disconnected printer is the most common and most
  /// fixable cause, so it is reported before a paused production. Recovery
  /// outranks neither — it only blocks once the queue's own top item is the one
  /// awaiting a physical check.
  DeckBlock get _deckBlock {
    if (!_connected) return DeckBlock.disconnected;
    if (_queue?.isProductionActive != true) return DeckBlock.productionInactive;
    if (_pendingLabels.isEmpty && _currentRecoveryRecords.isNotEmpty) {
      return DeckBlock.recoveryPending;
    }
    return DeckBlock.none;
  }

  /// The label the deck is showing — the first pending one.
  QueueLabel? get _deckLabel =>
      _pendingLabels.isEmpty ? null : _pendingLabels.first;

  LabelContent? get _deckContent {
    final item = _deckLabel;
    final queue = _queue;
    if (item == null || queue == null) return null;
    return LabelContent.fromQueue(
      orderId: item.orderId,
      personName: item.personName,
      drink: item.drink,
      group: item.group,
      productionName: queue.productionName,
      clientName: queue.clientName,
    );
  }

  Widget _buildPrintDeck(BuildContext context) {
    final queue = _queue;
    final pending = _pendingLabels;
    final printed =
        queue?.labels.where((label) => label.labelPrinted).length ?? 0;

    return PrintDeck(
      productionName: queue?.productionName ?? 'Production loading',
      statusLabel: queue == null || queue.isProductionActive
          ? null
          : 'Production ${queue.productionStatus}',
      content: _deckContent,
      nextUpName: pending.length > 1 ? pending[1].personName : null,
      pending: pending.length,
      printed: printed,
      total: queue?.labels.length ?? 0,
      syncLabel: _syncStatusLabel,
      staleNotice: _boardIsStale ? _buildStaleBoardNotice(context) : null,
      busy: _busy,
      connected: _connected,
      printing: _printerStatus == _PrinterStatus.printing,
      printSuccessToken: _printSuccessToken,
      block: _deckBlock,
      onPrint: () {
        final item = _deckLabel;
        if (item != null) _printLabel(item);
      },
      onPrintAll: _confirmAndPrintAllPending,
      onConnect: _connectPrinter,
      onDisconnect: _disconnectPrinter,
      onRefresh: () => _refreshBoard(),
    );
  }

  Widget _buildLinkScreen() {
    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'Coffee label printer'),
        actions: [
          IconButton(
            onPressed: _showQuickStart,
            icon: const Icon(Icons.help_outline),
            tooltip: 'How to use Capture This',
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const SizedBox(height: 12),
            const Center(child: BrandMark(size: 104)),
            const SizedBox(height: 18),
            Text(
              'Coffee, ready for set.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 6),
            const Text(
              'Link today’s production to load the label queue and print over Bluetooth.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            TextField(
              controller: _linkController,
              decoration: const InputDecoration(
                labelText: 'Production share URL',
                hintText: 'https://…/run/…?token=…',
                prefixIcon: Icon(Icons.link),
              ),
              keyboardType: TextInputType.url,
              autocorrect: false,
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _busy ? null : () => _linkProduction(),
              icon: const Icon(Icons.link),
              label: const Text('Link production'),
            ),
            if (_operatorError != null) ...[
              const SizedBox(height: 12),
              _buildOperatorErrorBanner(),
            ],
          ],
        ),
      ),
    );
  }

  /// Loud, not small print.
  ///
  /// The dangerous case is not an empty app — that is obvious. It is a full,
  /// normal-looking roster that silently predates someone changing their order.
  Widget _buildStaleBoardNotice(BuildContext context) {
    final theme = Theme.of(context);
    final syncedAt = _lastSyncedAt;

    return DecoratedBox(
      decoration: BoxDecoration(
        // The one full-strength yellow on this screen. Once the print deck
        // lands and the print action becomes yellow, this drops to a hairline
        // surface so the two never compete.
        color: CaptureColors.yellow,
        border: Border.all(color: CaptureColors.ink, width: 1),
        borderRadius: CaptureRadii.cardBorder,
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.cloud_off, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Working offline',
                    style: theme.textTheme.titleSmall,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    syncedAt == null
                        ? 'This roster has not been synced.'
                        : 'This roster is from ${_ageLabel(syncedAt)}. Orders '
                            'captured since then are not shown. Printing still '
                            'works.',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPrintRecoveryCard() {
    final recoveries = _currentRecoveryRecords;
    if (recoveries.isEmpty) return const SizedBox.shrink();
    final syncCount = recoveries
        .where(
          (record) => record.state == PrintRecoveryState.printedNeedsSync,
        )
        .length;
    final uncertainCount = recoveries.length - syncCount;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.report_problem, color: Colors.deepOrange),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Resolve print status before continuing',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        '$syncCount printed ${syncCount == 1 ? 'label needs' : 'labels need'} sync. '
                        '$uncertainCount ${uncertainCount == 1 ? 'label needs' : 'labels need'} a physical check. '
                        'These labels are excluded from Print next and Print all.',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInactiveProductionCard() {
    final queue = _queue;
    if (queue == null || queue.isProductionActive) {
      return const SizedBox.shrink();
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.pause_circle, color: Colors.deepOrange),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Printing paused',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    'This production is ${queue.productionStatus}. Ask the coordinator to mark it Active, then refresh the queue.',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOperatorErrorBanner() {
    final message = _operatorError;
    if (message == null && _failedBatchLabel == null) {
      return const SizedBox.shrink();
    }

    return Material(
      color: Theme.of(context).colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.warning_amber),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_failedBatchLabel != null)
                    Text(
                      'Batch stopped at: $_failedBatchLabel',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  if (message != null) Text(message),
                ],
              ),
            ),
            IconButton(
              onPressed: () => setState(() {
                _operatorError = null;
                _failedBatchLabel = null;
                if (_printerStatus == _PrinterStatus.error) {
                  _printerStatus = _connected
                      ? _PrinterStatus.connected
                      : _PrinterStatus.disconnected;
                }
              }),
              icon: const Icon(Icons.close),
              tooltip: 'Dismiss error',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRosterSection(BuildContext context) {
    return RosterSection(
      labels: _visibleLabels,
      filter: _rosterFilter,
      onFilterChanged: (value) => setState(() => _rosterFilter = value),
      searchController: _rosterSearchController,
      onQueryChanged: (value) => setState(() => _rosterQuery = value),
      query: _rosterQuery,
      queueLoaded: _queue != null,
      busy: _busy,
      tileBuilder: _buildLabelTile,
    );
  }

  /// A roster row.
  ///
  /// Ordinary rows are deliberately small — a forty-person call sheet is the
  /// normal case, and the previous card-per-person layout fit three on screen.
  /// Rows that need a decision keep the full explanation and both buttons,
  /// because those are rare and getting them wrong reprints a physical label.
  Widget _buildLabelTile(
    BuildContext context,
    QueueLabel item,
    bool isLast,
  ) {
    final recovery = _printRecoveryLedger?[item.orderId];
    final needsSync = recovery?.state == PrintRecoveryState.printedNeedsSync;
    final isUncertain = recovery?.state == PrintRecoveryState.uncertain;

    if (needsSync || isUncertain) {
      return _buildAttentionTile(context, item, isUncertain: isUncertain);
    }
    return _buildCompactTile(context, item, isLast);
  }

  Widget _buildCompactTile(BuildContext context, QueueLabel item, bool isLast) {
    final theme = Theme.of(context);
    final isPrinted = item.labelPrinted;
    final canPrint = !_busy && _queue?.isProductionActive == true;
    final group = item.group.trim();

    // `status` is deliberately not shown. It carries the legacy OrderStatus
    // enum (`confirmed`, `ordered`, …) and the product exposes only
    // needs-order / captured / no-drink — printing "confirmed" next to a
    // person's name leaks a database detail as if it meant something.
    final secondary =
        [item.drink.trim(), group].where((part) => part.isNotEmpty).join(' · ');

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isLast ? Colors.transparent : CaptureColors.ruleSoft,
            width: 1,
          ),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            // A checklist mark, not a colour code: filled once the label
            // exists. No yellow here — the deck's print action owns that.
            Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isPrinted ? CaptureColors.ink : Colors.transparent,
                border: Border.all(
                  color: isPrinted ? CaptureColors.ink : CaptureColors.rule,
                  width: 1.5,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.personName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleSmall?.copyWith(
                      color: isPrinted ? CaptureColors.faint : null,
                      decoration:
                          isPrinted ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  if (secondary.isNotEmpty)
                    Text(
                      secondary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall,
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              onPressed: canPrint
                  ? () => isPrinted ? _confirmReprint(item) : _printLabel(item)
                  : null,
              icon: Icon(isPrinted ? Icons.replay : Icons.print),
              tooltip: isPrinted
                  ? 'Reprint ${item.personName}'
                  : 'Print ${item.personName}',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttentionTile(
    BuildContext context,
    QueueLabel item, {
    required bool isUncertain,
  }) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: CaptureColors.ink, width: 1),
          borderRadius: CaptureRadii.controlBorder,
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      item.personName,
                      style: theme.textTheme.titleMedium,
                    ),
                  ),
                  Chip(
                    visualDensity: VisualDensity.compact,
                    avatar: Icon(
                      isUncertain ? Icons.help : Icons.cloud_upload,
                      size: 16,
                    ),
                    label: Text(isUncertain ? 'Check printer' : 'Sync only'),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(item.drink, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 8),
              Text(
                isUncertain
                    ? 'A Bluetooth error occurred after printing started. Check whether a usable label came out before choosing an action.'
                    : 'The physical label printed, but the web status did not sync. Do not print it again.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: CaptureColors.ink,
                ),
              ),
              const SizedBox(height: 12),
              if (isUncertain) ...[
                FilledButton.icon(
                  onPressed:
                      _busy ? null : () => _confirmUncertainLabelPrinted(item),
                  icon: const Icon(Icons.cloud_upload),
                  label: const Text('Label printed — sync only'),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _busy
                      ? null
                      : () => _confirmUncertainLabelNotPrinted(item),
                  icon: const Icon(Icons.replay),
                  label: const Text('Nothing printed — retry'),
                ),
              ] else
                FilledButton.icon(
                  onPressed: _busy ? null : () => _syncPrintedLabel(item),
                  icon: const Icon(Icons.cloud_upload),
                  label: const Text('Sync only'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActivityLog(BuildContext context) {
    final theme = Theme.of(context);
    final entries = _log.take(10).toList();

    // Diagnostics, not furniture. This was permanently expanded at the bottom
    // of the primary work surface; it is still one tap away when a print goes
    // wrong, which is the only time anyone reads it.
    return Card(
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          title: Text('Recent activity', style: theme.textTheme.titleMedium),
          subtitle: Text(
            entries.isEmpty ? 'No activity yet' : '${entries.length} recent',
            style: theme.textTheme.bodySmall,
          ),
          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final entry in entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(
                  entry,
                  style: const TextStyle(
                    fontFamily: 'Menlo',
                    fontSize: 12,
                    height: 1.4,
                    color: CaptureColors.muted,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingSession) {
      return const Scaffold(
        body: Center(
          child: BrandPulse(size: 76, semanticLabel: 'Opening Capture This'),
        ),
      );
    }

    if (_session == null) {
      return _buildLinkScreen();
    }

    return Scaffold(
      appBar: AppBar(
        title: const BrandAppBarTitle(detail: 'On-set controller'),
        actions: [
          IconButton(
            onPressed: _busy ? null : () => _refreshBoard(),
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh queue',
          ),
          IconButton(
            onPressed: _busy ? null : _clearSession,
            icon: const Icon(Icons.link_off),
            tooltip: 'Change production',
          ),
          IconButton(
            onPressed: _showQuickStart,
            icon: const Icon(Icons.help_outline),
            tooltip: 'How to use Capture This',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (_busy) const LinearProgressIndicator(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async {
                  if (!_busy) await _refreshBoard();
                },
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _buildPrintDeck(context),
                    if (_operatorError != null || _failedBatchLabel != null)
                      _buildOperatorErrorBanner(),
                    _buildInactiveProductionCard(),
                    _buildPrintRecoveryCard(),
                    _buildRosterSection(context),
                    _buildActivityLog(context),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
