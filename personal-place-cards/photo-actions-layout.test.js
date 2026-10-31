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

test('both photo buttons share one row directly under the Photos heading', () => {
  assert.ok(row, 'row found');
  assert.ok(editor.indexOf('<AppText variant="section">Photos</AppText>') < editor.indexOf('Both photo actions share one row'));
  assert.match(row, /^\{\/\* Both photo actions share one row: equal width and height, one style\. \*\/\}\n        <View style=\{\{ flexDirection: 'row', gap: Space\.sm \}\}>/);
  assert.equal(buttons.length, 2);
  assert.match(buttons[0], /label=\{mainMedia \? 'Change main photo' : 'Add main photo'\}/);
  assert.match(buttons[1], /label="Add body photos"/);
});

test('the two buttons are identical in size, width and style', () => {
  const signature = (button) => ({
    size: button.match(/size="(\w+)"/)?.[1],
    style: button.match(/style=\{\{([^}]*)\}\}/)?.[1].trim(),
    variant: button.match(/variant="(\w+)"/)?.[1],
  });
  assert.deepEqual(signature(buttons[0]), signature(buttons[1]));
  assert.deepEqual(signature(buttons[0]), { size: 'compact', style: 'flex: 1', variant: 'secondary' });
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
