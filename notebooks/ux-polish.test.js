import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [saved, list, detail, sharing, layout, collage, expandable, status] = await Promise.all([
  read('app/(tabs)/saved.tsx'),
  read('app/notebooks/index.tsx'),
  read('app/notebooks/[notebookId].tsx'),
  read('app/notebooks/[notebookId]/sharing.tsx'),
  read('app/_layout.tsx'),
  read('components/trip-image-collage.tsx'),
  read('components/ui/expandable-text.tsx'),
  read('components/ui/autosave-status.tsx'),
]);

assert.doesNotMatch(saved, /Photo transport test|photo-upload-dev/);
console.log('✓ Saved no longer exposes the Photo transport test');

assert.match(list, /headerRight/);
assert.equal(list.match(/<Stack\.Screen/g)?.length, 1);
assert.match(list, /HeaderBackButton color=\{Palette\.trip\} onPress=\{handleBack\}/);
assert.match(list, /headerRight: \(\) => session \? \(/);
assert.match(list, /isLoadingSession \? \([\s\S]*!session \? \(/);
assert.match(list, /MaterialIcons color=\{Palette\.trip\} name="add" size=\{30\}/);
assert.match(list, /Updated \$\{displayDate\(notebook\.updatedAt\)\}/);
assert.match(list, /borderRadius: Radius\.card/);
assert.match(list, /<TripImageCollage/);
assert.match(list, /emptyLabel="Notebook"/);
assert.match(list, /firstPhotos/);
assert.match(list, /coverUrlCacheRef/);
assert.match(list, /cachedUrl/);
assert.match(list, /onCoverImageError/);
assert.match(collage, /onImageError/);
assert.match(list, /accessibilityLabel=\{`Delete \$\{notebook\.title\}`\}/);
assert.match(list, /'Delete Notebook\?'/);
assert.match(collage, /emptyLabel/);
assert.doesNotMatch(list, /testID="notebook-(open|delete)-action"/);
console.log('✓ Notebook list matches the Trips header and tappable card grammar');

assert.match(detail, /accessibilityLabel="Share this Notebook"/);
assert.match(detail, /icon="share"/);
assert.match(detail, /accessibilityLabel="Add Page"/);
assert.ok(detail.indexOf('accessibilityLabel="Share this Notebook"') > detail.indexOf('accessibilityLabel="Add Page"'));
assert.doesNotMatch(detail, /More Notebook actions|Delete Notebook/);
assert.doesNotMatch(detail, /label="Delete"/);
assert.match(detail, /flex: 1,[\s\S]*fontSize: 28/);
console.log('✓ Notebook title row groups Add Page and Share actions');

assert.match(layout, /presentation: 'formSheet'/);
assert.match(layout, /sheetAllowedDetents/);
assert.match(layout, /sheetInitialDetentIndex: 1/);
const sharingActions = ['label="Copy Link"', 'label="Share…"', "'Generate New Link'", "'Stop Sharing'"];
let previousAction = -1;
for (const action of sharingActions) {
  const position = sharing.indexOf(action);
  assert.ok(position > previousAction, `${action} is out of order`);
  previousAction = position;
}
assert.match(sharing, /Shared Notebook preview/);
console.log('✓ sharing keeps its preview-backed secure action sheet');

assert.match(detail, /<ExpandableText/);
assert.match(detail, /onPress=\{\(\) => setDescriptionEditing\(true\)\}/);
assert.match(detail, /editingPageIds\.has\(item\.id\)/);
assert.match(detail, /accessibilityLabel=\{`Page \$\{index \+ 1\} body`\}/);
assert.match(expandable, /numberOfLines=\{expanded \? undefined : 3\}/);
assert.match(expandable, /\.\.\. show more/);
assert.match(expandable, /\.\.\. show less/);
console.log('✓ Notebook description reuses canonical three-line expansion');

assert.match(detail, /AUTOSAVE_DELAY_MS = 700/);
assert.match(detail, /<AutosaveStatus/);
assert.match(detail, /onRetry=/);
assert.match(status, /minHeight: 17/);
assert.match(status, /Saving…/);
assert.match(status, /Could not save\. Tap to retry\./);
console.log('✓ Notebook autosave matches Trips timing, stable status, and retry treatment');

assert.match(detail, /accessibilityLabel="Add Page"/);
assert.match(detail, /icon="add"/);
assert.match(detail, /'arrow-upward'/);
assert.match(detail, /'arrow-downward'/);
assert.match(detail, /size="compact"/);
assert.match(detail, /adjacentContentPageId/);
assert.match(detail, /blockOffsets\.current\[page\.id\] = y/);
assert.match(detail, /setHighlightedPageId/);
console.log('✓ Add and page navigation actions reuse the canonical icon treatment');

assert.doesNotMatch(detail, /ReanimatedSwipeable|renderRightActions/);
assert.match(detail, /name="ellipsis-horizontal"/);
assert.match(detail, /More actions for page/);
assert.match(detail, /'Delete this page\?'/);
assert.match(detail, /'Delete Page'/);
assert.doesNotMatch(layout, /GestureHandlerRootView/);
console.log('✓ Page deletion remains confirmed behind contextual overflow');

assert.match(detail, /accessibilityLabel="Remove photo from page"/);
assert.match(detail, /position: 'absolute'/);
assert.match(detail, />\s*×\s*<\/AppText>/);
assert.doesNotMatch(detail, /label="Remove Photo"/);
console.log('✓ Photo removal keeps the compact contextual control');
