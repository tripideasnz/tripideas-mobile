// Two button pairs share the Location / Photos mechanism: Favourites / Search TripIdeas (Add places to Trip) and
// Save / Cancel (Trip name editing). Each is one ButtonRow of standard AppButtons: equal slots, one line, same
// type and height as the other pairs. Their behaviour is the one they had before.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const picker = await read('components/trip-place-picker.tsx');
const detail = await read('app/trips/[tripId].tsx');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const rowOf = (source) => source.match(/<ButtonRow>[\s\S]*?<\/ButtonRow>/g) ?? [];
const buttonsIn = (row) => row.split('<AppButton').slice(1).map((part) => `<AppButton${part}`);

test('Add places to Trip: Favourites and Search TripIdeas are one ButtonRow of fitted AppButtons', () => {
  const rows = rowOf(picker);
  assert.equal(rows.length, 1);
  const [favourites, search] = buttonsIn(rows[0]);
  assert.equal(buttonsIn(rows[0]).length, 2);
  assert.match(favourites, /\bfitLabel\b[^>]*label="Favourites"/);
  assert.match(search, /\bfitLabel\b[^>]*label="Search TripIdeas"/);
  // Default size, no per-button style: widths and heights come from ButtonRow like Location / Photos.
  for (const button of [favourites, search]) {
    assert.doesNotMatch(button, /size=|style=|flex/);
  }
  assert.doesNotMatch(picker, /alignItems: 'stretch', gap: Space\.sm/, 'the hand-built row is gone');
});

test('Favourites / Search keep their selection colours, disabled state and handlers', () => {
  const [favourites, search] = buttonsIn(rowOf(picker)[0]);
  assert.match(favourites, /variant=\{source === 'favourites' \? 'primary' : 'secondary'\}/);
  assert.match(search, /variant=\{source === 'search' \? 'primary' : 'secondary'\}/);
  assert.match(favourites, /disabled=\{adding\}/);
  assert.match(search, /disabled=\{adding\}/);
  assert.match(favourites, /onPress=\{\(\) => setSource\('favourites'\)\}/);
  assert.match(search, /onPress=\{\(\) => setSource\('search'\)\}/);
});

test('Trip name editing: Save on the left, Cancel on the right, in one ButtonRow of standard AppButtons', () => {
  const rows = rowOf(detail);
  assert.equal(rows.length, 1);
  const [save, cancel] = buttonsIn(rows[0]);
  assert.equal(buttonsIn(rows[0]).length, 2);
  assert.match(save, /label="Save"/);
  assert.match(cancel, /label="Cancel"/);
  assert.match(cancel, /variant="secondary"/);
  assert.doesNotMatch(save, /variant=/, 'Save is the primary button');
  for (const button of [save, cancel]) assert.doesNotMatch(button, /size=|style=/);
});

test('Trip name editing keeps its validation, disabled state and handlers', () => {
  const [save, cancel] = buttonsIn(rowOf(detail)[0]);
  assert.match(save, /disabled=\{!isNameDirty\}/);
  assert.match(save, /onPress=\{\(\) => void saveName\(\)\}/);
  assert.match(cancel, /onPress=\{cancelNameEdit\}/);
  assert.match(detail, /const isNameDirty = /);
  assert.match(detail, /const saveName = /);
  assert.match(detail, /const cancelNameEdit = /);
  // The hand-built Save / Cancel buttons (14 pt labels, no minimum height) are gone.
  assert.doesNotMatch(detail, /paddingVertical: Space\.md,\s*\}\)\}>\s*<Text[\s\S]{0,120}Type\.label/);
  assert.equal((detail.match(/Type\.label/g) ?? []).length, 0);
});

test('only these two screens changed their buttons: the other Trip detail controls are as before', () => {
  assert.match(detail, /accessibilityLabel="Edit trip name"/);
  assert.match(detail, /<IconAction/);
});

let failed = 0;
for (const { name, run } of tests) {
  try { await run(); console.log(`✓ ${name}`); } catch (error) { failed += 1; console.error(`✗ ${name}`); console.error(error); }
}
if (failed) process.exitCode = 1;
