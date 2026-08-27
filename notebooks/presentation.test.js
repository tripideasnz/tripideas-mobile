import assert from 'node:assert/strict';

import { groupContiguousNotebookPhotos, moveContiguousNotebookBlockIds } from './presentation.ts';

const base = { createdAt: '2026-08-26T00:00:00.000Z', position: 0, updatedAt: '2026-08-26T00:00:00.000Z' };
const photo = (id, position) => ({ ...base, id, position, type: 'photo', photoAssetId: `asset-${id}`, clientRequestId: `request-${id}` });
const text = (id, position) => ({ ...base, id, position, type: 'text', role: 'content', title: null, text: id });

assert.deepEqual(groupContiguousNotebookPhotos([photo('one', 0)]).map((item) => item.kind), ['photos']);
assert.deepEqual(groupContiguousNotebookPhotos([photo('one', 0)])[0].blocks.map(({ id }) => id), ['one']);

const contiguous = groupContiguousNotebookPhotos([photo('one', 0), photo('two', 1), photo('three', 2)]);
assert.equal(contiguous.length, 1);
assert.deepEqual(contiguous[0].blocks.map(({ id }) => id), ['one', 'two', 'three']);

const mixed = groupContiguousNotebookPhotos([photo('one', 0), text('middle', 1), photo('two', 2)]);
assert.deepEqual(mixed.map((item) => item.kind), ['photos', 'object', 'photos']);
assert.deepEqual(mixed.flatMap((item) => item.kind === 'photos' ? item.blocks.map(({ id }) => id) : [item.block.id]), ['one', 'middle', 'two']);

console.log('✓ one photo, contiguous photo grids, and non-adjacent mixed order preserve authoritative block identity and order');

const object = (id, position, type) => type === 'photo' ? photo(id, position) : ({ ...text(id, position), type });
const vocabulary = ['text', 'photo', 'link', 'place', 'pin'].map((type, position) => object(type, position, type));
assert.deepEqual(moveContiguousNotebookBlockIds(vocabulary, ['text'], 1), ['photo', 'text', 'link', 'place', 'pin']);
assert.deepEqual(moveContiguousNotebookBlockIds(vocabulary, ['photo'], 1), ['text', 'link', 'photo', 'place', 'pin']);
assert.deepEqual(moveContiguousNotebookBlockIds(vocabulary, ['link'], -1), ['text', 'link', 'photo', 'place', 'pin']);
assert.deepEqual(moveContiguousNotebookBlockIds(vocabulary, ['place'], 1), ['text', 'photo', 'link', 'pin', 'place']);
assert.deepEqual(moveContiguousNotebookBlockIds(vocabulary, ['pin'], -1), ['text', 'photo', 'link', 'pin', 'place']);
const movedPhotoGrid = moveContiguousNotebookBlockIds([text('before', 0), photo('one', 1), photo('two', 2), text('after', 3)], ['one', 'two'], 1);
assert.deepEqual(movedPhotoGrid, ['before', 'after', 'one', 'two']);
assert.deepEqual(groupContiguousNotebookPhotos(movedPhotoGrid.map((id, position) => id === 'one' || id === 'two' ? photo(id, position) : text(id, position))).map((item) => item.kind), ['object', 'object', 'photos']);
console.log('✓ drag-order helpers reorder every Notebook object type and keep a moved contiguous photo grid ordered');
