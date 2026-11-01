// In the Personal Place editor the Location row and the Photos row are one design: primary (black) on the left,
// outlined on the right, equal in width and height, built from the same ButtonRow in create and edit alike (one editor
// screen), side by side at every text size: a label that needs more room shrinks instead of the row changing shape.
// The pickers, upload, retry and removal behind the photo buttons are the ones that were there before.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const editor = await readFile(new URL('../app/personal-place-cards/[cardId].tsx', import.meta.url), 'utf8');
const buttonRowSource = await readFile(new URL('../components/ui/button-row.tsx', import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const row = editor.match(/\{\/\* Both photo actions share one row[\s\S]*?<\/ButtonRow>/)?.[0] ?? '';
const locationRow = editor.match(/<AppText variant="section">Location<\/AppText>\s*\{\/\*[\s\S]*?\*\/\}\s*<ButtonRow>[\s\S]*?<\/ButtonRow>/)?.[0] ?? '';
const buttonsIn = (source) => source.split('<AppButton').slice(1).map((part) => `<AppButton${part}`);
const buttons = buttonsIn(row);
const locationButtons = buttonsIn(locationRow);

const signature = (button) => ({
  fitLabel: /\bfitLabel\b/.test(button),
  size: button.match(/size="(\w+)"/)?.[1] ?? 'default',
  style: /\bstyle=\{/.test(button),
  variant: button.match(/variant="(\w+)"/)?.[1] ?? 'primary',
});

test('both photo buttons share one ButtonRow directly under the Photos heading', () => {
  assert.ok(row, 'row found');
  assert.ok(editor.indexOf('<AppText variant="section">Photos</AppText>') < editor.indexOf('Both photo actions share one row'));
  assert.match(row, /^\{\/\* Both photo actions share one row[^*]*\*\/\}\s*<ButtonRow>/);
  assert.equal(buttons.length, 2);
  assert.match(buttons[0], /label="Main photo"/);
  assert.match(buttons[1], /label="Body photos"/);
  // The spoken names stay descriptive.
  assert.match(buttons[0], /accessibilityLabel=\{mainMedia \? 'Change main photo' : 'Add main photo'\}/);
  assert.match(buttons[1], /accessibilityLabel="Add body photos"/);
});

test('the two photo buttons are equal in size and width: primary on the left, outlined on the right', () => {
  assert.deepEqual(signature(buttons[0]), { fitLabel: true, size: 'default', style: false, variant: 'primary' });
  assert.deepEqual(signature(buttons[1]), { fitLabel: true, size: 'default', style: false, variant: 'secondary' });
});

test('the Photos row is built exactly like the Location row: same component, size, variants and fitted labels', () => {
  assert.equal(locationButtons.length, 2, 'Locate now and Locate on map found');
  assert.match(locationButtons[0], /'Locate now'/);
  assert.match(locationButtons[1], /label="Locate on map"/);
  assert.deepEqual(buttons.map(signature), locationButtons.map(signature), 'identical size and variant, left to right');
});

test('widths and heights come from ButtonRow: no per-button flex or border workaround remains', () => {
  for (const button of [...buttons, ...locationButtons]) {
    assert.doesNotMatch(button, /flex: 1|borderWidth|borderColor/);
  }
  assert.doesNotMatch(row, /flexDirection: 'row'/);
});

test('ButtonRow: always side by side in equal slots, with buttons filling their slot; it never stacks', () => {
  assert.doesNotMatch(buttonRowSource, /useStackedRows|shouldStackRows|stacked/);
  assert.match(buttonRowSource, /<View style=\{\{ flexDirection: 'row', gap: Space\.sm \}\}>/);
  assert.match(buttonRowSource, /<View key=\{index\} style=\{\{ flex: 1 \}\}>/, 'equal slots with no padding or border of their own');
  assert.match(buttonRowSource, /\{ flexGrow: 1 \}/, 'the button fills its slot, so both are equally high');
});

test('behaviour behind the buttons is unchanged: pickers, guards, previews, upload and refresh', () => {
  assert.match(buttons[0], /onPress=\{mainMedia \? replaceMainPhoto : \(\) => void act\(async \(\) => \{\s*const selected = await pickPhotoForUpload\(\);/);
  assert.match(buttons[0], /setPendingMainPreview\(selected\.uri\);/);
  assert.match(buttons[0], /addPersonalPlaceCardPhoto\(\s*session\.userId,\s*card\.id,\s*'main',/);
  assert.match(buttons[0], /disabled=\{busy\}/);
  assert.match(buttons[1], /disabled=\{busy \|\| remainingBodySlots === 0\}/);
  assert.match(buttons[1], /pickPhotosForUpload\(remainingBodySlots\)/);
  assert.match(buttons[1], /'body',/);
  assert.match(buttons[1], /await refreshPendingBodyPreviews\(\);/);
  assert.match(locationButtons[0], /onPress=\{\(\) => void locateNow\.locate\(\)\}/);
  assert.match(locationButtons[0], /disabled=\{locateNow\.isBusy\}/);
  assert.match(locationButtons[1], /pathname: '\/personal-place-cards\/location-picker'/);
  // The main photo tile still replaces on tap and removes with its own control; the body grid is unchanged.
  assert.match(editor, /accessibilityLabel="Replace main photo"[\s\S]*?onPress=\{replaceMainPhoto\}/);
  assert.match(editor, /onRemove=\{\(\) => void removePhoto\(mainMedia\)\}/);
  assert.match(editor, /Remove body photo|ContainedRemoveButton/);
});

test('no photo button is left outside the row, and no left-aligned stray body button remains', () => {
  assert.equal((editor.match(/label="Body photos"/g) ?? []).length, 1);
  assert.equal((editor.match(/label="Main photo"/g) ?? []).length, 1);
  assert.doesNotMatch(editor, /<View style=\{\{ alignItems: 'flex-start' \}\}>\s*<AppButton\s+disabled=\{busy \|\| remainingBodySlots === 0\}/);
});

test('one editor serves both create and edit, so one layout covers both', () => {
  assert.equal((editor.match(/Both photo actions share one row/g) ?? []).length, 1);
  assert.match(editor, /const \[isEditing, setIsEditing\] = useState\(initialMode === 'edit'\);/);
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
