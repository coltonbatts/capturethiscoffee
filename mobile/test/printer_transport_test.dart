import 'dart:async';
import 'package:ctc_printer/printer_transport.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:niim_blue_flutter/niim_blue_flutter.dart';

class Client extends NiimbotBluetoothClient {
  late Task task;
  int heartbeats = 0;
  @override
  void stopHeartbeat() {}
  @override
  void startHeartbeat() {
    heartbeats++;
  }

  @override
  void setPacketInterval(int interval) {}
  @override
  Future<void> disconnect() async {}
  @override
  AbstractPrintTask? createPrintTask([PrintOptions? options]) {
    expect(options!.totalPages, 1);
    expect(options.density, 3);
    expect(options.labelType!.value, 1);
    return task;
  }
}

class Task extends B1PrintTask {
  Task(Client client) : super(client.abstraction);
  final phases = <String>[];
  String? fail;
  String? pause;
  final reached = Completer<void>();
  final release = Completer<void>();
  Future<void> phase(String name) async {
    phases.add(name);
    if (name == pause) {
      reached.complete();
      await release.future;
    }
    if (name == fail) throw StateError('failure at $name');
  }

  @override
  Future<void> printInit() => phase('init');
  @override
  Future<void> printPage(EncodedImage image, [int quantity = 1]) {
    expect(quantity, 1);
    return phase('page');
  }

  @override
  Future<void> waitForFinished() => phase('finish');
}

void main() {
  for (final phase in ['init', 'page', 'finish']) {
    test('failure at $phase never repeats a phase', () async {
      final client = Client();
      client.task = Task(client)..fail = phase;
      final transport = NiimbotPrinterTransport(client: client);
      await expectLater(
          transport.printPage(PrintPage(10, 10)), throwsStateError);
      expect(
          client.task.phases,
          ['init', 'page', 'finish']
              .take(['init', 'page', 'finish'].indexOf(phase) + 1));
    });
    test('disconnect during $phase blocks late continuation and heartbeat',
        () async {
      final client = Client();
      client.task = Task(client)..pause = phase;
      final transport = NiimbotPrinterTransport(client: client);
      final operation = transport.printPage(PrintPage(10, 10));
      final assertion = expectLater(operation, throwsStateError);
      await client.task.reached.future;
      await transport.disconnect();
      client.task.release.complete();
      await assertion;
      expect(client.task.phases.last, phase);
      expect(client.heartbeats, 0);
    });
  }
}
