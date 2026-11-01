// Dynamic Type: constrained controls cap their own label growth and rows stack at larger text sizes, while body
// text is never capped anywhere (no global limit, no allowFontScaling={false}).
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { createElement, find, findAll, render } from './render-harness.js';
const { AppButton } = await import('./ui/app-button.tsx');
const { AppChip } = await import('./ui/app-chip.tsx');
const { CONTROL_MAX_FONT_SCALE, STACK_ROWS_AT_FONT_SCALE } = await import('../constants/design.ts');
const { shouldStackRows } = await import('../lib/text-scale.ts');

const root = new URL('..', import.meta.url).pathname;
const tests = [];
const test = (name, run) => tests.push({ name, run });
const read = (path) => readFile(join(root, path), 'utf8');

async function sources(dir, found = []) {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'ios', 'android', '.expo', 'dist'].includes(entry.name)) await sources(path, found);
    } else if (/\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

test('the control limit is 1.4× and rows stack from a 1.2× system text scale', () => {
  assert.equal(CONTROL_MAX_FONT_SCALE, 1.4);
  assert.equal(STACK_ROWS_AT_FONT_SCALE, 1.2);
});

test('rows stay side by side at the default and Larger Text steps up to xLarge, and stack from xxLarge', () => {
  // iOS Dynamic Type multipliers: large 1, xLarge 1.118, xxLarge 1.235, xxxLarge 1.353, AX1 1.786, AX5 3.571.
  assert.deepEqual([1, 1.118].map(shouldStackRows), [false, false]);
  assert.deepEqual([1.235, 1.353, 1.786, 2.143, 3.571].map(shouldStackRows), [true, true, true, true, true]);
});

test('AppButton: every label is capped; fitLabel makes it a single line that shrinks to 80% instead of breaking', () => {
  const plain = find(render(createElement(AppButton, { label: 'Add to Trip', onPress() {} })), (n) => n.type === 'Text');
  assert.equal(plain.props.maxFontSizeMultiplier, 1.4);
  assert.equal(plain.props.adjustsFontSizeToFit, false);
  assert.equal(plain.props.numberOfLines, undefined);
  const fitted = find(render(createElement(AppButton, { fitLabel: true, label: 'Add body photos', onPress() {} })), (n) => n.type === 'Text');
  assert.equal(fitted.props.adjustsFontSizeToFit, true);
  assert.equal(fitted.props.numberOfLines, 1);
  assert.equal(fitted.props.minimumFontScale, 0.8);
  assert.equal(fitted.props.maxFontSizeMultiplier, 1.4);
});

test('AppChip labels are capped like other controls', () => {
  const label = findAll(render(createElement(AppChip, { label: 'Hiking', onPress() {} })), (n) => n.type === 'Text');
  assert.ok(label.length >= 1 && label.every((l) => l.props.maxFontSizeMultiplier === 1.4));
});

test('filter-sheet header and the custom Saved header cap their title and actions, with single-line fitted titles', async () => {
  const sheet = await read('components/map/filter-sheet.tsx');
  assert.equal((sheet.match(/maxFontSizeMultiplier=\{CONTROL_MAX_FONT_SCALE\}/g) ?? []).length, 3, 'Cancel/Apply, title, Clear');
  assert.match(sheet, /adjustsFontSizeToFit[\s\S]*?minimumFontScale=\{0\.7\}[\s\S]*?numberOfLines=\{1\}/);
  assert.match(sheet, /minWidth: 72/, 'slots keep their default-size width');
  const header = await read('components/ui/saved-header.tsx');
  assert.match(header, /maxFontSizeMultiplier=\{CONTROL_MAX_FONT_SCALE\}/);
});

test('Add to Trip rows stay horizontal: Trip name left, fixed-width action beside it, label fitted on one line', async () => {
  const editor = await read('app/personal-place-cards/[cardId].tsx');
  assert.doesNotMatch(editor, /shouldStackRows|stacked/);
  assert.match(editor, /style=\{\{ alignItems: 'center', flexDirection: 'row', gap: Space\.sm \}\}>\s*<Text style=\{\{ flex: 1, \.\.\.Type\.body \}\}>\{trip\.name\}<\/Text>/);
  assert.match(editor, /fitLabel\s+label=\{attached \? 'Added' : 'Add to Trip'\}/);
  assert.match(editor, /style=\{\{ width: TRIP_ACTION_WIDTH \}\}/);
  assert.match(editor, /const TRIP_ACTION_WIDTH = 120;/);
});

test('no blanket cap: only controls set a limit, nothing disables scaling, and AppText leaves body text uncapped', async () => {
  const appText = await read('components/ui/app-text.tsx');
  assert.doesNotMatch(appText, /maxFontSizeMultiplier|allowFontScaling/);
  const allowed = new Set([
    'components/map/filter-sheet.tsx',
    'components/ui/app-button.tsx',
    'components/ui/app-chip.tsx',
    'components/ui/saved-header.tsx',
    'components/ui/segmented-control.tsx',
  ]);
  const offenders = [];
  for (const file of await sources('.')) {
    const rel = relative(root, join(root, file));
    if (rel.endsWith('.test.js')) continue;
    const text = await read(rel);
    if (/allowFontScaling=\{false\}|Text\.defaultProps|TextInput\.defaultProps/.test(text)) offenders.push(`${rel}: disables or globally sets text props`);
    if (/maxFontSizeMultiplier/.test(text) && !allowed.has(rel)) offenders.push(`${rel}: unexpected font cap`);
  }
  assert.deepEqual(offenders, []);
});

let failed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
