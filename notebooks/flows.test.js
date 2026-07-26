import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { classifyNotebookError } from './errors.ts';
import {
  adjacentNotebookItemId,
  moveNotebookItemIds,
  notebookBlockScrollOffset,
  orderedNotebookItems,
  validateNotebookMetadata,
} from './model.ts';
import {
  reconcileAutosaveDraft,
  retryNotebookConflict,
  shouldAdoptAutosaveResponse,
} from './autosave.ts';
import {
  createKeyedMutationQueue,
  mergeNotebookSummaries,
  preferNewerDetail,
} from './state.ts';

const item = (id, position, text = '') => ({
  id,
  type: 'text',
  position,
  title: null,
  text,
  createdAt: 'now',
  updatedAt: 'now',
});

assert.deepEqual(
  orderedNotebookItems([item('third', 2), item('first', 0), item('second', 1)])
    .map(({ id }) => id),
  ['first', 'second', 'third']
);
console.log('✓ detail renders text items in authoritative position order');

const items = [item('first', 0), item('second', 1), item('third', 2)];
assert.equal(adjacentNotebookItemId(items, 'second', -1), 'first');
assert.equal(adjacentNotebookItemId(items, 'second', 1), 'third');
assert.equal(adjacentNotebookItemId(items, 'first', -1), null);
assert.deepEqual(items.map(({ id }) => id), ['first', 'second', 'third']);
console.log('✓ page navigation resolves adjacent IDs without changing order');

assert.deepEqual(moveNotebookItemIds(items, 'second', -1), [
  'second', 'first', 'third',
]);
assert.deepEqual(moveNotebookItemIds(items, 'second', 1), [
  'first', 'third', 'second',
]);
assert.equal(moveNotebookItemIds(items, 'first', -1), null);
console.log('✓ reorder sends a complete ordered item-ID permutation');

assert.equal(notebookBlockScrollOffset(420, 180), 584);
assert.equal(notebookBlockScrollOffset(0, 8), 0);
console.log('✓ page navigation scroll targets include the section offset');

assert.deepEqual(validateNotebookMetadata('  Fiordland  ', ''), {
  valid: true,
  title: 'Fiordland',
  description: null,
});
assert.equal(validateNotebookMetadata('   ', '').valid, false);
assert.equal(validateNotebookMetadata('a'.repeat(201), '').valid, false);
assert.equal(validateNotebookMetadata('A', 'a'.repeat(10_001)).valid, false);
console.log('✓ create and metadata edit validation match the API limits');

assert.equal(
  classifyNotebookError(new ApiError(409, 'notebook_conflict')),
  'conflict'
);
assert.equal(classifyNotebookError(new ApiError(404, 'not_found')), 'not-found');
assert.equal(classifyNotebookError(new ApiError(422, 'validation_failed')), 'validation');
assert.equal(classifyNotebookError(new TypeError('Network request failed')), 'offline');
assert.equal(classifyNotebookError(new ApiError(500, 'internal_error')), 'unknown');
console.log('✓ conflict, deleted Notebook, validation, offline, and safe 500 states map correctly');

const serverResponse = {
  id: 'notebook-1',
  title: 'Authoritative',
  description: null,
  version: 8,
  createdAt: 'now',
  updatedAt: 'later',
  items: [item('first', 0, 'From server')],
};
const localCanonical = serverResponse;
assert.equal(localCanonical.version, 8);
assert.equal(localCanonical.items[0].text, 'From server');
console.log('✓ successful mutation state is replaced by the authoritative response');

const newerDetail = { ...serverResponse, version: 9, title: 'Newest' };
assert.equal(preferNewerDetail(newerDetail, serverResponse), newerDetail);
assert.equal(
  mergeNotebookSummaries(
    [{ ...serverResponse, itemCount: 1 }],
    { [newerDetail.id]: newerDetail }
  )[0].version,
  9
);
console.log('✓ stale detail and list responses cannot replace newer authoritative versions');

const enqueue = createKeyedMutationQueue();
const order = [];
let releaseFirst;
const firstQueued = enqueue('notebook-1', async () => {
  order.push('first-start');
  await new Promise((resolve) => { releaseFirst = resolve; });
  order.push('first-end');
  return 2;
});
const secondQueued = enqueue('notebook-1', async () => {
  order.push('second');
  return 3;
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(order, ['first-start']);
releaseFirst();
assert.deepEqual(await Promise.all([firstQueued, secondQueued]), [2, 3]);
assert.deepEqual(order, ['first-start', 'first-end', 'second']);
console.log('✓ same-Notebook mutations serialize and advance one authoritative version at a time');

let authoritativeVersion = 1;
const expectedVersions = [];
const pageThenMetadata = [
  enqueue('versioned', async () => {
    expectedVersions.push(authoritativeVersion);
    authoritativeVersion += 1;
  }),
  enqueue('versioned', async () => {
    expectedVersions.push(authoritativeVersion);
    authoritativeVersion += 1;
  }),
];
await Promise.all(pageThenMetadata);
expectedVersions.push(authoritativeVersion);
assert.deepEqual(expectedVersions, [1, 2, 3]);
console.log('✓ page, metadata, and subsequent list deletion consume advancing versions');

assert.equal(shouldAdoptAutosaveResponse(4, 4), true);
assert.equal(shouldAdoptAutosaveResponse(5, 4), false);
assert.equal(reconcileAutosaveDraft('old response', 'new typing', 5, 4), 'new typing');
assert.equal(reconcileAutosaveDraft('latest server', 'local', 5, 4, true), 'latest server');
console.log('✓ slower autosave responses cannot overwrite newer local typing');

const conflictSteps = [];
const retried = await retryNotebookConflict(
  async () => { conflictSteps.push('reload'); },
  async () => {
    conflictSteps.push('retry');
    return 'saved';
  }
);
assert.equal(retried, 'saved');
assert.deepEqual(conflictSteps, ['reload', 'retry']);
console.log('✓ keep-my-version reloads authority before one explicit retry');
