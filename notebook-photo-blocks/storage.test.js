import assert from 'node:assert/strict';

import { createNotebookPhotoBlockStorage } from './storage.ts';
import { notebookPhotoPreviewUris } from './previews.ts';

const values = new Map();
const storage = createNotebookPhotoBlockStorage({
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => {
    values.set(key, value);
  },
});
const pending = {
  userId: 'owner-a',
  notebookId: 'notebook-a',
  pageId: 'page-a',
  uploadId: 'upload-a',
  blockClientRequestId: 'photo-block:stable-a',
  createdAt: '2026-07-28T00:00:00.000Z',
};

await storage.set(pending);
await storage.set(pending);
assert.deepEqual(await storage.list('owner-a'), [pending]);
assert.deepEqual(await storage.list('owner-b'), []);
await storage.remove('owner-a', pending.uploadId);
assert.deepEqual(await storage.list('owner-a'), []);
assert.equal(
  JSON.stringify([...values.values()]).includes('signed'),
  false
);
console.log('✓ pending Notebook Photo Blocks are owner-scoped and idempotent');

assert.deepEqual(
  notebookPhotoPreviewUris(
    [pending],
    [{
      id: pending.uploadId,
      userId: pending.userId,
      localFileUri: 'file:///private/local-preview.jpg',
      contentType: 'image/jpeg',
      fileSizeBytes: 3,
      checksum: 'safe-checksum',
      clientRequestId: 'upload-request',
      assetId: null,
      assetVersion: null,
      state: 'VALIDATED',
      retryCount: 0,
      lastErrorCode: null,
      createdAt: pending.createdAt,
      updatedAt: pending.createdAt,
    }],
    pending.notebookId
  ),
  { [pending.pageId]: ['file:///private/local-preview.jpg'] }
);
console.log('✓ restart recovery restores owner-scoped local previews');
