import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'production_session.dart';

const _defaultRequestTimeout = Duration(seconds: 15);
const _defaultResponseTimeout = Duration(seconds: 20);
const _maximumQueueBytes = 2 * 1024 * 1024;
const _maximumQueueLabels = 1000;

class CtcApiException implements Exception {
  const CtcApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class QueueLabel {
  const QueueLabel({
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
    final orderId = _requiredString(json, 'orderId');
    final personName = _requiredString(json, 'personName');
    final drink = _optionalString(json, 'drink');
    final group = _optionalString(json, 'group');
    final status = _optionalString(json, 'status');
    final labelPrinted = json['labelPrinted'];
    if (labelPrinted is! bool) {
      throw const FormatException('Invalid labelPrinted value.');
    }
    return QueueLabel(
      orderId: orderId,
      personName: personName,
      drink: drink,
      group: group,
      status: status,
      labelPrinted: labelPrinted,
    );
  }
}

class PrinterQueue {
  const PrinterQueue({
    required this.productionName,
    required this.productionStatus,
    required this.clientName,
    required this.designId,
    required this.labels,
  });

  final String productionName;
  final String productionStatus;

  /// Optional. Labels show `production name / client name`; the app renders
  /// labels locally now, so it needs the same brand line the server renderer
  /// builds. Older servers omit this and the label degrades to the production
  /// name alone rather than failing.
  final String clientName;

  /// The design the server considers current. The app always renders `grid-01`
  /// locally, so this is informational: if it stops matching, the app and
  /// `/labels` are producing different labels for the same day.
  final String designId;

  final List<QueueLabel> labels;

  bool get isProductionActive => productionStatus == 'active';

  factory PrinterQueue.fromJson(Map<String, dynamic> json) {
    final production = json['production'];
    final rawLabels = json['labels'];
    if (production is! Map<String, dynamic> || rawLabels is! List<dynamic>) {
      throw const FormatException('Invalid queue response.');
    }
    if (rawLabels.length > _maximumQueueLabels) {
      throw const FormatException('Queue is unexpectedly large.');
    }
    final labels = rawLabels.map((item) {
      if (item is! Map<String, dynamic>) {
        throw const FormatException('Invalid queue label.');
      }
      return QueueLabel.fromJson(item);
    }).toList(growable: false);
    return PrinterQueue(
      productionName: _optionalString(
        production,
        'name',
        fallback: 'Production',
      ),
      productionStatus: _requiredString(production, 'status'),
      clientName: _optionalString(production, 'clientName'),
      designId: _optionalString(
        json,
        'designId',
        fallback: 'production-sticker-sheet',
      ),
      labels: labels,
    );
  }
}

class CtcApi {
  CtcApi(
    this.session, {
    http.Client? client,
    Duration requestTimeout = _defaultRequestTimeout,
    Duration responseTimeout = _defaultResponseTimeout,
  })  : _client = client ?? http.Client(),
        _ownsClient = client == null,
        _requestTimeout = requestTimeout,
        _responseTimeout = responseTimeout;

  final ProductionSession session;
  final http.Client _client;
  final bool _ownsClient;
  final Duration _requestTimeout;
  final Duration _responseTimeout;

  Uri _queueUri() => Uri.parse(
        '${session.apiBase}/api/public/productions/'
        '${Uri.encodeComponent(session.productionId)}/labels'
        '?token=${Uri.encodeQueryComponent(session.token)}',
      );

  Uri _orderPatchUri(String orderId) => Uri.parse(
        '${session.apiBase}/api/public/orders/${Uri.encodeComponent(orderId)}',
      );

  Future<PrinterQueue> fetchQueue() async {
    final response = await _send(
      'GET',
      _queueUri(),
      headers: _noCacheHeaders,
      maximumBytes: _maximumQueueBytes,
    );
    _throwForStatus(response, fallback: 'Could not load label queue.');
    try {
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is! Map<String, dynamic>) {
        throw const FormatException('Invalid queue response.');
      }
      return PrinterQueue.fromJson(body);
    } on FormatException {
      throw const CtcApiException(
        'The server returned an invalid label queue. Refresh and contact support if it continues.',
      );
    }
  }

  Future<void> markLabelPrinted(String orderId) async {
    final response = await _send(
      'PATCH',
      _orderPatchUri(orderId),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'productionId': session.productionId,
        'token': session.token,
        'patch': {'label_printed': true},
      }),
      maximumBytes: _maximumQueueBytes,
    );
    _throwForStatus(response, fallback: 'Could not sync printed status.');
  }

  Future<http.Response> _send(
    String method,
    Uri uri, {
    Map<String, String>? headers,
    String? body,
    required int maximumBytes,
  }) async {
    final abort = Completer<void>();
    final request = http.AbortableRequest(
      method,
      uri,
      abortTrigger: abort.future,
    );
    if (headers != null) request.headers.addAll(headers);
    if (body != null) request.body = body;

    try {
      final streamed = await _client.send(request).timeout(
        _requestTimeout,
        onTimeout: () {
          if (!abort.isCompleted) abort.complete();
          throw const CtcApiException(
            'The server took too long to respond. Check your connection and try again.',
          );
        },
      );
      final bytes = await streamed.stream.fold<BytesBuilder>(BytesBuilder(),
          (builder, chunk) {
        if (builder.length + chunk.length > maximumBytes) {
          if (!abort.isCompleted) abort.complete();
          throw const CtcApiException('The server response was too large.');
        }
        builder.add(chunk);
        return builder;
      }).timeout(
        _responseTimeout,
        onTimeout: () {
          if (!abort.isCompleted) abort.complete();
          throw const CtcApiException(
            'The server response stalled. Check your connection and try again.',
          );
        },
      );
      return http.Response.bytes(
        bytes.takeBytes(),
        streamed.statusCode,
        headers: streamed.headers,
        reasonPhrase: streamed.reasonPhrase,
        request: request,
      );
    } on CtcApiException {
      rethrow;
    } on http.RequestAbortedException {
      throw const CtcApiException(
        'The request was cancelled. Check your connection and try again.',
      );
    } on http.ClientException {
      // ClientException often includes the full request URI. Never surface it:
      // GET URLs contain the production capability token.
      throw const CtcApiException(
        'No connection. Check Wi-Fi or signal, then try again.',
      );
    } on FormatException {
      throw const CtcApiException('The server returned an invalid response.');
    } finally {
      if (!abort.isCompleted) abort.complete();
    }
  }

  void close() {
    if (_ownsClient) _client.close();
  }
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.trim().isEmpty || value.length > 10000) {
    throw FormatException('Invalid $key value.');
  }
  return value;
}

