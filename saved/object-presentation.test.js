import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [shared, completed, icons, notebook, diary, photoGrid, remove, autosave, floating, shell, focus, notebookToolbar, diaryToolbar, saved] = await Promise.all([
  read('components/ui/saved-object-presentations.tsx'), read('components/ui/completed-place.tsx'), read('components/ui/saved-object-icons.ts'), read('app/notebooks/[notebookId].tsx'), read('app/diaries/[diaryId]/day.tsx'), read('components/place-photo-grid.tsx'), read('components/ui/contained-remove-button.tsx'), read('components/ui/saved-autosave-field.tsx'), read('components/ui/floating-content-add.tsx'), read('components/ui/saved-object-editor-shell.tsx'), read('components/ui/saved-object-focus.tsx'), read('components/notebook/object-toolbar.tsx'), read('components/diary/object-toolbar.tsx'), read('app/(tabs)/saved.tsx'),
]);

for (const screen of [notebook, diary]) {
  for (const renderer of ['SavedLinkObject', 'SavedPlaceObject', 'SavedPinObject']) assert.match(screen, new RegExp(renderer));
  assert.match(screen, /FloatingContentAdd/);
  assert.match(screen, /SavedObjectFocusScope/);
}
assert.match(shared, /color=\{Palette\.trip\}/);
assert.match(shared, /accessibilityRole="link"/);
assert.match(shared, /TRIPIDEAS PLACE/);
assert.match(shared, /PERSONAL PLACE/);
assert.match(completed, /This Place is unavailable/);
assert.doesNotMatch(shared, />Show on Map</);
assert.match(shared, /accessibilityLabel=\{`Show \$\{displayTitle\} on map`\}/);
assert.match(notebook, /kind=\{block\.reference\.kind === 'personal'/);
assert.match(diary, /kind="personal"/);
assert.match(remove, /borderColor: Palette\.danger/);
assert.match(remove, /color: Palette\.danger/);
assert.match(photoGrid, /accessibilityLabel="Close photo viewer"/);
assert.doesNotMatch(photoGrid, /visible=\{isViewerOpen\}[\s\S]*ContainedRemoveButton/);
assert.match(autosave, /Math\.min\(228/);
assert.match(autosave, /maxHeight: 228/);
assert.match(floating, />Add content</);
assert.match(floating, /keyboardHeight/);
assert.match(floating, /height: 52/);
assert.match(floating, /left: Screen\.gutter/);
assert.doesNotMatch(floating, /alignSelf: 'center'/);
assert.match(saved, /icon: SavedObjectIcons\.personalPlace/);
assert.match(shell, /useSavedObjectFocus/);
assert.match(focus, /target\.measureLayout\(inner/);
assert.match(focus, /contentRef\.current/);
assert.doesNotMatch(focus, /getInnerViewNode/);
assert.match(focus, /visibleHeight \* 0\.38/);
assert.match(focus, /Keyboard\.metrics/);
assert.match(notebook, /action === 'Photo'\) setTimeout/);
assert.match(diary, /action === 'Photo'\) setTimeout/);
assert.match(notebook, /SavedObjectReveal revealKey=/);
assert.match(notebook, /setRevealPageId\(page\.id\)/);
assert.match(notebook, /innerViewRef=\{scrollContentRef\}/);
assert.match(diary, /innerViewRef=\{scrollContentRef\}/);
for (const toolbar of [notebookToolbar, diaryToolbar]) {
  assert.match(toolbar, /SavedObjectIcons\.tripIdeasPlace/);
  assert.match(toolbar, /SavedObjectIcons\.pin/);
}
assert.notEqual(icons.match(/pin: '([^']+)'/)?.[1], icons.match(/tripIdeasPlace: '([^']+)'/)?.[1]);
assert.notEqual(icons.match(/personalPlace: '([^']+)'/)?.[1], icons.match(/tripIdeasPlace: '([^']+)'/)?.[1]);
assert.doesNotMatch(notebook, /SavedPinObject[\s\S]{0,1000}label="Locate now"/);
console.log('✓ shared object presentation, floating add, focus, icons, destructive X, Pin map action and neutral viewer Close are consistent');
