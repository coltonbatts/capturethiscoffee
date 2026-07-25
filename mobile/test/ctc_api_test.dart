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

Map<String, Object?> _boardJson({
  String status = 'active',
  String clientName = 'Capture This',
  List<Map<String, Object?>>? roster,
}) =>
    {
      'data': {
        'production': {
          'id': 'production-1',
          'name': 'Review Day',
          'shoot_date': '',
          'location': '',
          'runner_name': '',
          'status': status,
          'client_name': clientName,
        },
        'roster': roster ??
            [
              {
                'roster_id': 'roster-1',
                'group_label': 'Crew',
                'on_set_today': true,
                'sort_order': 1,
                'person': {
                  'id': 'person-1',
                  'name': 'Jamie Example',
                  'role': '',
                  'department': '',
                  'company': '',
                  'photo_url': '',
                  'usual_order': '',
                },
                'order': {
                  'id': 'order-1',
                  'drink_type': 'Latte',
                  'size': '',
                  'temperature': 'Iced',
                  'milk_type': 'Oat',
                  'sweetener': '',
                  'caffeine': '',
                  'special_notes': '',
                  'vendor': '',
                  'status': 'confirmed',
                  'label_printed': false,
                  'updated_at': '2026-07-15T18:00:00.000Z',
                },
              },
            ],
      },
    };

CtcApi _apiReturning(Object body, {int statusCode = 200}) => CtcApi(
      _session,
      client: MockClient((_) async => http.Response(
            jsonEncode(body),
            statusCode,
            headers: {'content-type': 'application/json'},
          )),
    );

void main() {
  test('fetchBoard parses the production and roster', () async {
    final api = CtcApi(
      _session,
      client: MockClient((request) async {
        expect(request.url.queryParameters['token'], _session.token);
        // The board endpoint, not the labels endpoint.
        expect(request.url.path, '/api/public/productions/production-1');
        return http.Response(
          jsonEncode(_boardJson()),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final board = await api.fetchBoard();
    expect(board.production.name, 'Review Day');
    expect(board.production.isActive, isTrue);
    expect(board.production.clientName, 'Capture This');
    expect(board.roster.single.person.name, 'Jamie Example');
    expect(board.roster.single.order?.labelPrinted, isFalse);
  });

  test('fetchBoard rejects malformed order fields', () async {
    final api = _apiReturning(_boardJson(roster: [
      {
        'roster_id': 'roster-1',
        'group_label': 'Crew',
        'on_set_today': true,
        'sort_order': 1,
        'person': {'id': 'person-1', 'name': 'Jamie Example'},
        'order': {
          'id': 'order-1',
          'status': 'confirmed',
          'label_printed': 'no',
        },
      },
    ]));

    await expectLater(
      api.fetchBoard(),
      throwsA(
        isA<CtcApiException>().having(
          (error) => error.message,
          'message',
          contains('invalid production board'),
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
      await api.fetchBoard();
      fail('Expected fetchBoard to throw.');
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
      api.fetchBoard(),
      throwsA(
        isA<CtcApiException>().having(
          (error) => error.message,
          'message',
          contains('too long'),
        ),
      ),
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
      await api.fetchBoard();
      fail('Expected fetchBoard to throw.');
    } on CtcApiException catch (error) {
      expect(error.message, isNot(contains('public.orders')));
      expect(error.message, contains('Could not load the production board'));
    }
  });
}
