import assert from 'node:assert/strict';

import {
  ApiError,
  apiFetch,
  authenticatedApiFetch,
  setActiveToken,
  setAuthenticatedSessionHandlers,
} from './api-client.ts';

const originalFetch = globalThis.fetch;

async function run() {
  try {
    {
      const calls = [];
      let refreshCalls = 0;
      setActiveToken('expired-access');
      setAuthenticatedSessionHandlers({
        invalidate: async () => {
          calls.push('invalidated');
        },
        refresh: async () => {
          refreshCalls += 1;
          calls.push('refresh persisted');
          setActiveToken('replacement-access');
          return true;
        },
      });
      globalThis.fetch = async (_input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          authorization: headers.get('Authorization'),
          body: init?.body,
          custom: headers.get('X-Test'),
          method: init?.method,
        });
        if (headers.get('Authorization') === 'Bearer expired-access') {
          return Response.json(
            { error: { code: 'unauthorized' } },
            { status: 401 }
          );
        }
        return Response.json({ ok: true });
      };

      const response = await authenticatedApiFetch('/notebooks', {
        method: 'POST',
        headers: { 'X-Test': 'preserved' },
        body: JSON.stringify({ title: 'Retry me', description: null }),
      });
      assert.deepEqual(response, { ok: true });
      assert.equal(refreshCalls, 1);
      assert.equal(calls[0].authorization, 'Bearer expired-access');
      assert.equal(calls[2].authorization, 'Bearer replacement-access');
      assert.equal(calls[0].method, 'POST');
      assert.equal(calls[2].method, 'POST');
      assert.equal(calls[0].body, calls[2].body);
      assert.equal(calls[2].custom, 'preserved');
      assert.equal(calls[1], 'refresh persisted');
    }

    {
      setActiveToken('access');
      globalThis.fetch = async () =>
        Response.json(
          {
            message: 'Validation error: Required at "placeId"',
            name: 'BAD_REQUEST',
            status: 400,
          },
          { status: 400 }
        );
      await assert.rejects(
        authenticatedApiFetch('/itinerary/trip-1/entry'),
        (error) =>
          error instanceof ApiError &&
          error.status === 400 &&
          error.code === 'BAD_REQUEST' &&
          error.message === 'Validation error: Required at "placeId"'
      );
    }

    {
      let refreshCalls = 0;
      let invalidations = 0;
      let requests = 0;
      setActiveToken('expired-access');
      setAuthenticatedSessionHandlers({
        invalidate: async () => {
          invalidations += 1;
          setActiveToken(null);
        },
        refresh: async () => {
          refreshCalls += 1;
          setActiveToken('replacement-access');
          return true;
        },
      });
      globalThis.fetch = async () => {
        requests += 1;
        return Response.json(
          { error: { code: 'unauthorized' } },
          { status: 401 }
        );
      };

      await assert.rejects(
        authenticatedApiFetch('/notebooks'),
        (error) =>
          error instanceof ApiError &&
          error.status === 401 &&
          error.code === 'unauthorized'
      );
      assert.equal(refreshCalls, 1);
      assert.equal(requests, 2);
      assert.equal(invalidations, 1);
    }

    {
      let refreshCalls = 0;
      let requests = 0;
      setActiveToken('expired-access');
      setAuthenticatedSessionHandlers({
        invalidate: async () => {},
        refresh: async () => {
          refreshCalls += 1;
          setActiveToken(null);
          return false;
        },
      });
      globalThis.fetch = async () => {
        requests += 1;
        return Response.json(
          { error: { code: 'unauthorized' } },
          { status: 401 }
        );
      };

      await assert.rejects(authenticatedApiFetch('/notebooks'), ApiError);
      assert.equal(refreshCalls, 1);
      assert.equal(requests, 1);
    }

    {
      let refreshCalls = 0;
      setActiveToken('access');
      setAuthenticatedSessionHandlers({
        invalidate: async () => {},
        refresh: async () => {
          refreshCalls += 1;
          return true;
        },
      });
      globalThis.fetch = async () =>
        Response.json(
          { error: { code: 'notebook_conflict' } },
          { status: 409 }
        );
      await assert.rejects(authenticatedApiFetch('/notebooks'), ApiError);
      assert.equal(refreshCalls, 0);
    }

    {
      let refreshCalls = 0;
      setActiveToken('access');
      setAuthenticatedSessionHandlers({
        invalidate: async () => {},
        refresh: async () => {
          refreshCalls += 1;
          return true;
        },
      });
      globalThis.fetch = async () =>
        Response.json(
          { error: { code: 'unauthorized' } },
          { status: 401 }
        );
      await assert.rejects(apiFetch('/auth/identity'), ApiError);
      assert.equal(refreshCalls, 0);
    }

    {
      let refreshCalls = 0;
      setActiveToken('access');
      setAuthenticatedSessionHandlers({
        invalidate: async () => {},
        refresh: async () => {
          refreshCalls += 1;
          return true;
        },
      });
      globalThis.fetch = async () =>
        Response.json(
          { error: { code: 'unauthorized' } },
          { status: 401 }
        );
      await assert.rejects(
        authenticatedApiFetch('/future-upload', {
          method: 'POST',
          body: new Blob(['not replayable']),
        }),
        ApiError
      );
      assert.equal(refreshCalls, 0);
    }

    console.log('✓ authenticated API refresh and single retry');
  } finally {
    globalThis.fetch = originalFetch;
    setActiveToken(null);
    setAuthenticatedSessionHandlers(null);
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
