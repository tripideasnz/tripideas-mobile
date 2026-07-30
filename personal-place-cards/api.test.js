import assert from 'node:assert/strict';
import { ApiError, setActiveToken } from '../lib/api-client.ts';
import {
  attachPersonalPlaceCardMedia,
  createPersonalPlaceCard,
  deletePersonalPlaceCard,
  listPersonalPlaceCards,
  parsePersonalPlaceCard,
  removePersonalPlaceCardMedia,
  reorderPersonalPlaceCardMedia,
  updatePersonalPlaceCard,
} from './api.ts';
import { personalPlaceCardError, readinessMessage } from './errors.ts';

const card = {
  id: 'ppc_1',
  title: 'Hidden beach',
  body: 'A quiet stop.',
  location: {
    latitude: -36.8,
    longitude: 174.7,
    source: 'USER_SELECTED',
    confirmed: true,
    confirmedAt: '2026-07-30T00:00:00.000Z',
  },
  version: 3,
  media: [{
    id: 'ppcm_1',
    photoAssetId: 'photo_1',
    role: 'main',
    position: null,
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  }],
  readiness: { isTripIdeaReady: true, readinessIssues: [] },
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

const originalFetch = globalThis.fetch;
async function run() {
  assert.equal(parsePersonalPlaceCard(card).location.confirmed, true);
  assert.throws(
    () => parsePersonalPlaceCard({ ...card, media: [{ role: 'unknown' }] }),
    ApiError
  );
  const calls = [];
  setActiveToken('token');
  globalThis.fetch = async (input, init) => {
    calls.push([String(input), init]);
    if (!init?.method) return Response.json({ cards: [card] });
    if (init.method === 'DELETE' && !String(input).includes('/media/')) {
      return Response.json({
        id: card.id,
        state: 'deleted',
        version: 4,
        deletedAt: card.updatedAt,
      });
    }
    return Response.json({ ...card, version: card.version + 1 });
  };
  assert.equal((await listPersonalPlaceCards())[0].id, card.id);
  await createPersonalPlaceCard({ clientRequestId: 'stable', title: 'One' });
  await updatePersonalPlaceCard(card.id, 3, { body: 'Changed' });
  await attachPersonalPlaceCardMedia(card.id, {
    expectedVersion: 3,
    photoAssetId: 'photo_2',
    position: 0,
    role: 'body',
  });
  await removePersonalPlaceCardMedia(card.id, 'ppcm_1', 3);
  await reorderPersonalPlaceCardMedia(card.id, 3, ['ppcm_2', 'ppcm_3']);
  await deletePersonalPlaceCard(card.id, 3);
  assert.equal(calls.every(([, init]) =>
    new Headers(init?.headers).get('Authorization') === 'Bearer token'
  ), true);
  assert.deepEqual(JSON.parse(calls[3][1].body), {
    expectedVersion: 3,
    photoAssetId: 'photo_2',
    position: 0,
    role: 'body',
  });

  assert.match(readinessMessage(['missing_title', 'location_not_confirmed']), /title/);
  assert.match(personalPlaceCardError(new ApiError(
    409,
    'personal_place_card_attached',
    'safe',
    { activeAttachmentCount: 2 }
  )), /2 active Trips/);
  assert.match(personalPlaceCardError(new ApiError(
    409,
    'personal_place_card_attached_invalid',
    'safe',
    { readinessIssues: ['missing_eligible_main_photo'] }
  )), /main photo/);
  console.log('✓ Personal Place Card DTO, contracts, readiness, and guards');
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  globalThis.fetch = originalFetch;
  setActiveToken(null);
});
