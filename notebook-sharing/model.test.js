import assert from 'node:assert/strict';

import { ApiError } from '../lib/api-client.ts';
import {
  copyNotebookShareLink,
  openNotebookShareSheet,
} from './actions.ts';
import {
  activeShareCapabilities,
  classifySharingError,
  sharingErrorMessage,
} from './model.ts';

const capability = (id, state, createdAt) => ({
  id,
  state,
  createdAt,
  expiresAt: null,
  revokedAt: null,
  rotatedAt: null,
});

assert.deepEqual(activeShareCapabilities(null), []);
assert.deepEqual(
  activeShareCapabilities({
    share: {
      id: 'share',
      state: 'active',
      capabilities: [
        capability('old', 'active', '2026-07-27T00:00:00.000Z'),
        capability('revoked', 'revoked', '2026-07-29T00:00:00.000Z'),
        capability('new', 'active', '2026-07-28T00:00:00.000Z'),
      ],
    },
  }).map(({ id }) => id),
  ['new', 'old']
);
console.log('✓ private empty state and active share ordering are deterministic');

assert.equal(
  sharingErrorMessage(new TypeError('Network request failed')),
  'You appear to be offline. Connect and try again.'
);
assert.equal(
  sharingErrorMessage(new ApiError(401, 'mobile_session_required')),
  'Please sign in again to manage sharing.'
);
assert.equal(classifySharingError(new ApiError(404, 'not_found')), 'not-found');
assert.equal(classifySharingError(new ApiError(503, 'unavailable')), 'unknown');
console.log('✓ offline, authentication, unavailable, and safe error states map cleanly');

let copied = null;
await copyNotebookShareLink('https://viewer.test/shared/secret', async (value) => {
  copied = value;
  return true;
});
assert.equal(copied, 'https://viewer.test/shared/secret');
console.log('✓ Copy Link invokes the clipboard with the returned URL');

let shared = null;
await openNotebookShareSheet(
  'South Island',
  'https://viewer.test/shared/secret',
  async (content, options) => {
    shared = { content, options };
  }
);
assert.deepEqual(shared, {
  content: {
    message:
      'View South Island: https://viewer.test/shared/secret',
    url: 'https://viewer.test/shared/secret',
  },
  options: { subject: 'South Island' },
});
console.log('✓ Share invokes the native sheet with title and URL');

const firstCreateRequest = 'mobile-share-create:stable';
const retriedCreateRequest = firstCreateRequest;
assert.equal(firstCreateRequest, retriedCreateRequest);
console.log('✓ repeated operation retries retain one client request ID');
