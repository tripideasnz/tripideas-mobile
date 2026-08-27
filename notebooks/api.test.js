import assert from 'node:assert/strict';

import {
  ApiError,
  apiFetch,
  authenticatedApiFetch,
  setActiveToken,
  setAuthenticatedSessionHandlers,
} from '../lib/api-client.ts';
import {
  addNotebookTextItem,
  addNotebookPhotoBlock,
  addNotebookLinkBlock,
  addNotebookTextBlock,
  addNotebookPlaceBlock,
  addNotebookPinBlock,
  reorderNotebookBlocks,
  deleteNotebookBlock,
  authorizePhotoRead,
  createNotebook,
  deleteNotebook,
  deleteNotebookTextItem,
  listNotebooks,
  readNotebook,
  readNotebookContent,
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
  await addNotebookTextItem('notebook-1', 2, '', 0, 'Arrival');
  await updateNotebookTextItem('notebook-1', 'item-1', 2, {
    title: null,
    text: 'Hello',
  });
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
  assert.deepEqual(JSON.parse(String(calls[4][1]?.body)), {
    expectedVersion: 2,
    position: 0,
    text: '',
    title: 'Arrival',
  });
  assert.deepEqual(JSON.parse(String(calls[5][1]?.body)), {
    expectedVersion: 2,
    text: 'Hello',
    title: null,
  });
});

test('owner Photo Block requests preserve page ordering and hide delivery details', async () => {
  const calls = [];
  setActiveToken('mobile-token');
  const content = {
    ...detail,
    pages: [{
      id: 'page-1',
      position: 0,
      title: 'Arrival',
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      blocks: [
        {
          id: 'text-1',
          type: 'text',
          position: 0,
          title: 'Arrival',
          text: 'Notes',
          role: 'pageBody',
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        },
        {
          id: 'photo-1',
          type: 'photo',
          position: 1,
          photoAssetId: 'asset-1',
          clientRequestId: 'photo-block:request-1',
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        },
      ],
    }],
  };
  globalThis.fetch = async (input, init) => {
    calls.push([String(input), init]);
    if (String(input).endsWith('/read-authorization')) {
      return Response.json({
        method: 'GET',
        url: 'https://storage.example.test/signed-read',
        expiresAt: detail.updatedAt,
      });
    }
    return Response.json(content);
  };

  const read = await readNotebookContent('notebook-1');
  assert.equal(read.pages[0].blocks[0].title, 'Arrival');
  assert.equal(read.pages[0].blocks[1].photoAssetId, 'asset-1');
  await addNotebookPhotoBlock({
    notebookId: 'notebook-1',
    pageId: 'page-1',
    photoAssetId: 'asset-1',
    clientRequestId: 'photo-block:request-1',
    expectedVersion: 2,
    position: 1,
  });
  const authorization = await authorizePhotoRead('asset-1');
  assert.equal(authorization.method, 'GET');
  assert.deepEqual(JSON.parse(String(calls[1][1]?.body)), {
    pageId: 'page-1',
    photoAssetId: 'asset-1',
    clientRequestId: 'photo-block:request-1',
    expectedVersion: 2,
    position: 1,
  });
});

