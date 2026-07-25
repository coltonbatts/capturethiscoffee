import 'package:ctc_printer/board_cache.dart';
import 'package:ctc_printer/production_session.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/board_fixture.dart';

const _session = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'production-1',
  token: 'token',
);

const _otherProduction = ProductionSession(
  apiBase: 'https://coffee.capturethis.com',
  productionId: 'production-2',
  token: 'token',
);

const _otherServer = ProductionSession(
  apiBase: 'https://staging.capturethis.com',
  productionId: 'production-1',
  token: 'token',
);

CachedBoard _cached({DateTime? syncedAt, ProductionSession session = _session}) =>
    CachedBoard(
      apiBase: session.apiBase,
      productionId: session.productionId,
      syncedAt: syncedAt ?? DateTime.utc(2026, 7, 24, 9),
      board: boardFixture(
        name: 'Review Day',
        status: 'active',
        roster: [
          boardEntry(
            orderId: 'order-1',
            personName: 'Jamie Example',
            drink: 'Iced oat latte',
            group: 'Crew',
          ),
        ],
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('scoping', () {
    test('belongs to the session it was written for', () {
      expect(_cached().belongsTo(_session), isTrue);
    });

    test('does not belong to a different production', () {
      // Showing yesterday's roster under today's production name would be
      // worse than showing nothing.
      expect(_cached().belongsTo(_otherProduction), isFalse);
    });

    test('does not belong to a different server', () {
      expect(_cached().belongsTo(_otherServer), isFalse);
    });
  });

  group('persistence', () {
    test('round trips through preferences', () async {
      final repository = PreferencesBoardCacheRepository();
      final syncedAt = DateTime.utc(2026, 7, 24, 9, 30);
      await repository.write(_cached(syncedAt: syncedAt));

      final restored = await repository.read();

      expect(restored, isNotNull);
      expect(restored!.productionId, 'production-1');
      expect(restored.syncedAt.toUtc(), syncedAt);
      expect(restored.board.roster.single.person.name, 'Jamie Example');
    });

    test('preserves the sync time rather than the read time', () async {
      // The operator needs the age of the data, not the age of the app launch.
      final repository = PreferencesBoardCacheRepository();
      final syncedAt = DateTime.utc(2026, 7, 24, 6);
      await repository.write(_cached(syncedAt: syncedAt));

      expect((await repository.read())!.syncedAt.toUtc(), syncedAt);
    });

    test('clear removes the roster', () async {
      final repository = PreferencesBoardCacheRepository();
      await repository.write(_cached());
      await repository.clear();

      expect(await repository.read(), isNull);
    });

    test('reads null when nothing was ever written', () async {
      expect(await PreferencesBoardCacheRepository().read(), isNull);
    });
  });

  group('damaged cache', () {
    test('returns null for junk rather than throwing', () async {
      SharedPreferences.setMockInitialValues({
        'ctc_board_cache_v1': 'not json at all',
      });

      expect(await PreferencesBoardCacheRepository().read(), isNull);
    });

    test('returns null for a board an older build could not have written',
        () async {
      SharedPreferences.setMockInitialValues({
        'ctc_board_cache_v1':
            '{"apiBase":"https://x.test","productionId":"p","syncedAt":'
                '"2026-07-24T09:00:00.000Z","board":{"production":{}}}',
      });

      // A launch must never fail because of a stale cache format.
      expect(await PreferencesBoardCacheRepository().read(), isNull);
    });
  });
}
