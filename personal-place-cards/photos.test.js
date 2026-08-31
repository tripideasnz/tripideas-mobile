import assert from 'node:assert/strict';
import {
  personalPlaceBodyPhotoCount,
  reconcilePendingPersonalPlacePhotos,
} from './photo-reconciliation.ts';
import { hasAttachedPhoto } from './model.ts';

const card = {
  id: 'ppc_1', title: null, body: null, location: null, version: 2,
  readiness: { isTripIdeaReady: false, readinessIssues: [] },
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  media: [{
    id: 'media_1',
    photoAssetId: 'photo_1',
    role: 'main',
    position: null,
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  }],
};
assert.equal(hasAttachedPhoto(card, 'photo_1'), true);
assert.equal(hasAttachedPhoto(card, 'photo_2'), false);
console.log('✓ completed-upload attachment reconciliation prevents duplicate blocks');

const pending = (uploadId, overrides = {}) => ({
  cardId: card.id,
  createdAt: '2026-07-30T00:00:00.000Z',
  role: 'body',
  uploadId,
  userId: 'user_1',
  ...overrides,
});
const upload = (id, overrides = {}) => ({
  id,
  userId: 'user_1',
  localFileUri: `file:///managed/${id}.jpg`,
  contentType: 'image/jpeg',
  fileSizeBytes: 3,
  checksum: 'a'.repeat(64),
  clientRequestId: id,
  assetId: `photo_${id}`,
  assetVersion: 1,
  state: 'UPLOADED',
  retryCount: 0,
  lastErrorCode: null,
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

const attachedStale = reconcilePendingPersonalPlacePhotos(
  [pending('attached')],
  [upload('attached', { assetId: 'photo_1' })],
  card
);
assert.equal(attachedStale.retained.length, 0);
assert.equal(personalPlaceBodyPhotoCount(4, attachedStale.previews.length), 4);
console.log('✓ authoritative attachment retires its stale local attachment intent');

const unrelatedCompleted = reconcilePendingPersonalPlacePhotos(
  [],
  [upload('completed-without-intent')],
  card
);
assert.equal(personalPlaceBodyPhotoCount(4, unrelatedCompleted.previews.length), 4);
console.log('✓ completed upload queue records do not increase the body-photo count');

const orphaned = reconcilePendingPersonalPlacePhotos(
  [
    pending('missing'),
    pending('permanent'),
    pending('removed-target', { replaceMediaId: 'removed_media' }),
  ],
  [
    upload('permanent', { state: 'PERMANENT_ERROR' }),
    upload('removed-target'),
  ],
  card
);
assert.equal(orphaned.retained.length, 0);
assert.equal(orphaned.previews.length, 0);
console.log('✓ missing and terminal attachment intents are retired during reconciliation');

const deduplicated = reconcilePendingPersonalPlacePhotos(
  [pending('duplicate'), pending('duplicate')],
  [upload('duplicate', { state: 'RETRYABLE_ERROR' })],
  card
);
assert.equal(deduplicated.retained.length, 1);
assert.equal(deduplicated.previews.length, 1);
console.log('✓ duplicate pending records for one upload are reconciled once');

const interrupted = reconcilePendingPersonalPlacePhotos(
  [pending('interrupted')],
  [upload('interrupted', {
    assetId: 'photo_interrupted',
    state: 'RETRYABLE_ERROR',
    lastErrorCode: 'put_interrupted',
  })],
  card
);
assert.equal(interrupted.retained.length, 1);
assert.equal(interrupted.previews[0].state, 'RETRYABLE_ERROR');
assert.equal(personalPlaceBodyPhotoCount(4, interrupted.previews.length), 5);
console.log('✓ genuinely interrupted uploads survive restart reconciliation as retryable');