test('objects-v2 requests and five-object parser preserve page identity and ordering', async () => {
  const calls = [];
  setActiveToken('mobile-token');
  const base = { createdAt: detail.createdAt, updatedAt: detail.updatedAt };
  const content = { ...detail, pages: [{ id: 'page-1', position: 0, title: 'Page', ...base, blocks: [
    { id: 'text-body', type: 'text', position: 3, title: 'Page', text: 'Body', role: 'pageBody', ...base },
    { id: 'text-child', type: 'text', position: 0, title: null, text: 'Child', role: 'content', ...base },
    { id: 'place-1', type: 'place', position: 1, titleSnapshot: 'Private place', reference: { kind: 'personal', personalPlaceCardId: 'card-1' }, availability: 'unavailable', locationSnapshot: null, clientRequestId: 'place-request', ...base },
    { id: 'pin-1', type: 'pin', position: 2, title: null, location: { latitude: -41, longitude: 174, source: 'MAP_SELECTED', accuracyMeters: null }, clientRequestId: 'pin-request', ...base },
  ] }] };
  globalThis.fetch = async (input, init) => { calls.push([String(input), init]); return Response.json(content); };
  const parsed = await readNotebookContent('notebook-1');
  assert.deepEqual(parsed.pages[0].blocks.map(({ id }) => id), ['text-child', 'place-1', 'pin-1', 'text-body']);
  assert.equal(parsed.pages[0].blocks[3].role, 'pageBody');
  assert.equal(parsed.pages[0].blocks[0].title, null);
  await addNotebookTextBlock({ notebookId: 'notebook-1', pageId: 'page-1', clientRequestId: 'text', expectedVersion: 2, position: 4, title: null, text: '' });
  await addNotebookPlaceBlock({ notebookId: 'notebook-1', pageId: 'page-1', clientRequestId: 'place', expectedVersion: 2, position: 4, titleSnapshot: 'Place', reference: { kind: 'editorial', editorialPlaceId: 'place-1' } });
  await addNotebookPinBlock({ notebookId: 'notebook-1', pageId: 'page-1', clientRequestId: 'pin', expectedVersion: 2, position: 4, title: null, location: { latitude: -41, longitude: 174, source: 'PIN_NOW' } });
  await reorderNotebookBlocks('notebook-1', 'page-1', 2, ['pin-1', 'place-1']);
  await deleteNotebookBlock('notebook-1', 'pin-1', 2);
  assert.ok(calls.every(([, init]) => new Headers(init?.headers).get('X-TripIdeas-Notebook-Contract') === 'objects-v2'));
  assert.deepEqual(calls.slice(1).map(([url]) => new URL(url).pathname), [
    '/notebooks/notebook-1/blocks/text', '/notebooks/notebook-1/blocks/place',
    '/notebooks/notebook-1/blocks/pin', '/notebooks/notebook-1/pages/page-1/blocks/order',
    '/notebooks/notebook-1/blocks/pin-1',
  ]);
});

test('Link create sends the complete atomic payload in one request', async () => {
  const calls = [];
  setActiveToken('mobile-token');
  const content = { ...detail, pages: [] };
  globalThis.fetch = async (input, init) => { calls.push([String(input), init]); return Response.json(content); };
  await addNotebookLinkBlock({ notebookId: 'notebook-1', pageId: 'page-1',
    url: 'https://example.com', title: 'Example', text: 'Note',
    clientRequestId: 'retained-link-request', expectedVersion: 2, position: 3 });
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(String(calls[0][1]?.body)), {
    pageId: 'page-1', url: 'https://example.com', title: 'Example', text: 'Note',
    clientRequestId: 'retained-link-request', expectedVersion: 2, position: 3,
  });
});

test('text item responses preserve nullable titles and pasted plain text', async () => {
  setActiveToken('mobile-token');
  globalThis.fetch = async () =>
    Response.json({
      ...detail,
      items: [{
        id: 'item-1',
        type: 'text',
        position: 0,
        title: null,
        text: 'https://www.example.com\nSecond line',
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      }],
    });

  const parsed = await readNotebook('notebook-1');
  assert.equal(parsed.items[0].title, null);
  assert.equal(parsed.items[0].text, 'https://www.example.com\nSecond line');
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

test('Notebook creation succeeds after one bearer refresh', async () => {
  const authorizations = [];
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
  globalThis.fetch = async (_input, init) => {
    const authorization = new Headers(init?.headers).get('Authorization');
    authorizations.push(authorization);
    if (authorization === 'Bearer expired-token') {
      return Response.json(
        { error: { code: 'unauthorized' } },
        { status: 401 }
      );
    }
    return Response.json(detail, { status: 201 });
  };

  const created = await createNotebook({ title: 'South Island' });
  assert.equal(created.id, detail.id);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(authorizations, [
    'Bearer expired-token',
    'Bearer replacement-token',
  ]);
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
    setAuthenticatedSessionHandlers(null);
  }
}

if (failed) process.exitCode = 1;
