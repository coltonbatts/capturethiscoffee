import 'package:niim_blue_flutter/niim_blue_flutter.dart';
import 'printer_validation.dart';

/// Only this boundary may send Bluetooth packets. No recovery or sync logic.
abstract interface class PrinterTransport {
  set onDisconnect(void Function()? callback);
  Future<String?> connect();
  Future<void> verifyConnection();
  Future<void> disconnect();
  Future<void> printPage(PrintPage page);
}

class NiimbotPrinterTransport implements PrinterTransport {
  final NiimbotBluetoothClient _client;
  String? _connectedDeviceName;
  int _epoch = 0;
  @override
  void Function()? onDisconnect;
  NiimbotPrinterTransport(
      {NiimbotBluetoothClient? client, void Function(String)? log})
      : _client = client ?? NiimbotBluetoothClient(),
        _logger = log;
  final void Function(String)? _logger;
  void _logLine(String message) => _logger?.call(message);
  static const _printerScanTimeout = Duration(seconds: 8);
  static const kDensity = 3;
  static const kLabelType = 1;
  @override
  Future<String?> connect() async {
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
      _connectedDeviceName = null;

      throw Exception('Printer not connected. $error');
    }
    _client.setOnDisconnect(() {
      _epoch++;
      onDisconnect?.call();

      _connectedDeviceName = null;
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
    if (_connectedDeviceName == null) {
      throw StateError('Printer disconnected during connection.');
    }
    return _connectedDeviceName;
  }

  Future<void> _verifyModelDetection() async {
    final epoch = _epoch;
    var meta = _client.getModelMetadata();
    for (var attempt = 1; meta == null && attempt <= 2; attempt += 1) {
      _logLine('Printer model not detected; retrying info fetch ($attempt)…');
      try {
        await _client.fetchPrinterInfo();
      } catch (error) {
        _logLine('Info fetch failed: $error');
      }
      if (epoch != _epoch) {
        throw StateError('Printer disconnected during verification.');
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

  @override
  Future<void> verifyConnection() async {
    final epoch = _epoch;
    await _client.fetchPrinterInfo();
    if (epoch != _epoch) {
      throw StateError('Printer disconnected during verification.');
    }
    await _verifyModelDetection();
  }

  @override
  Future<void> disconnect() {
    ++_epoch; // Invalidate synchronously, before teardown can await.
    return _client.disconnect();
  }

  @override
  Future<void> printPage(PrintPage page) async {
    final epoch = _epoch;
    void check() {
      if (epoch != _epoch) throw StateError('Print transport was invalidated.');
    }

    check();
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
        check();
        await task.printPage(encoded, 1);
        check();
        await task.waitForFinished();
        check();
      })();
    } finally {
      if (epoch == _epoch) _client.startHeartbeat();
    }
  }
}
