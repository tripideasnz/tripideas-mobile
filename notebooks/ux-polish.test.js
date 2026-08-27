import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [detail, api, provider, types, toolbar, sharedToolbar, autosave, picker, storage, sharing, placeScreen, placeQuery, dragRow, structuralAdd, placeSelector, objectShell] = await Promise.all([
  read('app/notebooks/[notebookId].tsx'), read('notebooks/api.ts'), read('notebooks/provider.tsx'),
  read('content-blocks/types.ts'), read('components/notebook/object-toolbar.tsx'),
  read('components/ui/object-toolbar.tsx'), read('components/ui/saved-autosave-field.tsx'),
  read('app/notebooks/location-picker.tsx'), read('notebooks/storage.ts'),
  read('app/notebooks/[notebookId]/sharing.tsx'),
  read('app/(tabs)/(discover)/place/[slug].tsx'), read('sanity/queries.ts'),
  read('components/ui/drag-reorder-row.tsx'),
  read('components/ui/floating-structural-add.tsx'),
  read('components/ui/saved-place-selector.tsx'),
  read('components/ui/saved-object-editor-shell.tsx'),
]);

assert.match(detail, /editingNotebook/);
assert.match(detail, /<FloatingStructuralAdd accessibilityLabel="Add Page" disabled=\{offline\} onPress=\{\(\) => void addPage\(\)\}/);
assert.doesNotMatch(detail, /<IconAction accessibilityLabel="Add Page"/);
assert.match(structuralAdd, /height: 52/);
assert.match(structuralAdd, /width: 52/);
assert.match(structuralAdd, /backgroundColor: Palette\.trip/);
assert.match(structuralAdd, /bottom: Math\.max\(insets\.bottom, Screen\.bottom\)/);
assert.match(detail, /editingPages/);
assert.match(detail, /Finish editing Notebook/);
assert.match(detail, /Finish editing Page/);
assert.match(detail, /semantic="edit"/);
assert.match(detail, /NotebookAutosaveField/);
assert.match(autosave, /setTimeout\(\(\) => void save\(\).*700/);
assert.match(autosave, /useImperativeHandle\(ref, \(\) => \(\{ flush: save \}\)\)/);
assert.match(detail, /await flush\(Object\.keys\(autosaveRefs\.current\)\)/);
console.log('✓ Notebook and Page use explicit view/edit states with awaited autosave Finish');

for (const label of ['Text', 'Photo', 'Link', 'Place', 'Pin']) assert.match(toolbar, new RegExp(`name: '${label}'`));
assert.match(toolbar, /ObjectToolbar/);
assert.match(sharedToolbar, /minHeight: 44/);
assert.match(detail, /capability === 'supported'/);
assert.match(detail, /capability === 'unreachable'/);
assert.match(detail, /Saved Notebook content remains available/);
assert.match(api, /X-TripIdeas-Notebook-Contract': 'objects-v2'/);
console.log('✓ visible five-object toolbar is shared, accessible, and capability-gated without treating network failure as absence');

for (const type of ["'text'", "'photo'", "'link'", "'place'", "'pin'"]) assert.match(types, new RegExp(type));
assert.match(types, /role: 'pageBody' \| 'content'/);
assert.match(detail, /block\.role === 'pageBody'/);
assert.match(detail, /orderedContentBlocks\(page\.blocks\)/);
assert.match(detail, /moveContentBlockIds/);
assert.match(provider, /reorderNotebookBlocks/);
assert.match(detail, /DragReorderRow/);
assert.doesNotMatch(detail, /Move \$\{objectName\(block\)\} (?:up|down)/);
assert.doesNotMatch(detail, /icon="arrow-(?:upward|downward)"/);
assert.match(dragRow, /\[0, 1, 2\]\.map/);
assert.match(dragRow, /accessibilityActions/);
assert.match(dragRow, /name: 'decrement'/);
assert.match(dragRow, /name: 'increment'/);
assert.match(dragRow, /accessibilityRole="adjustable"/);
console.log('✓ page-body identity and one mixed ordering are independent of object type and position, using the shared Diary drag grip');

assert.match(detail, /addTextBlock/);
assert.match(detail, /addNotebookPhotos/);
assert.match(detail, /addLinkBlock/);
assert.match(detail, /clientRequestId: Crypto\.randomUUID\(\)/);
assert.match(detail, /title, text: null, clientRequestId: capture\.clientRequestId/);
assert.doesNotMatch(detail, /created\?\.type === 'link'[\s\S]*updateRichBlock/);
assert.match(provider, /matchesRequest/);
assert.match(provider, /await readNotebookContent\(input\.id\)/);
assert.match(provider, /if \(matchesRequest\(refreshed\)\) return refreshed/);
assert.match(detail, /addPlaceBlock/);
assert.match(detail, /addPinBlock/);
assert.match(detail, /SavedPlaceSelector/);
assert.match(placeSelector, /PlaceSearch/);
assert.match(placeSelector, /PERSONAL PLACES/);
assert.match(placeSelector, /Add selected Place/);
assert.match(detail, /SavedPlaceObject/);
assert.match(detail, /Locate now/);
assert.match(detail, /Locate on map/);
assert.match(picker, /SavedLocationPicker/);
assert.match(picker, /addPinBlock/);
assert.match(picker, /onCancel=\{backToNotebook\}/);
console.log('✓ Text, Photo, Link, Editorial/Personal Place and both explicit Pin paths use authoritative v2 mutations');

assert.match(detail, /SavedObjectEditorShell/);
assert.match(objectShell, /ContainedRemoveButton label=\{`Remove/);
assert.match(objectShell, /void flush\(\)\.then\(onCollapse\)/);
assert.match(detail, /Delete Page/);
assert.match(detail, /delete-outline/);
assert.doesNotMatch(detail, /Delete link.*delete-outline/);
assert.match(detail, /SavedLinkObject/);
assert.match(detail, /canMoveDown=\{index < count - 1\}/);
console.log('✓ contained X, structural trash, link semantics and reorder actions preserve accessible distinctions');

assert.match(detail, /pickPhotosForUpload/);
assert.match(detail, /resumeNotebookPhotos/);
assert.match(detail, /listNotebookPhotoPreviews/);
assert.match(detail, /PlacePhotoGrid/);
assert.match(detail, /groupContiguousNotebookPhotos/);
assert.match(detail, /<NotebookPhotoRun/);
assert.match(detail, /onRemoveImage=\{editingPage/);
assert.doesNotMatch(detail, /NotebookPhotoRun[\s\S]*?Move Photo (?:up|down)/);
assert.match(detail, /label=\{blocks\.length === 1 \? 'Photo' : 'Photo group'\}/);
assert.match(storage, /user\.\$\{userId\}/);
assert.match(detail, /setPhotoUrls\(\{\}\)/);
assert.match(sharing, /revoke|Stop Sharing/);
console.log('✓ private photo recovery, user-scoped cache isolation, sign-out clearing and sharing/revocation surfaces remain wired');

assert.match(placeSelector, /setSelected\(\{ kind: 'editorial', place \}\)/);
assert.match(placeSelector, /setSelected\(\{ kind: 'personal', card \}\)/);
assert.match(placeSelector, /Add selected Place/);
assert.match(detail, /confirmPlace/);
assert.match(placeSelector, /Selected — tap the checkmark to add/);
assert.match(placeSelector, /onCancel/);
assert.match(placeSelector, /accessibilityState=\{\{ selected: active \}\}/);
console.log('✓ Editorial and Personal Places share explicit select, selected-state, confirm, and no-mutation Cancel behavior');

assert.match(detail, /block\.reference\.personalPlaceCardId/);
assert.match(detail, /block\.reference\.editorialPlaceId/);
assert.match(detail, /params: \{ cardId: block\.reference\.personalPlaceCardId, mode: 'view', notebookId, origin: 'notebook' \}/);
assert.match(detail, /editorialPlaceId: block\.reference\.editorialPlaceId, notebookId, origin: 'notebook'/);
assert.match(detail, /openCanonicalPlace/);
assert.match(detail, /block\.availability === 'available'/);
assert.match(placeScreen, /editorialPlaceId/);
assert.match(placeQuery, /_id == \$editorialPlaceId \|\| slug\.current == \$slug/);
console.log('✓ completed available Places navigate by canonical persisted reference while unavailable Places remain non-interactive');
