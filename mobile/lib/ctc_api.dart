import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'production_session.dart';

class QueueLabel {
  QueueLabel({
    required this.orderId,
    required this.personName,
    required this.drink,
    required this.group,
    required this.status,
    required this.labelPrinted,
  });

  final String orderId;
  final String personName;
  final String drink;
  final String group;
  final String status;
  final bool labelPrinted;

  factory QueueLabel.fromJson(Map<String, dynamic> json) {
    return QueueLabel(
      orderId: json['orderId'] as String,
      personName: json['personName'] as String,
      drink: json['drink'] as String,
      group: json['group'] as String? ?? '',
      status: json['status'] as String? ?? '',
      labelPrinted: json['labelPrinted'] as bool? ?? false,
    );
  }
}

class PrinterQueue {
  PrinterQueue({
    required this.productionName,
    required this.designId,
    required this.labels,
  });

  final String productionName;
  final String designId;
  final List<QueueLabel> labels;

  factory PrinterQueue.fromJson(Map<String, dynamic> json) {
    final production = json['production'] as Map<String, dynamic>;
    final labels = (json['labels'] as List<dynamic>)
        .map((item) => QueueLabel.fromJson(item as Map<String, dynamic>))
        .toList();
    return PrinterQueue(
      productionName: production['name'] as String? ?? 'Production',
      designId: json['designId'] as String? ?? 'production-sticker-sheet',
      labels: labels,
    );
  }
}

class CtcApi {
  CtcApi(this.session);

  final ProductionSession session;

  Uri _queueUri() => Uri.parse(
        '${session.apiBase}/api/public/productions/${Uri.encodeComponent(session.productionId)}/labels?token=${Uri.encodeComponent(session.token)}',
      );

  Uri _labelUri(String orderId, String designId) => Uri.parse(
        '${session.apiBase}/api/public/orders/${Uri.encodeComponent(orderId)}/label'
        '?productionId=${Uri.encodeComponent(session.productionId)}'
        '&token=${Uri.encodeComponent(session.token)}'
        '&design=${Uri.encodeComponent(designId)}',
      );

  Uri _orderPatchUri(String orderId) => Uri.parse(
        '${session.apiBase}/api/public/orders/${Uri.encodeComponent(orderId)}',
      );

  Future<PrinterQueue> fetchQueue() async {
    final response = await http.get(_queueUri());
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw Exception(body['error'] as String? ?? 'Could not load label queue.');
    }
    return PrinterQueue.fromJson(body);
  }

  Future<Uint8List> fetchLabelPng(String orderId, String designId) async {
    final response = await http.get(_labelUri(orderId, designId));
    if (response.statusCode != 200) {
      try {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        throw Exception(body['error'] as String? ?? 'Could not load label PNG.');
      } catch (_) {
        throw Exception('Could not load label PNG (${response.statusCode}).');
      }
    }
    return response.bodyBytes;
  }

  Future<void> markLabelPrinted(String orderId) async {
    final response = await http.patch(
      _orderPatchUri(orderId),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'productionId': session.productionId,
        'token': session.token,
        'patch': {'label_printed': true},
      }),
    );
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['error'] as String? ?? 'Could not mark label printed.');
    }
  }
}
