import 'package:ctc_printer/authenticated_workspace_cache.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/board_fixture.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('selected days persist independently per authenticated user', () async {
    final repository = PreferencesSelectedDayRepository();
    await repository.write('user-a', 'day-a');
    await repository.write('user-b', 'day-b');

    expect(await repository.read('user-a'), 'day-a');
    expect(await repository.read('user-b'), 'day-b');
  });

  test('board caches are isolated by user and production', () async {
    final repository = PreferencesAuthenticatedBoardCacheRepository();
    await repository.write(AuthenticatedCachedBoard(
      userId: 'user-a',
      productionId: 'same-day-id',
      syncedAt: DateTime.utc(2026, 7, 25),
      board: boardFixture(
        name: 'User A day',
        status: 'active',
        roster: const [],
      ),
    ));
    await repository.write(AuthenticatedCachedBoard(
      userId: 'user-b',
      productionId: 'same-day-id',
      syncedAt: DateTime.utc(2026, 7, 25, 1),
      board: boardFixture(
        name: 'User B day',
        status: 'active',
        roster: const [],
      ),
    ));

    expect(
      (await repository.read(
        userId: 'user-a',
        productionId: 'same-day-id',
      ))
          ?.board
          .production
          .name,
      'User A day',
    );
    expect(
      (await repository.read(
        userId: 'user-b',
        productionId: 'same-day-id',
      ))
          ?.board
          .production
          .name,
      'User B day',
    );
    expect(
      await repository.read(
        userId: 'user-c',
        productionId: 'same-day-id',
      ),
      isNull,
    );
  });
}