String _optionalString(
  Map<String, dynamic> json,
  String key, {
  String fallback = '',
}) {
  final value = json[key];
  if (value == null) return fallback;
  if (value is! String || value.length > 10000) {
    throw FormatException('Invalid $key value.');
  }
  return value;
}

void _throwForStatus(http.Response response, {required String fallback}) {
  if (response.statusCode >= 200 && response.statusCode < 300) return;
  String? serverMessage;
  try {
    final body = jsonDecode(utf8.decode(response.bodyBytes));
    if (body is Map<String, dynamic> && body['error'] is String) {
      serverMessage = body['error'] as String;
    }
  } catch (_) {
    // Status and the allowlist below are sufficient for safe operator copy.
  }

  const allowedMessages = {
    'Missing production share token.',
    'Invalid production share token.',
    'Expired production share token.',
    'Production is not active.',
    'Production not found.',
    'Order not found.',
    'Label not found for this order.',
  };
  if (serverMessage != null && allowedMessages.contains(serverMessage)) {
    throw CtcApiException(serverMessage);
  }
  if (response.statusCode == 401 || response.statusCode == 403) {
    throw const CtcApiException(
      'This production link is invalid, expired, revoked, or no longer active.',
    );
  }
  if (response.statusCode == 404) {
    throw const CtcApiException(
        'This production or label is no longer available.');
  }
  throw CtcApiException('$fallback Try again in a moment.');
}

const _noCacheHeaders = {
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};
