import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'production_board.dart';
import 'production_session.dart';

const _defaultRequestTimeout = Duration(seconds: 15);
const _defaultResponseTimeout = Duration(seconds: 20);
const _maximumBoardBytes = 2 * 1024 * 1024;

/// What kind of failure this was, which the UI has to tell apart.
///
/// The distinction is load-bearing, not cosmetic. When a refresh fails the app
/// keeps showing the cached board, and the operator needs to know which of two
/// very different things happened:
///
///   * [unreachable] — the roster on screen is still true, just old. Printing
///     it is correct and is the whole point of the offline cache.
///   * [gone] — the server answered, and said this production is no longer
///     readable with this token. The roster on screen is not just stale, it may
///     describe a day that is over. Printing must stop.
///
/// Without this, a production marked `complete` drops out of the readable
/// statuses, the board 404s, and the app reports "Working offline" over a
/// finished day while still happily printing labels, because the *cached*
/// status still says active.
enum CtcApiErrorKind {
  /// No connection, a timeout, a stall, an aborted request.
  unreachable,

  /// The server replied and refused: 404, 401, 403, revoked, expired, complete.
  gone,

  /// Everything else — malformed payloads, oversized responses, 5xx.
  other,
}

class CtcApiException implements Exception {
  const CtcApiException(this.message, {this.kind = CtcApiErrorKind.other});

  final String message;
  final CtcApiErrorKind kind;

  @override
  String toString() => message;
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

  /// The full runner board, not the printer-queue endpoint.
  ///
  /// The queue only contained captured orders; the board carries the whole
  /// on-set roster, which is what the cache and offline capture need. The print
  /// queue is derived from it locally by [PrinterQueue.fromBoard].
  Uri _boardUri() => Uri.parse(
        '${session.apiBase}/api/public/productions/'
        '${Uri.encodeComponent(session.productionId)}'
        '?token=${Uri.encodeQueryComponent(session.token)}',
      );

  Uri _orderPatchUri(String orderId) => Uri.parse(
        '${session.apiBase}/api/public/orders/${Uri.encodeComponent(orderId)}',
      );

  Future<ProductionBoard> fetchBoard() async {
    final response = await _send(
      'GET',
      _boardUri(),
      headers: _noCacheHeaders,
      maximumBytes: _maximumBoardBytes,
    );
    _throwForStatus(response, fallback: 'Could not load the production board.');
    try {
      final body = jsonDecode(utf8.decode(response.bodyBytes));
      if (body is! Map<String, dynamic>) {
        throw const FormatException('Invalid board response.');
      }
      return ProductionBoard.fromJson(body);
    } on FormatException {
      throw const CtcApiException(
        'The server returned an invalid production board. Refresh and contact support if it continues.',
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
      maximumBytes: _maximumBoardBytes,
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
            kind: CtcApiErrorKind.unreachable,
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
            kind: CtcApiErrorKind.unreachable,
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
        kind: CtcApiErrorKind.unreachable,
      );
    } on http.ClientException {
      // ClientException often includes the full request URI. Never surface it:
      // GET URLs contain the production capability token.
      throw const CtcApiException(
        'No connection. Check Wi-Fi or signal, then try again.',
        kind: CtcApiErrorKind.unreachable,
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

  // Every one of these is the server saying no, rather than the server being
  // out of reach. That difference decides whether the cached roster on screen
  // is still safe to print.
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
    throw CtcApiException(serverMessage, kind: CtcApiErrorKind.gone);
  }
  if (response.statusCode == 401 || response.statusCode == 403) {
    throw const CtcApiException(
      'This production link is invalid, expired, revoked, or no longer active.',
      kind: CtcApiErrorKind.gone,
    );
  }
  if (response.statusCode == 404) {
    throw const CtcApiException(
      'This production or label is no longer available.',
      kind: CtcApiErrorKind.gone,
    );
  }
  throw CtcApiException('$fallback Try again in a moment.');
}

const _noCacheHeaders = {
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};
