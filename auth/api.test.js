import assert from 'node:assert/strict';

import { mobileExchange, MobileExchangeError } from './api.ts';

const originalFetch = globalThis.fetch;

async function run() {
  try {
    globalThis.fetch = async () =>
    Response.json(
      {
        error: {
          code: 'mobile_exchange_failed',
          stage: 'user_reconciliation',
          raw: 'must not be retained',
        },
      },
      { status: 500 }
    );

    await assert.rejects(
      mobileExchange('authorization-code', 'pkce-verifier'),
      (error) =>
        error instanceof MobileExchangeError &&
        error.stage === 'user_reconciliation' &&
        error.message === 'Mobile token exchange failed' &&
        !JSON.stringify(error).includes('must not be retained')
    );

    globalThis.fetch = async () =>
      new Response('<html>private upstream detail</html>', { status: 500 });

    await assert.rejects(
      mobileExchange('authorization-code', 'pkce-verifier'),
      (error) =>
        error instanceof MobileExchangeError &&
        error.stage === 'unexpected'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('✓ mobile exchange preserves only safe failure stage');
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
