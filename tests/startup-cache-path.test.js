import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { BookCache } from '../src/book-cache.js';
import { SyncManager } from '../src/sync-manager.js';

const user = {
  id: 'recovery-test',
  abs_url: 'https://example.invalid',
  abs_token: 'test-token',
  hardcover_token: 'test-token',
};
const title = 'Recovery Test';
const author = 'Test Author';
const identifier = 'B012345678';

async function setup(t, { dryRun = false, pages = false, pending = 40 } = {}) {
  const manager = new SyncManager(
    user,
    {
      delayed_updates: { enabled: true },
    },
    dryRun,
  );
  const cache = new BookCache(':memory:');
  manager.cache = cache;
  manager.sessionManager.cache = cache;
  manager.bookMatcher.cache = cache;
  t.after(() => cache.close());
  const edition = {
    id: 222,
    ...(pages ? { pages: 300 } : { audio_seconds: 10000 }),
    reading_format: { format: pages ? 'Read' : 'Listened' },
  };
  const library = [
    { id: 111, edition_id: 222, book: { id: 333, title, editions: [edition] } },
  ];
  manager.hardcover.getUserBooks = mock.fn(async () => library);
  manager.hardcover.getBookCurrentProgress = mock.fn(async () => ({
    has_progress: false,
  }));
  manager.hardcover.updateReadingProgress = mock.fn(async () => ({ id: 444 }));
  manager.hardcover.markBookCompleted = mock.fn(async () => true);
  manager.audiobookshelf.getReadingProgress = mock.fn(async () => []);
  manager.bookMatcher.findMatch = mock.fn(async () => {
    throw new Error(
      'Recovery must use the cached edition in the current library',
    );
  });
  await cache.storeBookSyncData(
    user.id,
    identifier,
    title,
    edition.id,
    'asin',
    author,
    20,
    null,
    '2026-01-01T00:00:00.000Z',
    2,
    edition.id,
  );
  await cache.updateSessionProgress(
    user.id,
    identifier,
    title,
    pending,
    'asin',
  );
  cache.db
    .prepare('UPDATE books SET session_last_change = ?')
    .run('2026-01-02T00:00:00.000Z');
  return { manager, cache, edition };
}

async function assertPending(cache, expected = 40) {
  const sessions = await cache.getActiveSessions(user.id);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].session_pending_progress, expected);
  assert.equal(
    await cache.getLastProgress(user.id, identifier, title, 'asin'),
    20,
  );
}

describe('Session recovery through normal sync', () => {
  for (const pages of [false, true]) {
    it(`recovers using real IDs and ${pages ? 'pages' : 'seconds'} even with no current ABS items`, async t => {
      const { manager, cache } = await setup(t, { pages });
      const result = await manager.syncProgress();
      const calls = manager.hardcover.updateReadingProgress.mock.calls;
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].arguments.slice(0, 6), [
        111,
        pages ? 120 : 4000,
        40,
        222,
        !pages,
        '2026-01-01',
      ]);
      assert.equal((await cache.getActiveSessions(user.id)).length, 0);
      assert.equal(
        await cache.getLastProgress(user.id, identifier, title, 'asin'),
        40,
      );
      assert.equal(result.expired_sessions_processed, 1);
      assert.equal(manager.bookMatcher.findMatch.mock.callCount(), 0);
    });
  }

  for (const response of [
    null,
    false,
    { _statusInfo: { currentStatusId: 2 } },
  ]) {
    it(`retains pending progress after an unconfirmed write (${JSON.stringify(response)})`, async t => {
      const { manager, cache } = await setup(t);
      manager.hardcover.updateReadingProgress = mock.fn(async () => response);
      await manager.syncProgress();
      await assertPending(cache);
      // The next run must retry instead of treating the failed update as synced.
      manager.hardcover.updateReadingProgress = mock.fn(async () => ({
        id: 444,
      }));
      await manager.syncProgress();
      assert.equal(manager.hardcover.updateReadingProgress.mock.callCount(), 1);
      assert.equal((await cache.getActiveSessions(user.id)).length, 0);
    });
  }

  it('does not write or consume sessions in dry-run mode', async t => {
    const { manager, cache } = await setup(t, { dryRun: true });
    await manager.syncProgress();
    await assertPending(cache);
    assert.equal(manager.hardcover.updateReadingProgress.mock.callCount(), 0);
    assert.equal(manager.hardcover.markBookCompleted.mock.callCount(), 0);
  });

  it('retains sessions whose cached edition is absent from the library', async t => {
    const { manager, cache } = await setup(t);
    manager.hardcover.getUserBooks = mock.fn(async () => []);
    await manager.syncProgress();
    await assertPending(cache);
    assert.equal(manager.hardcover.updateReadingProgress.mock.callCount(), 0);
  });

  it('retains sessions when fetching the current library fails', async t => {
    const { manager, cache } = await setup(t);
    manager.hardcover.getUserBooks = mock.fn(async () => {
      throw new Error('Library unavailable');
    });
    await manager.syncProgress();
    await assertPending(cache);
  });

  it('preserves regression protection during recovery', async t => {
    const { manager, cache, edition } = await setup(t);
    manager.hardcover.getBookCurrentProgress = mock.fn(async () => ({
      has_progress: true,
      latest_read: { progress_seconds: 9900, edition },
    }));
    await manager.syncProgress();
    await assertPending(cache);
    assert.equal(manager.hardcover.updateReadingProgress.mock.callCount(), 0);
  });

  it('uses the normal completion handler for completed sessions', async t => {
    const { manager, cache } = await setup(t, { pending: 100 });
    await manager.syncProgress();
    assert.equal(manager.hardcover.markBookCompleted.mock.callCount(), 1);
    assert.deepEqual(
      manager.hardcover.markBookCompleted.mock.calls[0].arguments.slice(0, 4),
      [111, 222, 10000, true],
    );
    assert.equal((await cache.getActiveSessions(user.id)).length, 0);
    assert.equal(
      await cache.getLastProgress(user.id, identifier, title, 'asin'),
      100,
    );
  });
});
