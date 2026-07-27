import assert from 'node:assert/strict';
import { createElement } from 'react';

import {
  adjacentContentBlockId,
  moveContentBlockIds,
  orderedContentBlocks,
} from './ordering.ts';
import {
  adjacentContentPageId,
  pagesFromContentBlocks,
} from './pages.ts';
import { parseContentBlock } from './registry.ts';
import { renderContentBlock } from './renderer.tsx';

const readers = {
  integer(value) {
    if (!Number.isInteger(value)) throw new Error('integer');
    return value;
  },
  nullableString(value) {
    if (value === null) return null;
    return this.string(value);
  },
  object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('object');
    }
    return value;
  },
  string(value) {
    if (typeof value !== 'string') throw new Error('string');
    return value;
  },
};

const textBlock = (id, position, text = '') => ({
  id,
  type: 'text',
  position,
  title: null,
  text,
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z',
});

assert.deepEqual(parseContentBlock(textBlock('text-1', 0, 'Milford'), readers), {
  ...textBlock('text-1', 0, 'Milford'),
});
assert.throws(
  () => parseContentBlock({ ...textBlock('photo-1', 0), type: 'photo' }, readers),
  /unsupported_content_block/
);
console.log('✓ the registry parses Text blocks and rejects unregistered block types');

const source = [
  textBlock('third', 2),
  textBlock('first', 0),
  textBlock('second', 1),
];
const ordered = orderedContentBlocks(source);
assert.deepEqual(ordered.map(({ id }) => id), ['first', 'second', 'third']);
assert.deepEqual(source.map(({ id }) => id), ['third', 'first', 'second']);
assert.equal(adjacentContentBlockId(source, 'third', -1), 'second');
assert.equal(adjacentContentBlockId(source, 'third', 1), null);
assert.deepEqual(moveContentBlockIds(source, 'second', 1), [
  'first',
  'third',
  'second',
]);
assert.equal(moveContentBlockIds(source, 'missing', 1), null);
console.log('✓ generic ordering uses stable IDs without mutating block collections');

const pages = pagesFromContentBlocks(source);
assert.deepEqual(pages.map(({ id }) => id), ['first', 'second', 'third']);
assert.deepEqual(pages.map(({ blocks }) => blocks.length), [1, 1, 1]);
assert.equal(pages[0].blocks[0].position, 0);
assert.equal(pages[0].blocks[0].id, pages[0].id);
assert.equal(adjacentContentPageId(pages, 'third', -1), 'second');
console.log('✓ Phase 1 items project into ordered Pages containing Text blocks');

let renderedBlock;
let renderedIndex;
const rendered = renderContentBlock(textBlock('text-2', 4), 3, {
  text(block, index) {
    renderedBlock = block;
    renderedIndex = index;
    return createElement('TextBlock', { blockId: block.id });
  },
});
assert.equal(renderedBlock.id, 'text-2');
assert.equal(renderedIndex, 3);
assert.equal(rendered.type, 'TextBlock');
assert.equal(rendered.props.blockId, 'text-2');
console.log('✓ the generic renderer dispatches Text through its registered renderer');
