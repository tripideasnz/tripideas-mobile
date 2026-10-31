// C5B: in the Personal Place editor the two photo actions sit side by side directly under the
// "Photos" heading, equal in width, height and style, in create and edit alike (one editor screen).
// The pickers, upload, retry and removal behind them are the ones that were there before.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const editor = await readFile(new URL('../app/personal-place-cards/[cardId].tsx', import.meta.url), 'utf8');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const row = editor.match(/\{\/\* Both photo actions share one row[\s\S]*?\n        <\/View>\n        \{mainMedia \? \(/)?.[0] ?? '';
const buttons = row.match(/<AppButton[\s\S]*?\n          \/>/g) ?? [];
const locationRow = editor.match(/<AppText variant="section">Location<\/AppText>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<View style=\{\{ flexDirection: 'row', gap: Space\.sm \}\}>[\s\S]*?<\/View>\s*\{locateNow\.status/)?.[0] ?? '';
const locationButtons = locationRow.match(/<AppButton[\s\S]*?(?:\n        \/>|variant="secondary" \/>)/g) ?? [];

test('both photo buttons share one row directly under the Photos heading', () => {
  assert.ok(row, 'row found');
  assert.ok(editor.indexOf('<AppText variant="section">Photos</AppText>') < editor.indexOf('Both photo actions share one row'));
  assert.match(row, /^\{\/\* Both photo actions share one row[^*]*\*\/\}\n        <View style=\{\{ flexDirection: 'row', gap: Space\.sm \}\}>/);
  assert.equal(buttons.length, 2);
  assert.match(buttons[0], /label=\{mainMedia \? 'Change main photo' : 'Add main photo'\}/);
  assert.match(buttons[1], /label="Add body photos"/);
});

const signature = (button) => ({
  size: button.match(/size="(\w+)"/)?.[1] ?? 'default',
  style: button.match(/style=\{\{([^}]*)\}\}/)?.[1].trim(),
  variant: button.match(/variant="(\w+)"/)?.[1] ?? 'primary',
});

test('the two photo buttons are equal in size and width: primary on the left, outlined on the right', () => {
  assert.deepEqual(signature(buttons[0]), { size: 'default', style: 'borderColor: Palette.primary, borderWidth: 1, flex: 1', variant: 'primary' });
  assert.deepEqual(signature(buttons[1]), { size: 'default', style: 'flex: 1', variant: 'secondary' });
});

test('the Photos row is built exactly like the Location row: same component, size, widths, spacing and variants', () => {
  assert.equal(locationButtons.length, 2, 'Locate now and Locate on map found');
  assert.match(locationButtons[0], /'Locate now'/);
  assert.match(locationButtons[1], /label="Locate on map"/);
  assert.deepEqual(buttons.map(signature), locationButtons.map(signature), 'identical size, width and variant, left to right');
  assert.match(locationRow, /<View style=\{\{ flexDirection: 'row', gap: Space\.sm \}\}>/);
  assert.match(row, /<View style=\{\{ flexDirection: 'row', gap: Space\.sm \}\}>/, 'same row spacing');
});

test('no photo button is left outside the row, and no left-aligned stray body button remains', () => {
  assert.equal((editor.match(/label="Add body photos"/g) ?? []).length, 1);
  assert.equal((editor.match(/'Add main photo'/g) ?? []).length, 1);
  assert.doesNotMatch(editor, /<View style=\{\{ alignItems: 'flex-start' \}\}>\s*<AppButton\s+disabled=\{busy \|\| remainingBodySlots === 0\}/);
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
  // The main photo tile still replaces on tap and removes with its own control; the body grid is unchanged.
  assert.match(editor, /accessibilityLabel="Replace main photo"[\s\S]*?onPress=\{replaceMainPhoto\}/);
  assert.match(editor, /onRemove=\{\(\) => void removePhoto\(mainMedia\)\}/);
  assert.match(editor, /Remove body photo|ContainedRemoveButton/);
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
