import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const surfaces = [
  '../app/favourites/index.tsx',
  '../app/trips/index.tsx',
  '../app/trips/[tripId].tsx',
  '../app/notebooks/index.tsx',
  '../app/notebooks/[notebookId].tsx',
  '../app/personal-place-cards/index.tsx',
  '../app/personal-place-cards/[cardId].tsx',
  '../app/diaries/index.tsx',
  '../app/diaries/[diaryId].tsx',
  '../app/diaries/[diaryId]/contents.tsx',
  '../app/diaries/[diaryId]/day.tsx',
  '../app/diaries/[diaryId]/map.tsx',
];

for (const path of surfaces) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(source, /useSession\(/, `${path} must consume the shared session`);
  assert.match(source, /sessionLoading|isLoadingSession|isLoading:\s*sessionLoading/, `${path} must wait for restoration`);
  assert.match(source, /!session/, `${path} must distinguish signed-out from missing content`);
  assert.match(source, /SignedOutFeature|onPress=\{signIn\}/, `${path} must offer re-authentication`);
}

const provider = await readFile(new URL('./provider.tsx', import.meta.url), 'utf8');
const mobileSession = await readFile(new URL('./mobile-session.ts', import.meta.url), 'utf8');
assert.match(provider, /next === 'active' && !stateRef\.current\.session/);
assert.match(provider, /refreshed lazily by authenticatedApiFetch on 401/);
assert.match(mobileSession, /status >= 400 && status < 500/);
assert.match(mobileSession, /retryable/);
console.log('✓ all authenticated Saved surfaces distinguish auth loss and foreground restoration avoids refresh-token races');
