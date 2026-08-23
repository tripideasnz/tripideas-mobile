import assert from 'node:assert/strict';

import {
  authenticatedSession,
  clearMobileSession,
  persistMobileSession,
  restoreMobileSession,
  runCoalescedRefresh,
  selectRefreshUser,
} from './mobile-session.ts';

const user = { id: 'user-1', email: 'person@example.com' };

function dependencies(overrides = {}) {
  return {
    cacheUser: async () => {},
    clearAuthStorage: async () => {},
    clearNotebookCache: async () => {},
    loadRefreshToken: async () => null,
    refresh: async () => {
      throw new Error('not configured');
    },
    setActiveToken: () => {},
    storeRefreshToken: async () => {},
    ...overrides,
  };
}

async function run() {
  assert.equal(authenticatedSession(user, '').session, null);
  assert.equal(authenticatedSession(user, '').user, null);
  assert.equal(selectRefreshUser(null, user), user);
  assert.equal(selectRefreshUser(user, null), user);

  {
    const inFlight = { current: null };
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let refreshCalls = 0;
    const refresh = () => runCoalescedRefresh(inFlight, async () => {
      refreshCalls += 1;
      await gate;
      return true;
    });
    const first = refresh();
    const second = refresh();
    assert.equal(first, second);
    assert.equal(refreshCalls, 1);
    release();
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(inFlight.current, null);
  }

  {
  let refreshCalls = 0;
  const state = await restoreMobileSession(dependencies({
    refresh: async () => {
      refreshCalls += 1;
      throw new Error('must not run');
    },
  }));
  assert.equal(state.session, null);
  assert.equal(state.user, null);
  assert.equal(refreshCalls, 0);
  }

  {
  const events = [];
  const state = await restoreMobileSession(dependencies({
    loadRefreshToken: async () => 'refresh',
    refresh: async () => ({
      accessToken: 'access',
      refreshToken: 'replacement',
      user,
    }),
    storeRefreshToken: async () => events.push('refresh stored'),
    cacheUser: async () => events.push('user cached'),
    setActiveToken: (token) => events.push(`active ${token}`),
  }));
  assert.equal(state.session?.accessToken, 'access');
  assert.deepEqual(events, [
    'refresh stored',
    'user cached',
    'active access',
  ]);
  }

  {
  const events = [];
  const state = await restoreMobileSession(dependencies({
    loadRefreshToken: async () => 'expired',
    refresh: async () => {
      throw Object.assign(new Error('expired'), { status: 401 });
    },
    clearAuthStorage: async () => events.push('storage cleared'),
    setActiveToken: (token) => events.push(`active ${token}`),
  }));
  assert.equal(state.session, null);
  assert.equal(state.user, null);
  assert.deepEqual(events, ['active null', 'storage cleared']);
  }

  {
  const events = [];
  const state = await restoreMobileSession(dependencies({
    loadRefreshToken: async () => 'retryable',
    refresh: async () => { throw new TypeError('Network request failed'); },
    clearAuthStorage: async () => events.push('storage cleared'),
    setActiveToken: (token) => events.push(`active ${token}`),
  }));
  assert.equal(state.session, null);
  assert.deepEqual(events, ['active null']);
  }

  {
  const events = [];
  const state = await persistMobileSession(
    { accessToken: 'access', refreshToken: 'refresh', user },
    dependencies({
      storeRefreshToken: async () => events.push('refresh stored'),
      cacheUser: async () => events.push('user cached'),
      setActiveToken: (token) => events.push(`active ${token}`),
    })
  );
  assert.ok(state.session);
  assert.deepEqual(events, [
    'refresh stored',
    'user cached',
    'active access',
  ]);
  }

  {
  const events = [];
  const state = await persistMobileSession(
    { accessToken: '', refreshToken: 'refresh', user },
    dependencies({
      clearAuthStorage: async () => events.push('storage cleared'),
      setActiveToken: (token) => events.push(`active ${token}`),
    })
  );
  assert.equal(state.session, null);
  assert.deepEqual(events, ['active null', 'storage cleared']);
  }

  {
  const events = [];
  const state = await clearMobileSession('user-1', dependencies({
    clearAuthStorage: async () => events.push('storage cleared'),
    clearNotebookCache: async () => events.push('notebooks cleared'),
    setActiveToken: (token) => events.push(`active ${token}`),
  }));
  assert.equal(state.session, null);
  assert.equal(state.user, null);
  assert.deepEqual(events.sort(), [
    'active null',
    'notebooks cleared',
    'storage cleared',
  ].sort());
  }

  console.log('✓ mobile session bearer invariant and lifecycle');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
