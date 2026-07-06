// Capture This Coffee — NIIMBOT M2_H direct BLE printer app.
//
// Phase 2: load a production share link, fetch server-rendered label PNGs,
// print over BLE, and mark label_printed via the public order PATCH route.

import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:niim_blue_flutter/niim_blue_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'ctc_api.dart';
import 'production_session.dart';

// M2_H @ 300 DPI. The library metadata reports a 567-dot printhead for model
// 4608, while the server PNG is 591x354 with safe margins for 50x30mm stock.
const int kPrintheadWidth = 567;
const int kDensity = 3;
const int kLabelType = 1;
const int kMinimumTextSideInkPixels = 300;

const _sessionPrefsKey = 'ctc_production_session';
const _queueRefreshInterval = Duration(seconds: 10);

void main() => runApp(const PrinterApp());

class PrinterApp extends StatelessWidget {
  const PrinterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CTC Printer',
      theme: ThemeData(
        colorSchemeSeed: Colors.orange,
        useMaterial3: true,
      ),
      home: const PrinterHome(),
    );
  }
}

class PrinterHome extends StatefulWidget {
  const PrinterHome({super.key});

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

class _PrinterHomeState extends State<PrinterHome> with WidgetsBindingObserver {
  final NiimbotBluetoothClient _client = NiimbotBluetoothClient();
  final List<String> _log = [];
  final _linkController = TextEditingController();

