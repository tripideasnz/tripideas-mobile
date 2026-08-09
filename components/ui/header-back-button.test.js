import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const [button, root, discover, notebookList, notebookDetail, tripDetail, tripMap, map] =
  await Promise.all([
    read('components/ui/header-back-button.tsx'),
    read('app/_layout.tsx'),
    read('app/(tabs)/(discover)/_layout.tsx'),
    read('app/notebooks/index.tsx'),
    read('app/notebooks/[notebookId].tsx'),
    read('app/trips/[tripId].tsx'),
    read('app/trips/[tripId]/map.tsx'),
    read('app/(tabs)/map.tsx'),
  ]);

assert.match(button, /hitSlop=\{10\}/);
assert.match(button, /height: 44/);
assert.match(button, /width: 44/);
assert.match(button, /borderRadius: 22/);
assert.match(button, /backgroundColor: Palette\.surface/);
assert.match(button, /borderColor: Palette\.border/);
assert.match(button, /Ionicons color=\{Palette\.text\} name="chevron-back" size=\{24\}/);
assert.match(button, /opacity: pressed \? 0\.5 : 1/);

for (const source of [root, discover, notebookList, notebookDetail, tripDetail, tripMap, map]) {
  assert.match(source, /@\/components\/ui\/header-back-button/);
}
assert.doesNotMatch(notebookList, /@react-navigation\/elements/);
assert.doesNotMatch(notebookDetail, /@react-navigation\/elements/);
console.log('✓ top-left back controls share the explicit 44px white-circle treatment');
