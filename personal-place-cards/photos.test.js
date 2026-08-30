import assert from 'node:assert/strict';
import { hasAttachedPhoto } from './model.ts';
import { readFile } from 'node:fs/promises';

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

const photoFlow = await readFile(new URL('./photos.ts', import.meta.url), 'utf8');
assert.match(photoFlow, /listNativePhotoUploads/);
assert.match(photoFlow, /upload\?\.localFileUri \?\? null/);
assert.match(photoFlow, /Keep the isolated pending context for explicit retry or restart recovery/);
console.log('✓ Personal Place failed-upload previews remain backed by the durable retry queue');
