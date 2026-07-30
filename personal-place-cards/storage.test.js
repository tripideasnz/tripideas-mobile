import assert from 'node:assert/strict';
import { createPersonalPlaceCardStorage } from './storage.ts';

const card = {
  id: 'ppc_1', title: null, body: null, location: null, version: 1, media: [],
  readiness: { isTripIdeaReady: false, readinessIssues: ['missing_title'] },
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};
async function run() {
  const values = new Map();
  const storage = createPersonalPlaceCardStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async (key) => values.delete(key),
  });
  await storage.set('user-one', [card]);
  await storage.set('user-two', [{ ...card, id: 'ppc_2' }]);
  assert.equal((await storage.get('user-one'))[0].id, 'ppc_1');
  assert.equal((await storage.get('user-two'))[0].id, 'ppc_2');
  await storage.clear('user-one');
  assert.deepEqual(await storage.get('user-one'), []);
  assert.equal((await storage.get('user-two')).length, 1);
  console.log('✓ Personal Place Card cache isolation and sign-out cleanup primitive');
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
