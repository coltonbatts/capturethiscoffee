import 'dart:async';

import 'package:flutter/foundation.dart';

import 'auth_repository.dart';
import 'printer_controller.dart';
import 'session_controller.dart';
import 'supabase_config.dart';
import 'workspace_controller.dart';

/// Thin coordinator for the three domain owners. It decides which root surface
/// is visible, but contains no auth, board, or printer implementation.
class AppRuntime extends ChangeNotifier {
  AppRuntime({
    required this.configuration,
    required this.session,
    required this.workspace,
    required this.printer,
  }) {
    session.addListener(_handleSessionChanged);
    workspace.addListener(_handleChildChanged);
    printer.addListener(_handleChildChanged);
  }

  final SupabaseConfiguration configuration;
  final SessionController session;
  final WorkspaceController workspace;
  final PrinterController printer;

  bool _disposed = false;
  bool _started = false;
  bool _showLegacy = false;
  bool _suppressRestoredLegacy = false;
  String? _activatedUserId;
  Future<void>? _activationFuture;

  bool get isConfigured => configuration.isConfigured;
  bool get legacyOnly => workspace.legacyTestMode;

  bool get showLegacy {
    if (legacyOnly || _showLegacy) return true;
    return session.status == SessionStatus.signedOut &&
        !_suppressRestoredLegacy &&
        workspace.hasLegacySession;
  }

  Future<void> start() async {
    if (_started) return;
    _started = true;
    await Future.wait([
      workspace.start(),
      printer.start(),
      session.start(),
    ]);
    await _activateCurrentUser();
    _emit();
  }

  Future<bool> signIn(String email, String password) async {
    final signedIn = await session.signIn(email, password);
    if (!signedIn) return false;
    _suppressRestoredLegacy = false;
    _showLegacy = false;
    await _activateCurrentUser();
    _emit();
    return true;
  }

  Future<bool> signOut() async {
    final signedOut = await session.signOut();
    if (!signedOut) return false;
    _suppressRestoredLegacy = true;
    _showLegacy = false;
    _activatedUserId = null;
    workspace.deactivateUser();
    _emit();
    return true;
  }

  void enterLegacy() {
    _showLegacy = true;
    workspace.enterLegacy();
    _emit();
  }

  void leaveLegacy() {
    _showLegacy = false;
    _suppressRestoredLegacy = true;
    workspace.leaveLegacy();
    _activatedUserId = null;
    if (session.isSignedIn) unawaited(_activateCurrentUser());
    _emit();
  }

  Future<void> _activateCurrentUser() async {
    final user = session.session;
    if (!session.isSignedIn || user == null) return;
    if (_activatedUserId == user.userId &&
        workspace.mode == WorkspaceMode.authenticated) {
      await _activationFuture;
      return;
    }
    _activatedUserId = user.userId;
    final activation = workspace.activateUser(user.userId);
    _activationFuture = activation;
    try {
      await activation;
    } finally {
      if (identical(_activationFuture, activation)) {
        _activationFuture = null;
      }
    }
  }

  void _handleSessionChanged() {
    if (_disposed) return;
    final user = session.session;
    if (session.isSignedIn && user != null) {
      unawaited(_activateCurrentUser());
    } else if (_activatedUserId != null) {
      _activatedUserId = null;
      workspace.deactivateUser();
    }
    _emit();
  }

  void _handleChildChanged() => _emit();

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    session.removeListener(_handleSessionChanged);
    workspace.removeListener(_handleChildChanged);
    printer.removeListener(_handleChildChanged);
    printer.dispose();
    workspace.dispose();
    session.dispose();
    super.dispose();
  }
}

SessionController memorySignedOutSessionController() =>
    SessionController(MemoryAuthRepository());
