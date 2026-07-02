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
    return ProductionSession(
      apiBase: json['apiBase'] as String,
      productionId: json['productionId'] as String,
      token: json['token'] as String,
    );
  }
}

ProductionSession? parseProductionShareUrl(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;

  final uri = Uri.tryParse(trimmed.contains('://') ? trimmed : 'https://$trimmed');
  if (uri == null) return null;

  final segments = uri.pathSegments;
  final productionsIndex = segments.indexOf('productions');
  if (productionsIndex == -1 || productionsIndex + 1 >= segments.length) {
    return null;
  }

  final token = uri.queryParameters['token'];
  if (token == null || token.isEmpty) return null;

  return ProductionSession(
    apiBase: uri.origin,
    productionId: segments[productionsIndex + 1],
    token: token,
  );
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
