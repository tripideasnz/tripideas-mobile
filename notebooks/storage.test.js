import assert from 'node:assert/strict';

import {
  createNotebookStorage,
  notebookDetailKey,
  notebookListKey,
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

const first = memoryStorage();
const cache = createNotebookStorage(first);
const detail = {
  id: 'notebook-1',
  title: 'A',
  description: null,
  version: 1,
  createdAt: 'now',
  updatedAt: 'now',
  items: [],
};

await cache.setList('user-a', [{ ...detail, itemCount: 0 }]);
await cache.setDetail('user-a', detail);
assert.equal((await cache.getList('user-b')).length, 0);
assert.equal(await cache.getDetail('user-b', detail.id), null);
assert.equal((await cache.getDetail('user-a', detail.id))?.title, 'A');
console.log('✓ cache is namespaced by authenticated user');

await cache.clearUser('user-a');
assert.equal(first.values.has(notebookListKey('user-a')), false);
assert.equal(first.values.has(notebookDetailKey('user-a', detail.id)), false);
console.log('✓ sign-out cleanup removes the readable list and detail cache');

first.values.set(notebookListKey('user-a'), 'not json');
assert.deepEqual(await cache.getList('user-a'), []);
console.log('✓ corrupt cached lists fail closed');
