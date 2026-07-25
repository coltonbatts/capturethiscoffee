import 'package:ctc_printer/auth_repository.dart';
import 'package:ctc_printer/session_controller.dart';
import 'package:flutter_test/flutter_test.dart';

const _restored = AuthSession(
  userId: 'owner-1',
  email: 'owner@example.com',
  isExpired: false,
);

void main() {
  test('restores a persisted signed-in session', () async {
    final repository = MemoryAuthRepository(restoredSession: _restored);
    final controller = SessionController(repository);
    addTearDown(controller.dispose);
    addTearDown(repository.dispose);

    await controller.start();

    expect(controller.status, SessionStatus.signedIn);
    expect(controller.session?.userId, 'owner-1');
  });

  test('sign-in success and failure are typed and sanitized', () async {
    final repository = MemoryAuthRepository(
      signInFailure: const AuthRepositoryException(
        'Email or password is incorrect.',
        kind: AuthFailureKind.invalidCredentials,
      ),
    );
    final controller = SessionController(repository);
    addTearDown(controller.dispose);
    addTearDown(repository.dispose);
    await controller.start();

    expect(await controller.signIn('owner@example.com', 'wrong'), isFalse);
    expect(controller.status, SessionStatus.signedOut);
    expect(controller.error, 'Email or password is incorrect.');

    repository.signInFailure = null;
    expect(await controller.signIn('owner@example.com', 'correct'), isTrue);
    expect(controller.status, SessionStatus.signedIn);
    expect(repository.signInCalls, 2);
  });

  test('offline refresh failure keeps the restored identity signed in',
      () async {
    final repository = MemoryAuthRepository(
      restoredSession: const AuthSession(
        userId: 'owner-1',
        email: 'owner@example.com',
        isExpired: true,
      ),
      refreshFailure: const AuthRepositoryException(
        'offline',
        kind: AuthFailureKind.network,
      ),
    );
    final controller = SessionController(repository);
    addTearDown(controller.dispose);
    addTearDown(repository.dispose);

    await controller.start();
    await Future<void>.delayed(Duration.zero);

    expect(controller.status, SessionStatus.signedIn);
    expect(controller.session?.userId, 'owner-1');
    expect(controller.warning, contains('Cached work remains available'));
  });
}
