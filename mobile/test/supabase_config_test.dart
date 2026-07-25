import 'dart:convert';

import 'package:ctc_printer/supabase_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('missing Supabase configuration is sanitized and actionable', () {
    const configuration = SupabaseConfiguration(url: '', anonKey: '');

    expect(configuration.isConfigured, isFalse);
    expect(configuration.setupMessage, contains('SUPABASE_URL'));
    expect(configuration.setupMessage, contains('SUPABASE_ANON_KEY'));
  });

  test('valid public configuration is accepted', () {
    const configuration = SupabaseConfiguration(
      url: 'https://capture-this.supabase.co',
      anonKey: 'public-anon-key-for-release-123456',
    );

    expect(configuration.isConfigured, isTrue);
  });

  test('service-role credentials are rejected without echoing them', () {
    final payload = base64Url
        .encode(
          utf8.encode(jsonEncode({'role': 'service_role'})),
        )
        .replaceAll('=', '');
    final secret = 'header.$payload.signature-value-long-enough';
    final configuration = SupabaseConfiguration(
      url: 'https://capture-this.supabase.co',
      anonKey: secret,
    );

    expect(configuration.isConfigured, isFalse);
    expect(configuration.setupMessage, isNot(contains(secret)));
    expect(configuration.setupMessage, contains('public anon key'));
  });
}
