import assert from 'node:assert/strict';

import {
  setActiveToken,
  setAuthenticatedSessionHandlers,
} from '../lib/api-client.ts';
import {
  completePhotoUpload,
  createPhotoUploadIntent,
} from './api.ts';

const originalFetch = globalThis.fetch;
const calls = [];
let refreshCalls = 0;

setActiveToken('expired-token');
setAuthenticatedSessionHandlers({
  invalidate: async () => {},
  refresh: async () => {
    refreshCalls += 1;
    setActiveToken('replacement-token');
    return true;
  },
});

globalThis.fetch = async (input, init) => {
  calls.push({ input: String(input), init });
  const authorization = new Headers(init?.headers).get('Authorization');
  if (authorization === 'Bearer expired-token') {
    return Response.json({ error: { code: 'unauthorized' } }, { status: 401 });
  }
  if (String(input).endsWith('/upload-intents')) {
    return Response.json(
      {
        asset: {
          id: 'asset-1',
          version: 1,
          uploadStatus: 'PENDING',
          processingStatus: 'WAITING',
        },
        upload: {
          method: 'PUT',
          url: 'https://storage.invalid/signed',
          expiresAt: '2099-01-01T00:00:00.000Z',
          requiredHeaders: { 'content-type': 'image/jpeg' },
        },
      },
      { status: 201 }
    );
  }
  return Response.json({
    asset: {
      id: 'asset-1',
      version: 2,
      uploadStatus: 'UPLOADED',
      processingStatus: 'WAITING',
    },
  });
};

try {
  const intent = await createPhotoUploadIntent({
    clientRequestId: 'stable-request',
    contentType: 'image/jpeg',
    fileSizeBytes: 3,
  });
  assert.equal(intent.asset.id, 'asset-1');
  assert.equal(refreshCalls, 1);
  assert.deepEqual(
    calls.slice(0, 2).map(({ init }) =>
      new Headers(init?.headers).get('Authorization')
    ),
    ['Bearer expired-token', 'Bearer replacement-token']
  );
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), {
    clientRequestId: 'stable-request',
    contentType: 'image/jpeg',
    fileSizeBytes: 3,
  });

  const completed = await completePhotoUpload('asset/unsafe', {
    checksum: 'a'.repeat(64),
  });
  assert.equal(completed.asset.uploadStatus, 'UPLOADED');
  assert.equal(
    calls[2].input.endsWith(
      '/photo-assets/asset%2Funsafe/upload-completion'
    ),
    true
  );
  assert.deepEqual(JSON.parse(String(calls[2].init.body)), {
    checksum: 'a'.repeat(64),
  });
  console.log('✓ photo upload API uses protected JSON contracts and one refresh');
} finally {
  globalThis.fetch = originalFetch;
  setActiveToken(null);
  setAuthenticatedSessionHandlers(null);
}