  ProductionSession? _session;
  CtcApi? _api;
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _restoreSession();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopQueueRefreshTimer();
    _linkController.dispose();
    _client.disconnect();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _session != null) {
      unawaited(_refreshQueue(silent: true));
    }
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = decodeSession(prefs.getString(_sessionPrefsKey));
    setState(() {
      _session = saved;
      _api = saved == null ? null : CtcApi(saved);
      _loadingSession = false;
    });
    if (saved != null) {
      _startQueueRefreshTimer();
      await _refreshQueue(silent: true);
    }
  }

  void _logLine(String message) {
    final stamp = DateTime.now().toIso8601String().substring(11, 19);
    setState(() => _log.insert(0, '[$stamp] $message'));
    // ignore: avoid_print
    print('[printer] $message');
  }

  Future<bool> _run(String label, Future<void> Function() action) async {
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
      setState(() {
        _operatorError = message;
        if (label.toLowerCase().contains('print') ||
            label.toLowerCase().contains('connect')) {
          _printerStatus = _PrinterStatus.error;
        }
      });
      _logLine('$label FAILED: ${_errorText(error)}');
      _logLine(stack.toString().split('\n').take(3).join(' | '));
      return false;
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<bool> _connectPrinter() => _run('Connect printer', () async {
        setState(() => _printerStatus = _PrinterStatus.connecting);
        _logLine('Scanning for the first NIIMBOT device…');
        _logLine('(Force-quit the official NIIMBOT app first!)');
        try {
          await _client.connect();
        } catch (error) {
          setState(() {
            _connected = false;
            _printerStatus = _PrinterStatus.error;
          });
          throw Exception('Printer not connected. ${_errorText(error)}');
        }
        _client.setOnDisconnect(() {
          _logLine('Printer disconnected.');
          if (mounted) {
            setState(() {
              _connected = false;
              _printerStatus = _PrinterStatus.disconnected;
            });
          }
        });
        await _verifyModelDetection();
        setState(() {
          _connected = true;
          _printerStatus = _PrinterStatus.connected;
        });
      });

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
      _logLine(
        'Model still unknown (modelId: ${info.modelId}, '
        'connect: ${info.connectResult}, proto: ${info.protocolVersion}). '
        'Will force the M2_H print task.',
      );
    } else {
      _logLine('Detected ${meta.model} (modelId ${info.modelId}).');
    }
  }

  Future<bool> _disconnectPrinter() => _run('Disconnect printer', () async {
        await _client.disconnect();
        setState(() {
          _connected = false;
          _printerStatus = _PrinterStatus.disconnected;
        });
      });

  Future<void> _saveSession(ProductionSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_sessionPrefsKey, encodeSession(session));
    setState(() {
      _session = session;
      _api = CtcApi(session);
      _queueSignature = '';
    });
    _startQueueRefreshTimer();
  }

  Future<void> _clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionPrefsKey);
    _stopQueueRefreshTimer();
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
        await _saveSession(parsed);
        await _refreshQueue();
      });

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
      late final PrinterQueue queue;
      try {
        queue = await api.fetchQueue();
      } catch (error) {
        throw Exception('Queue fetch failed. ${_errorText(error)}');
      }
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

  Future<void> _printPage(PrintPage page) async {
    _client.stopHeartbeat();
    _client.setPacketInterval(15);
    try {
      final encoded = page.toEncodedImage();
      final options = PrintOptions(
        totalPages: 1,
        density: kDensity,
        labelType: LabelType.fromValue(kLabelType),
      );
      var task = _client.createPrintTask(options);
      if (task == null) {
        // Model auto-detection failed; this app only ever talks to an M2_H,
        // which uses the b1 print task in niim_blue_flutter.
        _logLine('Printer model not detected; forcing M2_H (B1) print task.');
        task = B1PrintTask(_client.abstraction, options);
      }
      await task.printInit();
      await task.printPage(encoded, 1);
      await task.waitForFinished();
    } finally {
      _client.startHeartbeat();
    }
  }

  Future<bool> _printLabel(QueueLabel item) => _run(
        item.labelPrinted
            ? 'Reprint ${item.personName}'
            : 'Print ${item.personName}',
        () => _printOneLabel(item),
      );

  Future<bool> _printNextPending() => _run('Print next', () async {
        final pending = _pendingLabels;
        if (pending.isEmpty) {
          throw Exception('No pending labels to print.');
        }
        await _printOneLabel(pending.first);
      });

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
    });
  }

  Future<void> _printOneLabel(QueueLabel item) async {
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

    setState(() => _printerStatus = _PrinterStatus.printing);

    _logLine('Fetching PNG for ${item.personName}…');
    late final Uint8List bytes;
    try {
      bytes = await api.fetchLabelPng(item.orderId, queue.designId);
    } catch (error) {
      setState(() => _printerStatus = _PrinterStatus.error);
      throw Exception(
        'PNG download failed for ${item.personName}. ${_errorText(error)}',
      );
    }

    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      setState(() => _printerStatus = _PrinterStatus.error);
      throw Exception(
        'PNG download failed for ${item.personName}. Could not decode label PNG.',
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
      setState(() => _printerStatus = _PrinterStatus.error);
      throw Exception(
        'Bluetooth print failed for ${item.personName}. ${_errorText(error)}',
      );
    }

    setState(() => _lastPrintedLabel = _labelTitle(item));

    _logLine('Marking label_printed…');
    try {
      await api.markLabelPrinted(item.orderId);
    } catch (error) {
      setState(() => _printerStatus = _PrinterStatus.error);
      throw Exception(
        'Printed ${item.personName}, but mark-printed API call failed. ${_errorText(error)}',
      );
    }

    setState(() => _printerStatus = _PrinterStatus.connected);
    await _refreshQueue(silent: true);
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
    return labels.where((label) => !label.labelPrinted).toList();
  }

  List<QueueLabel> get _visibleLabels {
    final labels = _queue?.labels ?? [];
    if (_showPrinted) return labels;
    return labels.where((label) => !label.labelPrinted).toList();
  }

  String _labelTitle(QueueLabel item) {
    final drink = item.drink.trim();
    if (drink.isEmpty) return item.personName;
    return '${item.personName} - $drink';
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
      appBar: AppBar(title: const Text('CTC Printer')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Paste the production share link from the runner board '
                '(the URL with ?token=…).',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _linkController,
                decoration: const InputDecoration(
                  labelText: 'Production share URL',
                  border: OutlineInputBorder(),
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
    final printed = total - pending;
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
            const SizedBox(height: 12),
            Row(
              children: [
                _buildMetric(context, 'Pending', pending.toString()),
                const SizedBox(width: 8),
                _buildMetric(context, 'Printed', printed.toString()),
                const SizedBox(width: 8),
                _buildMetric(context, 'Total', total.toString()),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: Text('Last refresh: $refreshed')),
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
          border: Border.all(color: theme.colorScheme.outlineVariant),
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FilledButton.icon(
              onPressed:
                  _busy || pending == 0 ? null : () => _printNextPending(),
              icon: const Icon(Icons.skip_next),
              label: const Text('Print next'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _busy || pending == 0
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
    final group = item.group.trim();
    final status = item.status.trim();

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
                    avatar: Icon(
                      isPrinted ? Icons.check_circle : Icons.schedule,
                      size: 16,
                    ),
                    label: Text(isPrinted ? 'Printed' : 'Pending'),
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
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: isPrinted
                    ? OutlinedButton.icon(
                        onPressed: _busy ? null : () => _printLabel(item),
                        icon: const Icon(Icons.print),
                        label: const Text('Reprint'),
                      )
                    : FilledButton.icon(
                        onPressed: _busy ? null : () => _printLabel(item),
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
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_session == null) {
      return _buildLinkScreen();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('On-set controller'),
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
