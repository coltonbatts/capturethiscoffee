import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

enum AuthEventType {
  initialSession,
  signedIn,
  signedOut,
  tokenRefreshed,
  userUpdated,
}

class AuthSession {
  const AuthSession({
    required this.userId,
    required this.email,
    required this.isExpired,
  });

  final String userId;
  final String email;
  final bool isExpired;
}

class AuthEvent {
  const AuthEvent(this.type, this.session);

  final AuthEventType type;
  final AuthSession? session;
}

enum AuthFailureKind {
  invalidCredentials,
  network,
  invalidSession,
  other,
}

class AuthRepositoryException implements Exception {
  const AuthRepositoryException(this.message, {required this.kind});

  final String message;
  final AuthFailureKind kind;

  @override
  String toString() => message;
}

abstract interface class AuthRepository {
  Stream<AuthEvent> get events;

  Future<AuthSession?> restoreSession();

  Future<AuthSession> signIn({
    required String email,
    required String password,
  });

  Future<AuthSession?> refreshSession();

  Future<void> signOut();
}

class SupabaseAuthRepository implements AuthRepository {
  SupabaseAuthRepository(this._client);

  final supabase.SupabaseClient _client;

  @override
  Stream<AuthEvent> get events => _client.auth.onAuthStateChange.map((data) {
        final event = switch (data.event) {
          supabase.AuthChangeEvent.initialSession =>
            AuthEventType.initialSession,
          supabase.AuthChangeEvent.signedIn => AuthEventType.signedIn,
          supabase.AuthChangeEvent.signedOut => AuthEventType.signedOut,
          supabase.AuthChangeEvent.tokenRefreshed =>
            AuthEventType.tokenRefreshed,
          supabase.AuthChangeEvent.userUpdated => AuthEventType.userUpdated,
          _ => null,
        };
        return AuthEvent(
          event ?? AuthEventType.userUpdated,
          _mapSession(data.session),
        );
      });

  @override
  Future<AuthSession?> restoreSession() async {
    final current = _mapSession(_client.auth.currentSession);
    if (current != null) return current;
    try {
      final restored = await _client.auth.onAuthStateChange
          .firstWhere((data) =>
              data.event == supabase.AuthChangeEvent.initialSession ||
              data.event == supabase.AuthChangeEvent.signedIn ||
              data.event == supabase.AuthChangeEvent.tokenRefreshed)
          .timeout(const Duration(seconds: 2));
      return _mapSession(restored.session);
    } on TimeoutException {
      return _mapSession(_client.auth.currentSession);
    }
  }

  @override
  Future<AuthSession> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );
      final session = _mapSession(response.session);
      if (session == null) {
        throw const AuthRepositoryException(
          'The account did not return a usable session.',
          kind: AuthFailureKind.invalidSession,
        );
      }
      return session;
    } on supabase.AuthException {
      throw const AuthRepositoryException(
        'Email or password is incorrect.',
        kind: AuthFailureKind.invalidCredentials,
      );
    } on AuthRepositoryException {
      rethrow;
    } catch (_) {
      throw const AuthRepositoryException(
        'Could not reach the sign-in service. Check the connection and try again.',
        kind: AuthFailureKind.network,
      );
    }
  }

  @override
  Future<AuthSession?> refreshSession() async {
    try {
      final response = await _client.auth.refreshSession();
      return _mapSession(response.session);
    } on supabase.AuthException {
      throw const AuthRepositoryException(
        'The saved sign-in is no longer valid.',
        kind: AuthFailureKind.invalidSession,
      );
    } catch (_) {
      throw const AuthRepositoryException(
        'The saved sign-in could not be refreshed while offline.',
        kind: AuthFailureKind.network,
      );
    }
  }

  @override
  Future<void> signOut() async {
    try {
      await _client.auth.signOut();
    } catch (_) {
      throw const AuthRepositoryException(
        'Could not sign out securely. Try again.',
        kind: AuthFailureKind.other,
      );
    }
  }

  static AuthSession? _mapSession(supabase.Session? session) {
    if (session == null || session.user.id.isEmpty) return null;
    return AuthSession(
      userId: session.user.id,
      email: session.user.email ?? '',
      isExpired: session.isExpired,
    );
  }
}

class MemoryAuthRepository implements AuthRepository {
  MemoryAuthRepository({
    AuthSession? restoredSession,
    this.signInSession,
    this.signInFailure,
    this.refreshFailure,
    this.signOutFailure,
  }) : _session = restoredSession;

  AuthSession? _session;
  AuthSession? signInSession;
  AuthRepositoryException? signInFailure;
  AuthRepositoryException? refreshFailure;
  AuthRepositoryException? signOutFailure;
  int signInCalls = 0;
  int refreshCalls = 0;
  int signOutCalls = 0;

  final StreamController<AuthEvent> _events =
      StreamController<AuthEvent>.broadcast();

  @override
  Stream<AuthEvent> get events => _events.stream;

  @override
  Future<AuthSession?> restoreSession() async => _session;

  @override
  Future<AuthSession> signIn({
    required String email,
    required String password,
  }) async {
    signInCalls += 1;
    final failure = signInFailure;
    if (failure != null) throw failure;
    final session = signInSession ??
        AuthSession(
          userId: 'memory-user',
          email: email.trim(),
          isExpired: false,
        );
    _session = session;
    _events.add(AuthEvent(AuthEventType.signedIn, session));
    return session;
  }

  @override
  Future<AuthSession?> refreshSession() async {
    refreshCalls += 1;
    final failure = refreshFailure;
    if (failure != null) throw failure;
    final current = _session;
    if (current == null) return null;
    final refreshed = AuthSession(
      userId: current.userId,
      email: current.email,
      isExpired: false,
    );
    _session = refreshed;
    _events.add(AuthEvent(AuthEventType.tokenRefreshed, refreshed));
    return refreshed;
  }

  @override
  Future<void> signOut() async {
    signOutCalls += 1;
    final failure = signOutFailure;
    if (failure != null) throw failure;
    _session = null;
    _events.add(const AuthEvent(AuthEventType.signedOut, null));
  }

  void emit(AuthEvent event) {
    _session = event.session;
    _events.add(event);
  }

  Future<void> dispose() => _events.close();
}
