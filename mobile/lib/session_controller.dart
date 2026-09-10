import 'dart:async';

import 'package:flutter/foundation.dart';

import 'auth_repository.dart';

enum SessionStatus {
  restoring,
  signedOut,
  signedIn,
}

class SessionController extends ChangeNotifier {
  SessionController(this._repository);

  final AuthRepository _repository;
  StreamSubscription<AuthEvent>? _subscription;
  bool _disposed = false;
  int _generation = 0;
  bool _busy = false;
  SessionStatus _status = SessionStatus.restoring;
  AuthSession? _session;
  String? _error;
  String? _warning;

  SessionStatus get status => _status;
  AuthSession? get session => _session;
  bool get busy => _busy;
  bool get isSignedIn => _status == SessionStatus.signedIn && _session != null;
  String? get error => _error;
  String? get warning => _warning;

  Future<void> start() async {
    _subscription = _repository.events.listen(
      _handleAuthEvent,
      onError: (Object _, StackTrace __) {
        // Supabase emits offline token-refresh failures as stream errors.
        // They are not sign-out events and must never be treated as one.
        _warning =
            'Session refresh is waiting for a connection. Cached work remains available.';
        _emit();
      },
    );

    try {
      final restored = await _repository.restoreSession();
      if (_disposed) return;
      _session = restored;
      _status =
          restored == null ? SessionStatus.signedOut : SessionStatus.signedIn;
      _emit();
      if (restored?.isExpired == true) {
        unawaited(refresh());
      }
    } catch (_) {
      if (_disposed) return;
      _status = SessionStatus.signedOut;
      _error = 'Could not restore the saved sign-in securely.';
      _emit();
    }
  }

  Future<bool> signIn(String email, String password) async {
    if (_busy) return false;
    final normalizedEmail = email.trim();
    if (normalizedEmail.isEmpty || password.isEmpty) {
      _error = 'Enter the owner-provisioned email and password.';
      _emit();
      return false;
    }

    ++_generation;
    _busy = true;
    _error = null;
    _warning = null;
    _emit();
    try {
      final session = await _repository.signIn(
        email: normalizedEmail,
        password: password,
      );
      if (_disposed) return false;
      _session = session;
      _status = SessionStatus.signedIn;
      _emit();
      return true;
    } on AuthRepositoryException catch (error) {
      if (_disposed) return false;
      _error = error.message;
      _emit();
      return false;
    } catch (_) {
      if (_disposed) return false;
      _error = 'Could not sign in. Try again.';
      _emit();
      return false;
    } finally {
      _busy = false;
      _emit();
    }
  }

  Future<void> refresh() async {
    final existing = _session;
    final generation = _generation;
    if (existing == null) return;
    try {
      final refreshed = await _repository.refreshSession();
      if (_disposed || generation != _generation) return;
      if (refreshed != null) {
        _session = refreshed;
        _status = SessionStatus.signedIn;
        _warning = null;
        _emit();
      }
    } on AuthRepositoryException catch (error) {
      if (_disposed || generation != _generation) return;
      if (error.kind == AuthFailureKind.invalidSession) {
        ++_generation;
        _session = null;
        _status = SessionStatus.signedOut;
        _error = error.message;
        _emit();
        return;
      }
      // A network refresh failure does not erase the locally restored identity. RLS will
      // reject reads if it is truly invalid; cached day data stays isolated by
      // this user ID and available for offline printing.
      _warning = error.kind == AuthFailureKind.network
          ? 'Session refresh is waiting for a connection. Cached work remains available.'
          : 'The saved session needs a connection before it can be verified.';
      _emit();
    }
  }

  Future<bool> signOut() async {
    if (_busy) return false;
    ++_generation;
    _busy = true;
    _error = null;
    _emit();
    try {
      await _repository.signOut();
      if (_disposed) return false;
      _session = null;
      _status = SessionStatus.signedOut;
      _warning = null;
      _emit();
      return true;
    } on AuthRepositoryException catch (error) {
      if (_disposed) return false;
      _error = error.message;
      _emit();
      return false;
    } finally {
      _busy = false;
      _emit();
    }
  }

  void dismissMessage() {
    if (_error == null && _warning == null) return;
    _error = null;
    _warning = null;
    _emit();
  }

  void _handleAuthEvent(AuthEvent event) {
    if (_disposed) return;
    if (event.type == AuthEventType.signedOut) {
      ++_generation;
      _session = null;
      _status = SessionStatus.signedOut;
      _emit();
      return;
    }
    final next = event.session;
    if (next != null) {
      if (event.type == AuthEventType.tokenRefreshed &&
          (_session == null || next.userId != _session!.userId)) {
        return;
      }
      if (next.userId != _session?.userId) ++_generation;
      _session = next;
      _status = SessionStatus.signedIn;
      _warning = null;
      _emit();
    }
  }

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(_subscription?.cancel());
    super.dispose();
  }
}
