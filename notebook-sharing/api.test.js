import assert from 'node:assert/strict';

import {
  setActiveToken,
  setAuthenticatedSessionHandlers,
} from '../lib/api-client.ts';
import {
  createNotebookShare,
  listNotebookShares,
  revokeNotebookShare,
  rotateNotebookShare,
} from './api.ts';

const timestamp = '2026-07-29T00:00:00.000Z';
const metadata = {
  id: 'scp_capability',
  state: 'active',
  expiresAt: null,
  createdAt: timestamp,
  revokedAt: null,
  rotatedAt: null,
};
const created = {
  ...metadata,
  url: 'https://staging.tripideas.nz/shared/private-capability',
  secretUnavailable: false,
};
const originalFetch = globalThis.fetch;

try {
  const calls = [];
  setActiveToken('mobile-token');
  globalThis.fetch = async (input, init) => {
    calls.push([String(input), init]);
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (init?.method === 'POST') return Response.json(created, { status: 201 });
    return Response.json({
      share: {
        id: 'nbs_share',
        state: 'active',
        capabilities: [metadata],
      },
    });
  };

  const listed = await listNotebookShares('notebook/one');
  const newlyCreated = await createNotebookShare('notebook/one', 'create-1');
  const rotated = await rotateNotebookShare(
    'notebook/one',
    'capability/one',
    'rotate-1'
  );
  await revokeNotebookShare('notebook/one', 'capability/one');

  assert.equal(listed.share.capabilities[0].state, 'active');
  assert.equal(newlyCreated.url, created.url);
  assert.equal(rotated.secretUnavailable, false);
  assert.deepEqual(calls.map(([, init]) => init?.method ?? 'GET'), [
    'GET',
    'POST',
    'POST',
    'DELETE',
  ]);
  assert.match(calls[0][0], /notebook%2Fone\/shares$/);
  assert.match(
    calls[2][0],
    /capability%2Fone\/rotate$/
  );
  assert.deepEqual(JSON.parse(String(calls[1][1].body)), {
    clientRequestId: 'create-1',
  });
  assert.deepEqual(JSON.parse(String(calls[2][1].body)), {
    clientRequestId: 'rotate-1',
  });
  for (const [, init] of calls) {
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer mobile-token'
    );
  }
  console.log('✓ owner share requests match the authenticated API contract');

  setActiveToken(null);
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    return Response.json({});
  };
  await assert.rejects(listNotebookShares('notebook-one'), {
    code: 'mobile_session_required',
    status: 401,
  });
  assert.equal(networkCalls, 0);
  console.log('✓ authentication expiry is rejected before an owner request');

  setActiveToken('mobile-token');
  globalThis.fetch = async () =>
    Response.json({ share: { state: 'active', capabilities: 'invalid' } });
  await assert.rejects(listNotebookShares('notebook-one'), {
    code: 'malformed_response',
    status: 500,
  });
  console.log('✓ malformed sharing responses fail safely');
} finally {
  globalThis.fetch = originalFetch;
  setActiveToken(null);
  setAuthenticatedSessionHandlers(null);
}
