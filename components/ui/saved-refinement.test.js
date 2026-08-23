import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [input, diaryIndex, diaryCover, diaryDay, tripIndex, tripDetail, notebookIndex, notebookDetail, placeDetail] = await Promise.all([
  readFile(new URL('./app-text-input.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/diaries/index.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/diaries/[diaryId].tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/diaries/[diaryId]/day.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/trips/index.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/trips/[tripId].tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/notebooks/index.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/notebooks/[notebookId].tsx', import.meta.url), 'utf8'),
  readFile(new URL('../../app/personal-place-cards/[cardId].tsx', import.meta.url), 'utf8'),
]);

assert.match(input, /AutoExpandingTextInput/);
assert.match(input, /multiline/);
assert.match(input, /measuredContentHeight/);
assert.doesNotMatch(input, /contentSize\.height\) \+ Space\.md/);
assert.match(input, /scrollEnabled=\{height >= maximumHeight\}/);
assert.match(input, /submitBehavior="newline"/);
assert.match(input, /minHeight: height/);
assert.doesNotMatch(input, /\{ height, maxHeight/);
assert.match(input, /style=\{\[style, \{ maxHeight: maximumHeight, minHeight: height/);
for (const source of [diaryIndex, tripIndex, tripDetail, notebookIndex, notebookDetail, placeDetail]) {
  assert.match(source, /AutoExpandingTextInput/);
}
assert.match(diaryCover, /accessibilityLabel="Diary title" autoExpand/);
assert.match(diaryDay, /accessibilityLabel=\{`Topic title[\s\S]{0,180}inputStyle=\{Type\.section\}/);
assert.match(diaryDay, /placeholder="Title"/);
assert.doesNotMatch(diaryDay, /placeholder="Topic name"/);
assert.match(diaryCover, /<SafeAreaView edges=\{\['bottom'\]\}/);
assert.match(diaryCover, /<KeyboardAvoidingView/);
assert.match(diaryCover, /keyboardDismissMode="interactive"/);

for (const source of [diaryIndex, diaryCover]) {
  assert.match(source, /DD\/MM\/YYYY/);
  assert.match(source, /Enter dates in DD\/MM\/YYYY format, for example 05\/09\/2026/);
}
console.log('✓ Saved titles share vertical expansion and Diary dates expose an explicit accepted format');
