import 'dart:async';
import 'dart:convert';

import 'package:ctc_printer/ctc_api.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _session = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'production-1',
  token: 'secret-production-token',
);

void main() {
  test('fetchQueue parses the production and labels', () async {
    final api = CtcApi(
      _session,
      client: MockClient((request) async {
        expect(request.url.queryParameters['token'], _session.token);
        return http.Response(
          jsonEncode({
            'production': {'name': 'Review Day', 'status': 'active'},
            'designId': 'production-sticker-sheet',
            'labels': [
              {
                'orderId': 'order-1',
                'personName': 'Jamie Example',
                'drink': 'Iced oat latte',
                'group': 'Crew',
                'status': 'confirmed',
                'labelPrinted': false,
              },
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final queue = await api.fetchQueue();
    expect(queue.productionName, 'Review Day');
    expect(queue.productionStatus, 'active');
    expect(queue.isProductionActive, isTrue);
    expect(queue.labels.single.personName, 'Jamie Example');
    expect(queue.labels.single.labelPrinted, isFalse);
  });

  test('fetchQueue rejects malformed label fields', () async {
    final api = CtcApi(
      _session,
      client: MockClient((_) async => http.Response(
            jsonEncode({
              'production': {'name': 'Review Day', 'status': 'active'},
              'labels': [
                {
                  'orderId': 'order-1',
                  'personName': 'Jamie Example',
                  'drink': 'Latte',
                  'labelPrinted': 'no',
                },
              ],
            }),
            200,
          )),
    );

    await expectLater(
      api.fetchQueue(),
      throwsA(
        isA<CtcApiException>().having(
          (error) => error.message,
          'message',
          contains('invalid label queue'),
        ),
      ),
    );
  });

  test('transport errors never expose the capability token', () async {
    final api = CtcApi(
      _session,
      client: MockClient((request) async {
        throw http.ClientException('failed request', request.url);
      }),
    );

    try {
      await api.fetchQueue();
      fail('Expected fetchQueue to throw.');
    } on CtcApiException catch (error) {
      expect(error.message, contains('No connection'));
      expect(error.message, isNot(contains(_session.token)));
    }
  });

  test('requests time out with operator-safe copy', () async {
    final waitForever = Completer<http.Response>();
    final api = CtcApi(
      _session,
      client: MockClient((_) => waitForever.future),
      requestTimeout: const Duration(milliseconds: 5),
    );

    await expectLater(
      api.fetchQueue(),
      throwsA(
        isA<CtcApiException>().having(
          (error) => error.message,
          'message',
          contains('too long'),
        ),
      ),
    );
  });

  test('fetchLabelPng rejects a non-PNG success response', () async {
    final api = CtcApi(
      _session,
      client: MockClient((_) async => http.Response(
            '<html>not a label</html>',
            200,
            headers: {'content-type': 'text/html'},
          )),
    );

    await expectLater(
      api.fetchLabelPng('order-1', 'production-sticker-sheet'),
      throwsA(isA<CtcApiException>()),
    );
  });

  test('markLabelPrinted sends only the scoped sync patch', () async {
    final api = CtcApi(
      _session,
      client: MockClient((request) async {
        expect(request.method, 'PATCH');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['productionId'], _session.productionId);
        expect(body['token'], _session.token);
        expect(body['patch'], {'label_printed': true});
        return http.Response('{"order":{"id":"order-1"}}', 200);
      }),
    );

    await api.markLabelPrinted('order-1');
  });

  test('server internals are replaced with sanitized copy', () async {
    final api = CtcApi(
      _session,
      client: MockClient((_) async => http.Response(
            '{"error":"relation public.orders does not exist"}',
            500,
          )),
    );

    try {
      await api.fetchQueue();
      fail('Expected fetchQueue to throw.');
    } on CtcApiException catch (error) {
      expect(error.message, isNot(contains('public.orders')));
      expect(error.message, contains('Could not load label queue'));
    }
  });
}
