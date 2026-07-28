import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import {
  preparePhotoUpload,
  runPhotoUpload,
} from './engine.ts';
import { PhotoUploadError } from './errors.ts';
import { transitionPhotoUpload } from './state-machine.ts';
import {
  createPhotoUploadStorage,
  photoUploadQueueKey,
} from './storage.ts';
import { PHOTO_UPLOAD_MAX_BYTES } from './types.ts';
import {
  normalizePhotoContentType,
  validatePhotoMetadata,
} from './validation.ts';

const tests = [];
const test = (name, run) => tests.push({ name, run });

const future = '2099-01-01T00:00:00.000Z';
const asset = (overrides = {}) => ({
  id: 'asset-1',
  version: 1,
  uploadStatus: 'PENDING',
  processingStatus: 'WAITING',
  originalMimeType: 'image/jpeg',
  processedMimeType: null,
  originalFileSizeBytes: '3',
  processedFileSizeBytes: null,
  thumbnailFileSizeBytes: null,
  width: null,
  height: null,
  capturedAt: null,
  location: null,
  locationRemovedByUser: false,
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
  uploadedAt: null,
  processedAt: null,
  deletedAt: null,
  purgeAfter: null,
  ...overrides,
});

const authorization = {
  method: 'PUT',
  url: 'https://storage.invalid/signed',
  expiresAt: future,
  requiredHeaders: { 'content-type': 'image/jpeg' },
};

function harness(overrides = {}) {
  const records = new Map();
  const events = [];
  let tick = 0;
  const dependencies = {
    createId: () => 'upload-stable-id',
    now: () => `2026-07-28T00:00:0${tick++}.000Z`,
    inspectFile: async (uri) => ({
      exists: uri !== 'file:///missing',
      size: 3,
      mimeType: 'image/jpeg',
    }),
    copyToManagedFile: async () => 'file:///managed.jpg',
    checksumFile: async () => 'a'.repeat(64),
    createIntent: async (request) => {
      events.push(['intent', request]);
      return { asset: asset(), upload: authorization };
    },
    putFile: async (_upload, _uri, signal) => {
      events.push(['put', signal.aborted]);
      return { status: 200 };
    },
    complete: async (assetId, request) => {
      events.push(['complete', assetId, request]);
      return { asset: asset({ uploadStatus: 'UPLOADED', version: 2 }) };
    },
    getRecord: async (userId, uploadId) =>
      records.get(`${userId}:${uploadId}`) ?? null,
    saveRecord: async (record) => {
      records.set(`${record.userId}:${record.id}`, structuredClone(record));
      events.push(['state', record.state]);
    },
    ...overrides,
  };
  return { dependencies, events, records };
}

async function prepared(h = harness()) {
  const record = await preparePhotoUpload(h.dependencies, 'user-a', {
    uri: 'file:///picked.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 3,
  });
  return { ...h, record };
}

test('supported MIME types and clear aliases normalize', () => {
  for (const type of [
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
  ]) assert.equal(normalizePhotoContentType(type), type);
  assert.equal(normalizePhotoContentType('image/jpg'), 'image/jpeg');
});

test('unsupported and unknown MIME types are rejected', () => {
  assert.throws(
    () => validatePhotoMetadata({ exists: true, size: 3, mimeType: 'image/gif' }),
    (error) =>
      error instanceof PhotoUploadError &&
      error.code === 'unsupported_content_type'
  );
});

test('file size must be between 1 byte and 25 MiB', () => {
  assert.throws(() =>
    validatePhotoMetadata({ exists: true, size: 0, mimeType: 'image/png' })
  );
  assert.doesNotThrow(() =>
    validatePhotoMetadata({
      exists: true,
      size: PHOTO_UPLOAD_MAX_BYTES,
      mimeType: 'image/png',
    })
  );
  assert.throws(() =>
    validatePhotoMetadata({
      exists: true,
      size: PHOTO_UPLOAD_MAX_BYTES + 1,
      mimeType: 'image/png',
    })
  );
});

test('prepare creates a durable validated record with one stable request ID', async () => {
  const { record } = await prepared();
  assert.equal(record.state, 'VALIDATED');
  assert.equal(record.id, 'upload-stable-id');
  assert.equal(record.clientRequestId, 'upload-stable-id');
  assert.equal(record.localFileUri, 'file:///managed.jpg');
});

test('the upload state machine rejects invalid transitions', async () => {
  const record = {
    ...(await prepared()).record,
    state: 'UPLOADED',
  };
  assert.throws(() =>
    transitionPhotoUpload(record, 'UPLOADING', future)
  );
});

test('new intent, signed PUT, and completion reach UPLOADED', async () => {
  const h = await prepared();
  const result = await runPhotoUpload(
    h.dependencies,
    'user-a',
    h.record.id,
    new AbortController().signal
  );
  assert.equal(result.state, 'UPLOADED');
  assert.deepEqual(
    h.events.filter(([name]) => ['intent', 'put', 'complete'].includes(name)),
    [
      ['intent', {
        clientRequestId: 'upload-stable-id',
        contentType: 'image/jpeg',
        fileSizeBytes: 3,
      }],
      ['put', false],
      ['complete', 'asset-1', { checksum: 'a'.repeat(64) }],
    ]
  );
});

