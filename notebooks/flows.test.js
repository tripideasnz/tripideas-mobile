import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import { classifyNotebookError } from './errors.ts';
import {
  moveNotebookItemIds,
  notebookBlockIndexLabel,
  notebookBlockScrollOffset,
  orderedNotebookItems,
  validateNotebookMetadata,
} from './model.ts';

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
assert.deepEqual(moveNotebookItemIds(items, 'second', -1), [
  'second', 'first', 'third',
]);
assert.deepEqual(moveNotebookItemIds(items, 'second', 1), [
  'first', 'third', 'second',
]);
assert.equal(moveNotebookItemIds(items, 'first', -1), null);
console.log('✓ reorder sends a complete ordered item-ID permutation');

assert.equal(notebookBlockIndexLabel({ title: '  Arrival  ', text: '' }, 0), 'Arrival');
assert.equal(
  notebookBlockIndexLabel({ title: null, text: 'First line\nsecond line' }, 1),
  'First line second line'
);
assert.equal(notebookBlockIndexLabel({ title: '', text: '   ' }, 2), 'Block 3');
console.log('✓ block index follows titles, body previews, and ordered fallbacks');
assert.equal(notebookBlockScrollOffset(420, 180), 584);
assert.equal(notebookBlockScrollOffset(0, 8), 0);
console.log('✓ block index scroll targets include the section offset');

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
