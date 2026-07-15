import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'production_session.dart';

const _secureSessionKey = 'ctc_production_session_v2';
const _legacySessionPreferencesKey = 'ctc_production_session';

abstract interface class SessionRepository {
  Future<ProductionSession?> read();

  Future<void> write(ProductionSession session);

  Future<void> clear();
}

class KeychainSessionRepository implements SessionRepository {
  KeychainSessionRepository({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _iosOptions = IOSOptions(
    accessibility: KeychainAccessibility.unlocked_this_device,
  );

  final FlutterSecureStorage _storage;

  @override
  Future<ProductionSession?> read() async {
    final secureValue = await _storage.read(
      key: _secureSessionKey,
      iOptions: _iosOptions,
    );
    final secureSession = decodeSession(secureValue);
    if (secureSession != null) return secureSession;

    // Build 4 and earlier stored the capability token in ordinary preferences.
    // Migrate it once, then remove the plaintext legacy value.
    final preferences = await SharedPreferences.getInstance();
    final legacyValue = preferences.getString(_legacySessionPreferencesKey);
    final legacySession = decodeSession(legacyValue);
    if (legacySession == null) {
      if (legacyValue != null) {
        await preferences.remove(_legacySessionPreferencesKey);
      }
      return null;
    }

    await write(legacySession);
    await preferences.remove(_legacySessionPreferencesKey);
    return legacySession;
  }

  @override
  Future<void> write(ProductionSession session) => _storage.write(
        key: _secureSessionKey,
        value: encodeSession(session),
        iOptions: _iosOptions,
      );

  @override
  Future<void> clear() => _storage.delete(
        key: _secureSessionKey,
        iOptions: _iosOptions,
      );
}

class MemorySessionRepository implements SessionRepository {
  MemorySessionRepository([this.value]);

  ProductionSession? value;

  @override
  Future<void> clear() async => value = null;

  @override
  Future<ProductionSession?> read() async => value;

  @override
  Future<void> write(ProductionSession session) async => value = session;
}
