import 'dart:convert';

/// Public, reviewable release configuration for the iOS Supabase client.
///
/// Both values are supplied with `--dart-define`. The service-role key is
/// deliberately rejected even if it is supplied accidentally.
class SupabaseConfiguration {
  const SupabaseConfiguration({
    required this.url,
    required this.anonKey,
  });

  factory SupabaseConfiguration.fromEnvironment() =>
      const SupabaseConfiguration(
        url: String.fromEnvironment('SUPABASE_URL'),
        anonKey: String.fromEnvironment('SUPABASE_ANON_KEY'),
      );

  final String url;
  final String anonKey;

  Uri? get parsedUrl {
    final value = Uri.tryParse(url.trim());
    if (value == null ||
        !value.hasAuthority ||
        value.host.isEmpty ||
        value.userInfo.isNotEmpty) {
      return null;
    }
    if (value.scheme == 'https') return value;
    if (value.scheme == 'http' && _isLocalDevelopmentHost(value.host)) {
      return value;
    }
    return null;
  }

  bool get isConfigured {
    final key = anonKey.trim();
    return parsedUrl != null &&
        key.length >= 20 &&
        !RegExp(r'\s').hasMatch(key) &&
        !_looksLikeSecretKey(key) &&
        !_isServiceRoleJwt(key);
  }

  /// Safe to show on screen and in logs. It never includes either supplied
  /// value, even when the value itself is malformed.
  String get setupMessage {
    if (url.trim().isEmpty || anonKey.trim().isEmpty) {
      return 'This build is missing its public Supabase configuration. '
          'Rebuild with SUPABASE_URL and SUPABASE_ANON_KEY Dart defines.';
    }
    return 'This build has invalid public Supabase configuration. Review the '
        'SUPABASE_URL and public anon key used for the release build.';
  }
}

bool _looksLikeSecretKey(String key) =>
    key.startsWith('sb_secret_') || key.toLowerCase().contains('service_role');

bool _isServiceRoleJwt(String key) {
  final parts = key.split('.');
  if (parts.length != 3) return false;
  try {
    final payload =
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
    final decoded = jsonDecode(payload);
    return decoded is Map<String, dynamic> &&
        decoded['role']?.toString() == 'service_role';
  } catch (_) {
    return false;
  }
}

bool _isLocalDevelopmentHost(String host) {
  final normalized = host.toLowerCase();
  if (normalized == 'localhost' || normalized == '::1') return true;
  final parts = normalized.split('.').map(int.tryParse).toList();
  if (parts.length != 4 || parts.any((part) => part == null)) return false;
  final octets = parts.cast<int>();
  return octets[0] == 10 ||
      (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] == 192 && octets[1] == 168) ||
      octets[0] == 127;
}
