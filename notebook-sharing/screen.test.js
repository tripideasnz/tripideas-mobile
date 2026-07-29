import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../app/notebooks/[notebookId]/sharing.tsx', import.meta.url),
  'utf8'
);

for (const expected of [
  'This Notebook is currently private.',
  'Create Share Link',
  'Copy Link',
  'Share…',
  'Generate New Link',
  'Stop Sharing',
  'Refresh sharing',
  'accessibilityLiveRegion="polite"',
  "useColorScheme()",
]) {
  assert.ok(source.includes(expected), `Missing sharing UI contract: ${expected}`);
}
console.log('✓ empty, loading, refresh, action, accessibility, and theme states are present');

assert.match(source, /createRequestRef\.current \?\?/);
assert.match(source, /rotateRequestsRef\.current\[capability\.id\] \?\?/);
assert.match(source, /disabled=\{action !== null/);
console.log('✓ duplicate create, rotate, and concurrent operations are guarded');

assert.doesNotMatch(source, /AsyncStorage|SecureStore|notebookStorage/);
assert.match(source, /useState<Record<string, string>>\(\{\}\)/);
console.log('✓ capability URLs remain ephemeral and outside persistent caches');
