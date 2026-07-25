import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'auth_repository.dart';
import 'supabase_config.dart';
import 'workspace_repository.dart';

const _supabaseSessionKey = 'ctc_supabase_auth_session_v1';

/// Keeps the Supabase refresh token in the iOS Keychain instead of ordinary
/// preferences. Cached boards remain in app-sandboxed preferences.
class KeychainSupabaseLocalStorage extends LocalStorage {
  KeychainSupabaseLocalStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _iosOptions = IOSOptions(
    accessibility: KeychainAccessibility.unlocked_this_device,
  );

  final FlutterSecureStorage _storage;

  @override
  Future<void> initialize() async {}

  @override
  Future<String?> accessToken() => _storage.read(
        key: _supabaseSessionKey,
        iOptions: _iosOptions,
      );

  @override
  Future<bool> hasAccessToken() => _storage.containsKey(
        key: _supabaseSessionKey,
        iOptions: _iosOptions,
      );

  @override
  Future<void> persistSession(String persistSessionString) => _storage.write(
        key: _supabaseSessionKey,
        value: persistSessionString,
        iOptions: _iosOptions,
      );

  @override
  Future<void> removePersistedSession() => _storage.delete(
        key: _supabaseSessionKey,
        iOptions: _iosOptions,
      );
}

class ProductionSupabaseDependencies {
  const ProductionSupabaseDependencies({
    required this.configuration,
    this.authRepository,
    this.workspaceRepository,
  });

  final SupabaseConfiguration configuration;
  final AuthRepository? authRepository;
  final WorkspaceRepository? workspaceRepository;
}

Future<ProductionSupabaseDependencies> initializeProductionSupabase() async {
  final configuration = SupabaseConfiguration.fromEnvironment();
  if (!configuration.isConfigured) {
    return ProductionSupabaseDependencies(configuration: configuration);
  }

  final instance = await Supabase.initialize(
    url: configuration.parsedUrl!.toString(),
    publishableKey: configuration.anonKey.trim(),
    authOptions: FlutterAuthClientOptions(
      localStorage: KeychainSupabaseLocalStorage(),
      detectSessionInUri: false,
    ),
  );
  final client = instance.client;
  return ProductionSupabaseDependencies(
    configuration: configuration,
    authRepository: SupabaseAuthRepository(client),
    workspaceRepository: SupabaseWorkspaceRepository(client),
  );
}
