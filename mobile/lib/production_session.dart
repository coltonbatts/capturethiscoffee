import 'dart:convert';

class ProductionSession {
  const ProductionSession({
    required this.apiBase,
    required this.productionId,
    required this.token,
  });

  final String apiBase;
  final String productionId;
  final String token;

  Map<String, String> toJson() => {
        'apiBase': apiBase,
        'productionId': productionId,
        'token': token,
      };

  factory ProductionSession.fromJson(Map<String, dynamic> json) {
    final apiBase = json['apiBase'];
    final productionId = json['productionId'];
    final token = json['token'];
    if (apiBase is! String || productionId is! String || token is! String) {
      throw const FormatException('Invalid production session.');
    }
    final session = parseProductionShareUrl(
      '$apiBase/run/${Uri.encodeComponent(productionId)}'
      '?token=${Uri.encodeQueryComponent(token)}',
    );
    if (session == null) {
      throw const FormatException('Invalid production session.');
    }
    return session;
  }
}

ProductionSession? parseProductionShareUrl(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;

  final uri =
      Uri.tryParse(trimmed.contains('://') ? trimmed : 'https://$trimmed');
  if (uri == null ||
      !uri.hasAuthority ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty ||
      (uri.scheme != 'https' && uri.scheme != 'http')) {
    return null;
  }

  if (uri.scheme == 'http' && !_isLocalDevelopmentHost(uri.host)) {
    return null;
  }

  final segments =
      uri.pathSegments.where((segment) => segment.isNotEmpty).toList();
  if (segments.length != 2 ||
      (segments.first != 'run' && segments.first != 'productions')) {
    return null;
  }

  final productionId = segments[1].trim();
  final token = uri.queryParameters['token']?.trim();
  if (productionId.isEmpty ||
      productionId.length > 200 ||
      token == null ||
      token.isEmpty ||
      token.length > 4096) {
    return null;
  }

  return ProductionSession(
    apiBase: uri.origin,
    productionId: productionId,
    token: token,
  );
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

String encodeSession(ProductionSession session) => jsonEncode(session.toJson());

ProductionSession? decodeSession(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  try {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    return ProductionSession.fromJson(json);
  } catch (_) {
    return null;
  }
}
