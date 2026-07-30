import 'package:ctc_printer/workspace_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/board_fixture.dart';

void main() {
  test('memory repository completes the selected day', () async {
    final board = boardFixture(
      name: 'Closeout day',
      status: 'active',
      roster: const [],
    );
    final repository = MemoryWorkspaceRepository(
      boards: {board.production.id: board},
    );

    await repository.completeDay(productionId: board.production.id);

    expect(repository.completeDayCalls, 1);
    expect(
        repository.boards[board.production.id]?.production.status, 'complete');
  });

  test('memory repository preserves closeout failures', () async {
    const failure = WorkspaceRepositoryException(
      'Closeout refused.',
      kind: WorkspaceFailureKind.unauthorized,
    );
    final repository = MemoryWorkspaceRepository(
      completeDayFailure: failure,
    );

    expect(
      repository.completeDay(productionId: 'missing-day'),
      throwsA(same(failure)),
    );
    expect(repository.completeDayCalls, 1);
  });
}
