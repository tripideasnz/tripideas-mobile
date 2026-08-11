import assert from 'node:assert/strict';

import {
  checkApiCompatibility,
  REQUIRED_MOBILE_API_CAPABILITIES,
} from './api-compatibility.ts';

const identity = {
  apiVersion: 1,
  build: 'abc123',
  capabilities: [...REQUIRED_MOBILE_API_CAPABILITIES],
  environment: 'integration',
};

assert.deepEqual(
  await checkApiCompatibility(async () => Response.json(identity)),
  { status: 'compatible', build: 'abc123', environment: 'integration' }
);
assert.deepEqual(
  await checkApiCompatibility(async () => new Response('', { status: 404 })),
  { status: 'incompatible', reason: 'identity-missing' }
);
assert.deepEqual(
  await checkApiCompatibility(async () =>
    Response.json({ ...identity, capabilities: ['notebooks'] })
  ),
  { status: 'incompatible', reason: 'capability-missing' }
);
assert.deepEqual(
  await checkApiCompatibility(async () => {
    throw new TypeError('Network request failed');
  }),
  { status: 'unreachable' }
);

console.log('✓ API compatibility gate distinguishes incompatible and unreachable servers');

