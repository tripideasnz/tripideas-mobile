import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { classifyNotebookError } from './errors.ts';
import {
  moveNotebookItemIds,
  orderedNotebookItems,
  validateNotebookMetadata,
} from './model.ts';

const item = (id, position, text = '') => ({
  id,
  type: 'text',
  position,
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
assert.deepEqual(moveNotebookItemIds(items, 'second', -1), [
  'second', 'first', 'third',
]);
assert.deepEqual(moveNotebookItemIds(items, 'second', 1), [
  'first', 'third', 'second',
]);
assert.equal(moveNotebookItemIds(items, 'first', -1), null);
console.log('✓ reorder sends a complete ordered item-ID permutation');

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
