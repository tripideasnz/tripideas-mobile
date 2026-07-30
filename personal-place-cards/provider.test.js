import assert from 'node:assert/strict';
import {
  removePersonalPlaceCard,
  upsertPersonalPlaceCard,
} from './model.ts';

const card = {
  id: 'ppc_1', title: 'First', body: null, location: null, version: 1, media: [],
  readiness: { isTripIdeaReady: false, readinessIssues: ['missing_body'] },
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};
let state = upsertPersonalPlaceCard([], card);
assert.equal(state[0].title, 'First');
state = upsertPersonalPlaceCard(state, {
  ...card,
  title: 'Authoritative update',
  version: 2,
});
assert.equal(state.length, 1);
assert.equal(state[0].title, 'Authoritative update');
assert.equal(state[0].version, 2);
state = removePersonalPlaceCard(state, card.id);
assert.deepEqual(state, []);
console.log('✓ provider list/create/edit/delete projections use authoritative cards');
