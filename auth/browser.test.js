import assert from 'node:assert/strict';

import {
  authBrowserFailureMessage,
  classifyAuthBrowserError,
  openAuthBrowserSafely,
} from './browser.ts';

const errors = [];
const originalConsoleError = console.error;
console.error = (...args) => errors.push(args);

try {
  const cancelled = await openAuthBrowserSafely(async () => ({ type: 'cancel' }));
  assert.deepEqual(cancelled, { status: 'cancelled', category: 'cancel' });
  assert.equal(authBrowserFailureMessage(cancelled, false), null);

  const dismissed = await openAuthBrowserSafely(async () => ({ type: 'dismiss' }));
  assert.deepEqual(dismissed, { status: 'cancelled', category: 'dismiss' });
  assert.equal(authBrowserFailureMessage(dismissed, false), null);

  const thrownCancellation = await openAuthBrowserSafely(async () => {
    throw { code: 'ERR_WEB_BROWSER_CANCELED' };
  });
  assert.deepEqual(thrownCancellation, {
    status: 'cancelled',
    category: 'cancel',
  });
  assert.equal(authBrowserFailureMessage(thrownCancellation, false), null);
  assert.equal(errors.length, 0);
  console.log('✓ auth browser cancellation and dismissal return without an error');

  const alreadyOpen = classifyAuthBrowserError({
    code: 'ERR_WEB_BROWSER_ALREADY_OPEN',
  });
  assert.deepEqual(alreadyOpen, {
    status: 'cancelled',
    category: 'already-open',
  });
  assert.equal(authBrowserFailureMessage(alreadyOpen, true), null);
  console.log('✓ an existing auth browser is treated as an in-progress attempt');

  const genuineFailure = await openAuthBrowserSafely(async () => {
    throw { code: 'ERR_UNAVAILABLE' };
  });
  assert.deepEqual(genuineFailure, {
    status: 'failed',
    category: 'unavailable',
  });
  assert.equal(
    authBrowserFailureMessage(genuineFailure, false),
    'Sign-in could not open. Please try again.'
  );
  assert.equal(authBrowserFailureMessage(genuineFailure, true), null);
  assert.equal(errors.length, 0);
  console.log('✓ genuine browser failure is safe and preserves authenticated state');
} finally {
  console.error = originalConsoleError;
}
