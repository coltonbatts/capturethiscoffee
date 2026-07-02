// Capture This Coffee — NIIMBOT M2_H direct BLE printer app.
//
// Phase 2: load a production share link, fetch server-rendered label PNGs,
// print over BLE, and mark label_printed via the public order PATCH route.

import 'package:flutter/material.dart';
import 'package:image/image.dart' as img;
import 'package:niim_blue_flutter/niim_blue_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'ctc_api.dart';
import 'production_session.dart';

// M2_H @ 300 DPI — tunable if physical output needs adjustment.
const int kPageWidth = 560;
const int kPageHeight = 352;
const int kDensity = 3;
const int kLabelType = 1;

const _sessionPrefsKey = 'ctc_production_session';

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

class _PrinterHomeState extends State<PrinterHome> {
  final NiimbotBluetoothClient _client = NiimbotBluetoothClient();
  final List<String> _log = [];
  final _linkController = TextEditingController();

  ProductionSession? _session;
  CtcApi? _api;
  PrinterQueue? _queue;
  bool _showPrinted = false;
  bool _connected = false;
  bool _busy = false;
  bool _loadingSession = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  @override
  void dispose() {
    _linkController.dispose();
    _client.disconnect();
    super.dispose();
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
      await _refreshQueue(silent: true);
    }
  }

  void _logLine(String message) {
    final stamp = DateTime.now().toIso8601String().substring(11, 19);
    setState(() => _log.insert(0, '[$stamp] $message'));
    // ignore: avoid_print
    print('[printer] $message');
  }

  Future<void> _run(String label, Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    _logLine('--- $label ---');
    try {
      await action();
      _logLine('$label: OK');
    } catch (error, stack) {
      _logLine('$label FAILED: $error');
      _logLine(stack.toString().split('\n').take(3).join(' | '));
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _connectPrinter() => _run('Connect printer', () async {
        _logLine('Scanning for the first NIIMBOT device…');
        _logLine('(Force-quit the official NIIMBOT app first!)');
        await _client.connect();
        _client.setOnDisconnect(() {
          _logLine('Printer disconnected.');
          if (mounted) setState(() => _connected = false);
        });
        setState(() => _connected = true);
      });

  Future<void> _disconnectPrinter() => _run('Disconnect printer', () async {
        await _client.disconnect();
        setState(() => _connected = false);
      });

  Future<void> _saveSession(ProductionSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_sessionPrefsKey, encodeSession(session));
    setState(() {
      _session = session;
      _api = CtcApi(session);
    });
  }

  Future<void> _clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionPrefsKey);
    setState(() {
      _session = null;
      _api = null;
      _queue = null;
      _linkController.clear();
    });
  }

  Future<void> _linkProduction() => _run('Link production', () async {
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
    if (api == null) return;

    Future<void> action() async {
      final queue = await api.fetchQueue();
      setState(() => _queue = queue);
      _logLine('Queue: ${queue.labels.length} labels for ${queue.productionName}.');
    }

    if (silent) {
      try {
        await action();
      } catch (error) {
        _logLine('Queue refresh failed: $error');
      }
      return;
    }

    await _run('Refresh queue', action);
  }

  Future<void> _printPage(PrintPage page) async {
    _client.stopHeartbeat();
    _client.setPacketInterval(0);
    try {
      final task = _client.createPrintTask(PrintOptions(
        totalPages: 1,
        density: kDensity,
        labelType: LabelType.fromValue(kLabelType),
      ));
      if (task == null) {
        throw Exception('Printer model not detected.');
      }
      await task.printInit();
      await task.printPage(page.toEncodedImage(), 1);
      await task.waitForFinished();
    } finally {
      _client.startHeartbeat();
    }
  }

  Future<void> _printLabel(QueueLabel item) => _run('Print ${item.personName}', () async {
        if (!_connected) {
          throw Exception('Connect to the printer first.');
        }
        final api = _api;
        final queue = _queue;
        if (api == null || queue == null) {
          throw Exception('No production linked.');
        }

        _logLine('Fetching PNG for ${item.personName}…');
        final bytes = await api.fetchLabelPng(item.orderId, queue.designId);
        final decoded = img.decodeImage(bytes);
        if (decoded == null) {
          throw Exception('Could not decode label PNG.');
        }
        _logLine('PNG ${decoded.width}x${decoded.height}. Printing…');

        final page = PrintPage(kPageWidth, kPageHeight);
        page.addImageFromBuffer(ImageFromBufferOptions(
          buffer: bytes,
          x: kPageWidth ~/ 2,
          y: kPageHeight ~/ 2,
          width: kPageWidth,
          height: kPageHeight,
          align: HAlignment.center,
          vAlign: VAlignment.middle,
          threshold: 128,
        ));
        await _printPage(page);

        _logLine('Marking label_printed…');
        await api.markLabelPrinted(item.orderId);
        await _refreshQueue(silent: true);
      });

  List<QueueLabel> get _visibleLabels {
    final labels = _queue?.labels ?? [];
    if (_showPrinted) return labels;
    return labels.where((label) => !label.labelPrinted).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingSession) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_session == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('CTC Printer')),
        body: Padding(
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
                onPressed: _busy ? null : _linkProduction,
                icon: const Icon(Icons.link),
                label: const Text('Link production'),
              ),
            ],
          ),
        ),
      );
    }

    final queue = _queue;
    final visible = _visibleLabels;
    final pendingCount =
        queue?.labels.where((label) => !label.labelPrinted).length ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(queue?.productionName ?? 'CTC Printer'),
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
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Icon(
              _connected ? Icons.bluetooth_connected : Icons.bluetooth_disabled,
              color: _connected ? Colors.green : Colors.grey,
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                FilledButton.icon(
                  onPressed: _busy || _connected ? null : _connectPrinter,
                  icon: const Icon(Icons.bluetooth_searching),
                  label: const Text('Connect printer'),
                ),
                OutlinedButton.icon(
                  onPressed: _busy || !_connected ? null : _disconnectPrinter,
                  icon: const Icon(Icons.close),
                  label: const Text('Disconnect'),
                ),
                FilterChip(
                  label: Text(_showPrinted ? 'Showing all' : '$pendingCount to print'),
                  selected: _showPrinted,
                  onSelected: _busy
                      ? null
                      : (value) => setState(() => _showPrinted = value),
                ),
              ],
            ),
          ),
          if (_busy) const LinearProgressIndicator(),
          Expanded(
            flex: 3,
            child: visible.isEmpty
                ? Center(
                    child: Text(
                      queue == null
                          ? 'Tap refresh to load labels.'
                          : _showPrinted
                              ? 'No labels on this production.'
                              : 'All labels printed.',
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: visible.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = visible[index];
                      return ListTile(
                        title: Text(
                          item.personName,
                          style: TextStyle(
                            decoration: item.labelPrinted
                                ? TextDecoration.lineThrough
                                : null,
                            color: item.labelPrinted ? Colors.grey : null,
                          ),
                        ),
                        subtitle: Text('${item.drink}\n${item.group}'),
                        isThreeLine: true,
                        trailing: item.labelPrinted
                            ? const Icon(Icons.check_circle, color: Colors.green)
                            : FilledButton(
                                onPressed:
                                    _busy || !_connected ? null : () => _printLabel(item),
                                child: const Text('Print'),
                              ),
                      );
                    },
                  ),
          ),
          const Divider(height: 1),
          Expanded(
            flex: 2,
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _log.length,
              itemBuilder: (context, index) => Text(
                _log[index],
                style: const TextStyle(
                  fontFamily: 'Menlo',
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
