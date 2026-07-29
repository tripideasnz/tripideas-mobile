import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [saved, list, detail, sharing, layout] = await Promise.all([
  read('app/(tabs)/saved.tsx'),
  read('app/notebooks/index.tsx'),
  read('app/notebooks/[notebookId].tsx'),
  read('app/notebooks/[notebookId]/sharing.tsx'),
  read('app/_layout.tsx'),
]);

assert.doesNotMatch(saved, /Photo transport test|photo-upload-dev/);
console.log('✓ Saved no longer exposes the Photo transport test');

assert.match(list, /headerRight/);
assert.match(list, /Updated \$\{displayDate\(notebook\.updatedAt\)\}/);
assert.doesNotMatch(list, /testID="notebook-(open|delete)-action"/);
console.log('✓ Notebook Home uses a compact add action and left-aligned metadata rows');

assert.match(detail, /accessibilityLabel="Share this Notebook"/);
assert.match(detail, /name="share-outline"/);
assert.match(detail, /label="Delete"/);
assert.doesNotMatch(detail, /Manage Sharing|Delete Notebook"/);
assert.match(detail, /justifyContent: 'space-between'/);
console.log('✓ Notebook header presents Share and destructive Delete on one row');

assert.match(layout, /presentation: 'formSheet'/);
assert.match(layout, /sheetAllowedDetents/);
assert.match(layout, /sheetInitialDetentIndex: 1/);
const sharingActions = [
  'label="Copy Link"',
  'label="Share…"',
  "'Generate New Link'",
  "'Stop Sharing'",
];
let previousAction = -1;
for (const action of sharingActions) {
  const position = sharing.indexOf(action);
  assert.ok(position > previousAction, `${action} is out of order`);
  previousAction = position;
}
assert.match(sharing, /Shared Notebook preview/);
console.log('✓ sharing opens as a preview-backed action sheet in the approved order');

assert.match(detail, /borderColor: Palette\.border/);
assert.match(detail, /\.\.\. show more/);
assert.match(detail, /onPress=\{\(\) => setDescriptionEditing\(true\)\}/);
assert.match(detail, /setDescriptionExpanded\(\(current\) => !current\)/);
console.log('✓ description is bordered, collapsible, and remains editable');

assert.doesNotMatch(detail, /<AppText variant="cardTitle">Pages<\/AppText>/);
assert.match(detail, /label="Add Page"/);
assert.match(detail, /fontWeight: '700'/);
console.log('✓ Add Page stands alone above bold page titles');

assert.doesNotMatch(detail, /label="‹  Previous"|label="Next  ›"/);
assert.match(detail, /icon="arrow-up"/);
assert.match(detail, /icon="arrow-down"/);
assert.match(detail, /adjacentContentPageId/);
assert.match(detail, /blockOffsets\.current\[page\.id\] = y/);
assert.match(detail, /setHighlightedPageId/);
console.log('✓ compact arrows navigate and briefly highlight ordered pages');

assert.doesNotMatch(detail, /ReanimatedSwipeable|renderRightActions/);
assert.match(detail, /name="trash-outline"/);
assert.match(detail, /'Delete this page\?'/);
assert.match(detail, /'Delete Page'/);
assert.doesNotMatch(layout, /GestureHandlerRootView/);
console.log('✓ subtle Page trash control replaces swipe-to-delete');

assert.match(detail, /accessibilityLabel="Remove photo from page"/);
assert.match(detail, /position: 'absolute'/);
assert.match(detail, />\s*×\s*<\/AppText>/);
assert.doesNotMatch(detail, /label="Remove Photo"/);
console.log('✓ Photo removal uses the compact overlapping × control');
