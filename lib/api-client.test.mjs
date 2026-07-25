import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  apiFetch,
  setActiveToken,
} from './api-client.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setActiveToken(null);
});

async function captureRequest(options) {
  let captured;

  globalThis.fetch = async (_url, init) => {
    captured = init;
    return new Response(null, { status: 200 });
  };

  await apiFetch('/test', options);
  return captured;
}

for (const method of ['GET', 'DELETE', 'POST']) {
  test(`bodyless ${method} does not send a JSON content type`, async () => {
    const request = await captureRequest({ method });
    const headers = new Headers(request.headers);

    assert.equal(headers.has('Content-Type'), false);
  });
}

test('JSON body receives the JSON content type', async () => {
  const request = await captureRequest({
    method: 'POST',
    body: JSON.stringify({ value: 'test' }),
  });
  const headers = new Headers(request.headers);

  assert.equal(headers.get('Content-Type'), 'application/json');
});

test('caller-provided content type is preserved', async () => {
  const request = await captureRequest({
    method: 'POST',
    body: JSON.stringify({ value: 'test' }),
    headers: { 'Content-Type': 'application/vnd.tripideas+json' },
  });
  const headers = new Headers(request.headers);

  assert.equal(
    headers.get('Content-Type'),
    'application/vnd.tripideas+json'
  );
});

test('bearer token behaviour is unchanged', async () => {
  setActiveToken('test-bearer-token');

  const request = await captureRequest({ method: 'GET' });
  const headers = new Headers(request.headers);

  assert.equal(headers.get('Authorization'), 'Bearer test-bearer-token');
  assert.equal(headers.has('Content-Type'), false);
});
