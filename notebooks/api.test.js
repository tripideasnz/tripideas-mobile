import assert from 'node:assert/strict';

import {
  ApiError,
  apiFetch,
  authenticatedApiFetch,
  setActiveToken,
} from '../lib/api-client.ts';
import {
  addNotebookTextItem,
  createNotebook,
  deleteNotebook,
  deleteNotebookTextItem,
  listNotebooks,
  readNotebook,
  reorderNotebookItems,
  updateNotebook,
  updateNotebookTextItem,
} from './api.ts';

const detail = {
  id: 'notebook-1',
  title: 'South Island',
  description: null,
  version: 2,
  createdAt: '2026-07-26T00:00:00.000Z',
  updatedAt: '2026-07-26T00:00:00.000Z',
  items: [],
};

const originalFetch = globalThis.fetch;
const tests = [];
const test = (name, run) => tests.push({ name, run });

test('list, create, read, update, delete and item requests match the contract', async () => {
  const calls = [];
  setActiveToken('mobile-token');
  globalThis.fetch = async (input, init) => {
    calls.push([input, init]);
    const path = String(input);
    if (path.endsWith('/notebooks') && !init?.method) {
      return Response.json({ notebooks: [] });
    }
    if (init?.method === 'DELETE' && !path.includes('/items/')) {
      return Response.json({
        id: 'notebook-1',
        state: 'deleted',
        deletedAt: detail.updatedAt,
        version: 3,
      });
    }
    return Response.json(detail);
  };

  await listNotebooks();
  await createNotebook({ title: 'South Island' });
  await readNotebook('notebook-1');
  await updateNotebook('notebook-1', { expectedVersion: 2, title: 'NZ' });
  await addNotebookTextItem('notebook-1', 2, '', 0);
  await updateNotebookTextItem('notebook-1', 'item-1', 2, 'Hello');
  await deleteNotebookTextItem('notebook-1', 'item-1', 2);
  await reorderNotebookItems('notebook-1', 2, ['item-2', 'item-1']);
  await deleteNotebook('notebook-1', 2);

  assert.deepEqual(calls.map(([, init]) => init?.method ?? 'GET'), [
    'GET', 'POST', 'GET', 'PATCH', 'POST', 'PATCH', 'DELETE', 'PUT', 'DELETE',
  ]);
  for (const [, init] of calls) {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer mobile-token');
  }
  assert.deepEqual(JSON.parse(String(calls[7][1]?.body)), {
    expectedVersion: 2,
    itemIds: ['item-2', 'item-1'],
  });
});

test('safe structured conflicts and malformed error bodies are mapped', async () => {
  setActiveToken('mobile-token');
  globalThis.fetch = async () =>
    Response.json(
      { error: { code: 'notebook_conflict', message: 'Changed elsewhere.' } },
      { status: 409 }
    );
  await assert.rejects(createNotebook({ title: 'A' }), (error) =>
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'notebook_conflict'
  );

  globalThis.fetch = async () =>
    new Response('<html>private upstream error</html>', { status: 500 });
  await assert.rejects(readNotebook('one'), (error) =>
    error instanceof ApiError &&
    error.status === 500 &&
    error.code === 'request_failed' &&
    error.message === 'The request could not be completed.'
  );
});

test('malformed successful responses are rejected', async () => {
  setActiveToken('mobile-token');
  globalThis.fetch = async () => Response.json({ items: 'wrong' });
  await assert.rejects(readNotebook('one'), ApiError);
});

test('bodyless requests omit JSON content type and parse an empty body', async () => {
  let requestInit;
  setActiveToken('mobile-token');
  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return new Response(null, { status: 200 });
  };

  await apiFetch('/favourite/place-1', { method: 'DELETE' });
  assert.equal(new Headers(requestInit?.headers).get('Content-Type'), null);
  assert.equal(
    new Headers(requestInit?.headers).get('Authorization'),
    'Bearer mobile-token'
  );
});

test('protected requests are not sent without a bearer token', async () => {
  let calls = 0;
  setActiveToken(null);
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({});
  };

  await assert.rejects(
    authenticatedApiFetch('/notebooks'),
    (error) =>
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === 'mobile_session_required'
  );
  assert.equal(calls, 0);
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
  } finally {
    globalThis.fetch = originalFetch;
    setActiveToken(null);
  }
}

if (failed) process.exitCode = 1;