test('an idempotent retry reuses the same clientRequestId', async () => {
  const h = await prepared();
  h.dependencies.putFile = async () => {
    throw new Error('offline');
  };
  const failed = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(failed.state, 'RETRYABLE_ERROR');
  h.dependencies.putFile = async () => ({ status: 200 });
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(result.state, 'UPLOADED');
  const intentIds = h.events
    .filter(([name]) => name === 'intent')
    .map(([, request]) => request.clientRequestId);
  assert.deepEqual(intentIds, ['upload-stable-id', 'upload-stable-id']);
});

test('completed intent with upload null reconciles without PUT', async () => {
  const h = await prepared(harness({
    createIntent: async () => ({
      asset: asset({ uploadStatus: 'UPLOADED', version: 4 }),
      upload: null,
    }),
  }));
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(result.state, 'UPLOADED');
  assert.equal(result.assetVersion, 4);
  assert.equal(h.events.some(([name]) => name === 'put'), false);
});

test('interrupted PUT is retryable', async () => {
  const abortError = new Error('aborted');
  abortError.name = 'AbortError';
  const h = await prepared(harness({ putFile: async () => { throw abortError; } }));
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(result.state, 'RETRYABLE_ERROR');
  assert.equal(result.lastErrorCode, 'put_interrupted');
});

test('expired signed URL is retryable and is never sent', async () => {
  let putCalls = 0;
  const h = await prepared(harness({
    createIntent: async () => ({
      asset: asset(),
      upload: { ...authorization, expiresAt: '2020-01-01T00:00:00.000Z' },
    }),
    putFile: async () => { putCalls += 1; return { status: 200 }; },
  }));
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(result.lastErrorCode, 'signed_url_expired');
  assert.equal(putCalls, 0);
});

test('completion can resume after restart without repeating PUT', async () => {
  const h = await prepared();
  const putCompleted = {
    ...h.record,
    state: 'PUT_COMPLETED',
    assetId: 'asset-1',
    assetVersion: 1,
  };
  await h.dependencies.saveRecord(putCompleted);
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(result.state, 'UPLOADED');
  assert.equal(h.events.some(([name]) => name === 'put'), false);
});

test('idempotent completion success is accepted', async () => {
  const h = await prepared(harness({
    complete: async () => ({
      asset: asset({ uploadStatus: 'UPLOADED', version: 7 }),
    }),
  }));
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(result.assetVersion, 7);
});

for (const [name, apiError, expectedState, expectedCode] of [
  ['incomplete completion', new ApiError(409, 'photo_upload_incomplete'), 'RETRYABLE_ERROR', 'photo_upload_incomplete'],
  ['checksum mismatch', new ApiError(422, 'photo_upload_mismatch'), 'PERMANENT_ERROR', 'photo_upload_mismatch'],
  ['lifecycle conflict', new ApiError(409, 'photo_upload_conflict'), 'PERMANENT_ERROR', 'photo_upload_conflict'],
  ['temporary storage failure', new ApiError(503, 'storage_unavailable'), 'RETRYABLE_ERROR', 'storage_unavailable'],
]) {
  test(`${name} is classified safely`, async () => {
    const h = await prepared(harness({ complete: async () => { throw apiError; } }));
    const result = await runPhotoUpload(
      h.dependencies, 'user-a', h.record.id, new AbortController().signal
    );
    assert.equal(result.state, expectedState);
    assert.equal(result.lastErrorCode, expectedCode);
  });
}

test('records are partitioned by authenticated user', async () => {
  const h = await prepared();
  await assert.rejects(
    runPhotoUpload(
      h.dependencies, 'user-b', h.record.id, new AbortController().signal
    ),
    (error) =>
      error instanceof PhotoUploadError &&
      error.code === 'local_file_missing'
  );
});

test('sign-out abort is recorded as a retryable interruption', async () => {
  const controller = new AbortController();
  const h = await prepared(harness({
    putFile: async (_authorization, _uri, signal) => {
      controller.abort();
      const error = new Error(signal.aborted || controller.signal.aborted ? 'aborted' : '');
      error.name = 'AbortError';
      throw error;
    },
  }));
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, controller.signal
  );
  assert.equal(result.lastErrorCode, 'put_interrupted');
});

test('a changed file is a permanent integrity error', async () => {
  let checks = 0;
  const h = await prepared(harness({
    inspectFile: async () => ({
      exists: true,
      size: checks++ < 2 ? 3 : 4,
      mimeType: 'image/jpeg',
    }),
  }));
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(result.state, 'PERMANENT_ERROR');
  assert.equal(result.lastErrorCode, 'local_file_changed');
});

test('a missing file is a permanent integrity error', async () => {
  const h = await prepared();
  h.dependencies.inspectFile = async () => ({
    exists: false,
    size: 0,
    mimeType: '',
  });
  const result = await runPhotoUpload(
    h.dependencies, 'user-a', h.record.id, new AbortController().signal
  );
  assert.equal(result.lastErrorCode, 'local_file_missing');
});

test('persistent queue excludes signed URLs, credentials, and other users', async () => {
  const values = new Map();
  const storage = createPhotoUploadStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  });
  const { record } = await prepared();
  await storage.set(record);
  const raw = values.get(photoUploadQueueKey('user-a'));
  assert.equal(raw.includes('signed'), false);
  assert.equal(raw.includes('accessToken'), false);
  assert.equal(raw.includes('refreshToken'), false);
  assert.equal((await storage.list('user-b')).length, 0);
});

let failed = false;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
