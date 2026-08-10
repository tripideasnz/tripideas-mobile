import assert from 'node:assert/strict';

import {
  createTripStorage,
  deletedTripIdsKey,
  tripCacheKey,
  tripMigrationJournalKey,
} from './storage.ts';

function memoryStorage() {
  const values = new Map();
  return {
    values,
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}

async function run() {
  const memory = memoryStorage();
  const storage = createTripStorage(memory);
  const trip = {
    id: 'itn_one',
    name: 'One',
    note: '',
    createdAt: 'created',
    updatedAt: 'updated',
    places: [{
      addedAt: 'added',
      entryId: 'ite_one',
      note: 'note',
      placeId: 'place',
    }],
  };
  await storage.setCache('user-one', [trip]);
  await storage.setCache('user-two', [{ ...trip, id: 'itn_two', name: 'Two' }]);
  assert.equal((await storage.getCache('user-one'))[0].name, 'One');
  assert.equal((await storage.getCache('user-two'))[0].name, 'Two');
  assert.notEqual(tripCacheKey('user-one'), tripCacheKey('user-two'));
  await storage.addDeletedTripId('user-one', 'itn_deleted');
  await storage.addDeletedTripId('user-one', 'itn_deleted');
  assert.deepEqual(await storage.getDeletedTripIds('user-one'), ['itn_deleted']);
  assert.equal(await storage.getDeletedTripIds('user-two').then((ids) => ids.length), 0);
  assert.notEqual(deletedTripIdsKey('user-one'), deletedTripIdsKey('user-two'));

  const journal = {
    acceptedAt: 'now',
    entries: [],
    sourceFingerprint: 'fingerprint',
    userId: 'user-one',
    version: 1,
  };
  await storage.setJournal('user-one', journal);
  assert.deepEqual(await storage.getJournal('user-one'), journal);
  assert.equal(await storage.getJournal('user-two'), null);
  assert.notEqual(
    tripMigrationJournalKey('user-one'),
    tripMigrationJournalKey('user-two')
  );
  await storage.setClaim({ sourceFingerprint: 'fingerprint', userId: 'user-one' });
  assert.deepEqual(await storage.getClaim(), {
    sourceFingerprint: 'fingerprint',
    userId: 'user-one',
  });
  assert.equal(
    Array.from(memory.values.values()).some((value) =>
      String(value).includes('accessToken')
    ),
    false
  );
  console.log('✓ Trip cache, journal, mapping claim, and account isolation');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
