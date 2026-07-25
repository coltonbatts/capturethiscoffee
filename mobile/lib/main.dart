// Capture This Coffee — NIIMBOT M2_H direct BLE printer app.
//
// Load a production share link, render label PNGs on device, print over BLE,
// and mark label_printed via the public order PATCH route.
//
// Labels are rendered locally by label_painter.dart rather than downloaded, so
// printing does not require a signal. The queue fetch still does; caching it is
// Phase B of docs/offline-first-ios-handoff.md.

import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:niim_blue_flutter/niim_blue_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'ctc_api.dart';
import 'label_content.dart';
import 'label_painter.dart';
import 'print_recovery.dart';
import 'printer_validation.dart';
import 'production_session.dart';
import 'session_store.dart';

// M2_H @ 300 DPI. The library metadata reports a 567-dot printhead for model
// 4608, while the server PNG is 591x354 with safe margins for 50x30mm stock.
const int kPrintheadWidth = 567;
const int kDensity = 3;
const int kLabelType = 1;
const int kMinimumTextSideInkPixels = 300;
const String kAppVersion = '1.0.0 (6)';
const _printerScanTimeout = Duration(seconds: 8);
const _printOperationTimeout = Duration(seconds: 60);

const _captureYellow = Color(0xFFF2EB0C);
const _capturePaper = Color(0xFFF7F3EA);
const _captureInk = Color(0xFF050505);

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
    this.apiFactory,
  });

  final SessionRepository? sessionRepository;
  final PrintRecoveryRepository? printRecoveryRepository;
  final CtcApiFactory? apiFactory;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Capture This Coffee',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: _capturePaper,
        colorScheme: const ColorScheme.light(
          primary: _captureInk,
          onPrimary: Colors.white,
          secondary: _captureYellow,
          onSecondary: _captureInk,
          surface: Colors.white,
          onSurface: _captureInk,
          outline: Color(0xFF5B5B55),
          outlineVariant: Color(0xFFB8B5AA),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: _captureInk,
          foregroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          titleSpacing: 0,
          titleTextStyle: TextStyle(
            color: Colors.white,
            fontSize: 17,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.3,
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            side: const BorderSide(color: _captureInk, width: 1.5),
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size(44, 48),
            backgroundColor: _captureInk,
            foregroundColor: Colors.white,
            disabledBackgroundColor: const Color(0xFFD4D1C8),
            disabledForegroundColor: const Color(0xFF77746D),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(44, 48),
            foregroundColor: _captureInk,
            side: const BorderSide(color: _captureInk, width: 1.5),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          labelStyle: const TextStyle(
            color: _captureInk,
            fontWeight: FontWeight.w700,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          focusedBorder: OutlineInputBorder(
            borderSide: const BorderSide(color: _captureInk, width: 2.5),
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        chipTheme: ChipThemeData(
          backgroundColor: _captureYellow.withValues(alpha: 0.28),
          side: const BorderSide(color: _captureInk),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          labelStyle: const TextStyle(
            color: _captureInk,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      home: PrinterHome(
        sessionRepository: sessionRepository,
        printRecoveryRepository: printRecoveryRepository,
        apiFactory: apiFactory,
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark({this.size = 36});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Capture This',
      image: true,
      child: Image.asset(
        'assets/capture-this-smiley.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
        excludeFromSemantics: true,
      ),
    );
  }
}

class _BrandAppBarTitle extends StatelessWidget {
  const _BrandAppBarTitle({required this.detail});

  final String detail;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const _BrandMark(),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Capture This'),
              Text(
                detail.toUpperCase(),
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _captureYellow,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
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
              color: _captureYellow,
              shape: BoxShape.circle,
            ),
            child: SizedBox(
              width: 36,
              height: 36,
              child: Center(
                child: Text(
                  number,
                  style: const TextStyle(fontWeight: FontWeight.w900),
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
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
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
    this.apiFactory,
  });

  final SessionRepository? sessionRepository;
  final PrintRecoveryRepository? printRecoveryRepository;
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

  ProductionSession? _session;
  CtcApi? _api;
  late final SessionRepository _sessionRepository;
  late final PrintRecoveryRepository _printRecoveryRepository;
  late final CtcApiFactory _apiFactory;
  PrintRecoveryLedger? _printRecoveryLedger;
  PrinterQueue? _queue;
  Timer? _queueRefreshTimer;
  DateTime? _lastQueueRefreshAt;
  String _queueSignature = '';
  bool _showPrinted = false;
  bool _connected = false;
  bool _busy = false;
  bool _loadingSession = true;
  _PrinterStatus _printerStatus = _PrinterStatus.disconnected;
  String? _operatorError;
  String? _lastPrintedLabel;
  String? _failedBatchLabel;
  String? _connectedDeviceName;

  @override
  void initState() {
    super.initState();
    _sessionRepository =
        widget.sessionRepository ?? KeychainSessionRepository();
    _printRecoveryRepository =
        widget.printRecoveryRepository ?? PreferencesPrintRecoveryRepository();
    _apiFactory = widget.apiFactory ?? (session) => CtcApi(session);
    WidgetsBinding.instance.addObserver(this);
    _restoreSession();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopQueueRefreshTimer();
    _linkController.dispose();
    _api?.close();
    _client.disconnect();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (_session != null) {
        _startQueueRefreshTimer();
        unawaited(_refreshQueue(silent: true));
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
      ]);
      final saved = results[0] as ProductionSession?;
      final ledger = results[1] as PrintRecoveryLedger;
      if (!mounted) return;
      setState(() {
        _session = saved;
        _api = saved == null ? null : _apiFactory(saved);
        _printRecoveryLedger = ledger;
        _loadingSession = false;
      });
      if (saved != null) {
        _startQueueRefreshTimer();
        await _refreshQueue(silent: true);
      }
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
    _stopQueueRefreshTimer();
    _api?.close();
    setState(() {
      _session = null;
      _api = null;
      _queue = null;
      _lastQueueRefreshAt = null;
      _queueSignature = '';
      _operatorError = null;
      _failedBatchLabel = null;
      _lastPrintedLabel = null;
      _linkController.clear();
    });
  }

  void _startQueueRefreshTimer() {
    _stopQueueRefreshTimer();
    _queueRefreshTimer = Timer.periodic(_queueRefreshInterval, (_) {
      if (!mounted || _busy || _api == null) return;
      unawaited(_refreshQueue(silent: true));
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
        late final PrinterQueue queue;
        try {
          queue = await _fetchQueue(api);
        } finally {
          api.close();
        }
        if (!mounted) return;
        await _saveSession(parsed);
        await _applyQueue(queue);
      });

  Future<PrinterQueue> _fetchQueue(CtcApi api) async {
    try {
      return await api.fetchQueue();
    } catch (error) {
      throw Exception('Queue fetch failed. ${_errorText(error)}');
    }
  }

  Future<void> _applyQueue(PrinterQueue queue, {bool silent = false}) async {
    final serverConfirmed = queue.labels
        .where((label) => label.labelPrinted)
        .map((label) => label.orderId);
    await _printRecoveryLedger?.clearServerConfirmed(serverConfirmed);
    if (!mounted) return;
    final nextSignature = _signatureForQueue(queue);
    final changed = nextSignature != _queueSignature;
    final pendingCount =
        queue.labels.where((label) => !label.labelPrinted).length;

    setState(() {
      _queue = queue;
      _queueSignature = nextSignature;
      _lastQueueRefreshAt = DateTime.now();
    });

    if (!silent || changed) {
      _logLine(
        'Queue: ${queue.labels.length} labels, $pendingCount to print for ${queue.productionName}.',
      );
    }
  }

  Future<void> _refreshQueue({bool silent = false}) async {
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
      final queue = await _fetchQueue(api);
      if (!mounted) return;
      await _applyQueue(queue, silent: silent);
    }

    if (silent) {
      try {
        await action();
      } catch (error) {
        final message = _errorText(error);
        setState(() => _operatorError = message);
        _logLine(message);
      }
      return;
    }

    await _run('Refresh queue', action);
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
                style: Theme.of(sheetContext).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
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

  Future<bool> _printNextPending() => _run('Print next', () async {
        final pending = _pendingLabels;
        if (pending.isEmpty) {
          throw Exception('No pending labels to print.');
        }
        await _printOneLabel(pending.first);
      }, affectsPrinter: true);

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
      setState(() => _printerStatus = _PrinterStatus.error);
      throw Exception(
        'The print outcome for ${item.personName} is uncertain. Check the physical printer, then choose “Label printed — sync only” or “Nothing printed — retry.” ${_errorText(error)}',
      );
    }

    await _recordPrintRecovery(item, PrintRecoveryState.printedNeedsSync);
    setState(() {
      _lastPrintedLabel = _labelTitle(item);
      _printerStatus = _PrinterStatus.connected;
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
    await _refreshQueue(silent: true);
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
          await _refreshQueue(silent: true);
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
    if (_showPrinted) return combined;
    return combined.where((label) => !label.labelPrinted).toList();
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

  String get _printerStatusLabel {
    switch (_printerStatus) {
      case _PrinterStatus.disconnected:
        return 'Disconnected';
      case _PrinterStatus.connecting:
        return 'Connecting';
      case _PrinterStatus.connected:
        return 'Connected';
      case _PrinterStatus.printing:
        return 'Printing';
      case _PrinterStatus.error:
        return 'Error';
    }
  }

  String get _printerStatusDetail {
    switch (_printerStatus) {
      case _PrinterStatus.disconnected:
        return 'Connect the NIIMBOT before printing.';
      case _PrinterStatus.connecting:
        return 'Scanning for the first NIIMBOT printer.';
      case _PrinterStatus.connected:
        return 'Ready for labels.';
      case _PrinterStatus.printing:
        return 'Do not close the app or power off the printer.';
      case _PrinterStatus.error:
        return _operatorError ?? 'Check the message below and try again.';
    }
  }

  IconData get _printerStatusIcon {
    switch (_printerStatus) {
      case _PrinterStatus.disconnected:
        return Icons.bluetooth_disabled;
      case _PrinterStatus.connecting:
        return Icons.bluetooth_searching;
      case _PrinterStatus.connected:
        return Icons.bluetooth_connected;
      case _PrinterStatus.printing:
        return Icons.print;
      case _PrinterStatus.error:
        return Icons.error;
    }
  }

  Color _printerStatusColor(ColorScheme colors) {
    switch (_printerStatus) {
      case _PrinterStatus.disconnected:
        return colors.outline;
      case _PrinterStatus.connecting:
        return colors.tertiary;
      case _PrinterStatus.connected:
      case _PrinterStatus.printing:
        return colors.primary;
      case _PrinterStatus.error:
        return colors.error;
    }
  }

  Widget _buildLinkScreen() {
    return Scaffold(
      appBar: AppBar(
        title: const _BrandAppBarTitle(detail: 'Coffee label printer'),
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
            const Center(child: _BrandMark(size: 104)),
            const SizedBox(height: 18),
            Text(
              'Coffee, ready for set.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.7,
                  ),
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

  Widget _buildPrinterStatusCard(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final statusColor = _printerStatusColor(colors);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(_printerStatusIcon, color: statusColor, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _printerStatusLabel,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: statusColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(_printerStatusDetail),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              _lastPrintedLabel == null
                  ? 'Last printed: none yet'
                  : 'Last printed: $_lastPrintedLabel',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed:
                        _busy || _connected ? null : () => _connectPrinter(),
                    icon: const Icon(Icons.bluetooth_searching),
                    label: const Text('Connect printer'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy || !_connected
                        ? null
                        : () => _disconnectPrinter(),
                    icon: const Icon(Icons.close),
                    label: const Text('Disconnect'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQueueSummaryCard(BuildContext context) {
    final theme = Theme.of(context);
    final queue = _queue;
    final total = queue?.labels.length ?? 0;
    final pending = _pendingLabels.length;
    final printed =
        queue?.labels.where((label) => label.labelPrinted).length ?? 0;
    final attention = _currentRecoveryRecords.length;
    final refreshed = _lastQueueRefreshAt == null
        ? 'Not refreshed yet'
        : _timeLabel(_lastQueueRefreshAt!);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              queue?.productionName ?? 'Production loading',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            if (queue != null) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: Chip(
                  avatar: Icon(
                    queue.isProductionActive
                        ? Icons.check_circle
                        : Icons.pause_circle,
                    size: 16,
                  ),
                  label: Text(
                    queue.isProductionActive
                        ? 'Production active'
                        : 'Production ${queue.productionStatus}',
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                _buildMetric(context, 'Pending', pending.toString()),
                const SizedBox(width: 8),
                _buildMetric(context, 'Printed', printed.toString()),
                const SizedBox(width: 8),
                _buildMetric(context, 'Attention', attention.toString()),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text('Total: $total · Last refresh: $refreshed'),
                ),
                IconButton(
                  onPressed: _busy ? null : () => _refreshQueue(),
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh queue',
                ),
              ],
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Show printed labels'),
              subtitle: const Text('Keep reprints available when needed.'),
              value: _showPrinted,
              onChanged: _busy
                  ? null
                  : (value) => setState(() => _showPrinted = value),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetric(BuildContext context, String label, String value) {
    final theme = Theme.of(context);

    return Expanded(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: _captureYellow.withValues(alpha: 0.18),
          border: Border.all(color: _captureInk),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
          child: Column(
            children: [
              Text(
                value,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(label),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBatchActionsCard() {
    final pending = _pendingLabels.length;
    final canPrint = _queue?.isProductionActive == true;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FilledButton.icon(
              onPressed: _busy || pending == 0 || !canPrint
                  ? null
                  : () => _printNextPending(),
              icon: const Icon(Icons.skip_next),
              label: const Text('Print next'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _busy || pending == 0 || !canPrint
                  ? null
                  : () => _confirmAndPrintAllPending(),
              icon: const Icon(Icons.playlist_play),
              label: Text('Print all pending ($pending)'),
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
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
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
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
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

  Widget _buildLabelsSection(BuildContext context) {
    final visible = _visibleLabels;
    final queue = _queue;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
              child: Text(
                _showPrinted ? 'All labels' : 'Pending labels',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
            if (visible.isEmpty)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  queue == null
                      ? 'Tap refresh to load labels.'
                      : _showPrinted
                          ? 'No labels on this production.'
                          : 'All labels printed.',
                  textAlign: TextAlign.center,
                ),
              )
            else
              for (final item in visible) _buildLabelTile(context, item),
          ],
        ),
      ),
    );
  }

  Widget _buildLabelTile(BuildContext context, QueueLabel item) {
    final theme = Theme.of(context);
    final isPrinted = item.labelPrinted;
    final recovery = _printRecoveryLedger?[item.orderId];
    final needsSync = recovery?.state == PrintRecoveryState.printedNeedsSync;
    final isUncertain = recovery?.state == PrintRecoveryState.uncertain;
    final group = item.group.trim();
    final status = item.status.trim();
    final statusLabel = isPrinted
        ? 'Printed'
        : needsSync
            ? 'Sync only'
            : isUncertain
                ? 'Check printer'
                : 'Pending';
    final statusIcon = isPrinted
        ? Icons.check_circle
        : needsSync
            ? Icons.cloud_upload
            : isUncertain
                ? Icons.help
                : Icons.schedule;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: theme.colorScheme.outlineVariant),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      item.personName,
                      style: theme.textTheme.titleMedium?.copyWith(
                        decoration:
                            isPrinted ? TextDecoration.lineThrough : null,
                        color: isPrinted ? theme.disabledColor : null,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Chip(
                    visualDensity: VisualDensity.compact,
                    avatar: Icon(statusIcon, size: 16),
                    label: Text(statusLabel),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(item.drink, style: theme.textTheme.bodyLarge),
              if (group.isNotEmpty || status.isNotEmpty)
                Text(
                  [group, status]
                      .where((value) => value.isNotEmpty)
                      .join(' · '),
                  style: theme.textTheme.bodySmall,
                ),
              if (needsSync) ...[
                const SizedBox(height: 8),
                const Text(
                  'The physical label printed, but the web status did not sync. Do not print it again.',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
              if (isUncertain) ...[
                const SizedBox(height: 8),
                const Text(
                  'A Bluetooth error occurred after printing started. Check whether a usable label came out before choosing an action.',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
              const SizedBox(height: 12),
              if (isUncertain)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FilledButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _confirmUncertainLabelPrinted(item),
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
                  ],
                )
              else
                Align(
                  alignment: Alignment.centerRight,
                  child: needsSync
                      ? FilledButton.icon(
                          onPressed:
                              _busy ? null : () => _syncPrintedLabel(item),
                          icon: const Icon(Icons.cloud_upload),
                          label: const Text('Sync only'),
                        )
                      : isPrinted
                          ? OutlinedButton.icon(
                              onPressed:
                                  _busy || _queue?.isProductionActive != true
                                      ? null
                                      : () => _confirmReprint(item),
                              icon: const Icon(Icons.print),
                              label: const Text('Reprint'),
                            )
                          : FilledButton.icon(
                              onPressed:
                                  _busy || _queue?.isProductionActive != true
                                      ? null
                                      : () => _printLabel(item),
                              icon: const Icon(Icons.print),
                              label: const Text('Print'),
                            ),
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Recent activity',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            if (entries.isEmpty)
              const Text('No activity yet.')
            else
              for (final entry in entries)
                Text(
                  entry,
                  style: const TextStyle(
                    fontFamily: 'Menlo',
                    fontSize: 12,
                    height: 1.4,
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _BrandMark(size: 76),
              SizedBox(height: 20),
              CircularProgressIndicator(color: _captureInk),
            ],
          ),
        ),
      );
    }

    if (_session == null) {
      return _buildLinkScreen();
    }

    return Scaffold(
      appBar: AppBar(
        title: const _BrandAppBarTitle(detail: 'On-set controller'),
        actions: [
          IconButton(
            onPressed: _busy ? null : () => _refreshQueue(),
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
                  if (!_busy) await _refreshQueue();
                },
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _buildPrinterStatusCard(context),
                    _buildQueueSummaryCard(context),
                    _buildInactiveProductionCard(),
                    _buildPrintRecoveryCard(),
                    _buildBatchActionsCard(),
                    if (_operatorError != null || _failedBatchLabel != null)
                      _buildOperatorErrorBanner(),
                    _buildLabelsSection(context),
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
