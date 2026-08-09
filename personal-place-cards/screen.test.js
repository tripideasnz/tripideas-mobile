import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [editor, list, tripDetail, tripEntry, personalCard, placeDetail, editorial, picker, autosaveStatus] = await Promise.all([
  read('app/personal-place-cards/[cardId].tsx'),
  read('app/personal-place-cards/index.tsx'),
  read('app/trips/[tripId].tsx'),
  read('components/trip-entry-card.tsx'),
  read('components/personal-place-card-view.tsx'),
  read('components/place-detail-content.tsx'),
  read('app/(tabs)/(discover)/place/[slug].tsx'),
  read('photo-uploads/picker.ts'),
  read('components/ui/autosave-status.tsx'),
]);

assert.match(editor, /parsePersonalPlaceCardCoordinates\(latitude, longitude\)/);
assert.match(list, /activeAttachmentCount > 0/);
assert.match(list, /Remove this Place Card from/);
assert.match(list, /Delete Personal Place/);
console.log('✓ index deletion preserves the attached-card guard');

assert.match(tripDetail, /useFocusEffect\(/);
assert.match(tripDetail, /void refresh\(\)/);
console.log('✓ Trip detail refreshes canonical entries whenever it regains focus');

const hierarchy = [
  'hero.url',
  '{title}',
  '{body ?',
  '{location ?',
  '<PlacePhotoGrid',
];
let previous = -1;
for (const marker of hierarchy) {
  const position = placeDetail.indexOf(marker);
  assert.ok(position > previous, `${marker} is out of the finished Place hierarchy`);
  previous = position;
}
assert.match(editor, /<PlaceDetailContent/);
assert.match(editor, /galleryImages=\{galleryImages\}/);
assert.match(editor, /titleActions=\{/);
assert.match(editor, /icon="edit"/);
assert.match(editor, /if \(!isEditing\)/);
assert.match(placeDetail, /PlacePhotoGrid/);
assert.match(editor, /Show on TripIdeas\.nz Map/);
assert.match(editorial, /<PlaceDetailContent/);
console.log('✓ editorial and Personal Place views share the finished Place hierarchy');

assert.match(editor, /PERSONAL_PLACE_AUTOSAVE_DELAY_MS/);
assert.match(editor, /<AutosaveStatus/);
assert.match(autosaveStatus, /accessibilityLiveRegion="polite"/);
assert.doesNotMatch(editor, /label="Save text"/);
assert.match(editor, /maxLength=\{200\}/);
assert.match(editor, /maxLength=\{10_000\}/);
assert.match(editor, /pickPhotosForUpload\(remainingBodySlots\)/);
assert.match(editor, /pendingBodyPreviews/);
assert.match(editor, /replacePersonalPlaceCardPhoto/);
assert.match(editor, /borderRadius: Radius\.pill/);
assert.match(picker, /allowsMultipleSelection: true/);
assert.match(picker, /orderedSelection: true/);
assert.match(picker, /selectionLimit/);
console.log('✓ edit mode uses autosave, ordered multi-select, previews, and circled removal controls');

assert.doesNotMatch(editor, /label="↑"|label="↓"/);
assert.doesNotMatch(editor, /Delete Personal Place/);
assert.doesNotMatch(personalCard, /Ready for Trips|Needs details/);
const editModeStart = editor.indexOf('const mainPreviewUrl');
const attachmentControls = editor.indexOf("label={attached ? 'Added' : 'Add to Trip'}");
assert.ok(attachmentControls > editModeStart);
assert.match(tripEntry, /name="more-horiz"/);
assert.match(tripEntry, /Remove from Trip/);
assert.match(tripEntry, /Delete from Trip Idea\?/);
assert.match(tripEntry, /underlying place will not be deleted/);
console.log('✓ Personal Place presentation omits readiness controls and Trip deletion remains scoped');

assert.match(list, /accessibilityLabel="Add Personal Place"/);
assert.match(list, /name="add" size=\{30\}/);
assert.match(list, /<PersonalPlaceCardView card=\{card\} compact/);
assert.match(list, /icon="delete-outline"/);
assert.match(personalCard, /<TripImageCollage/);
assert.match(personalCard, /slice\(0, 4\)/);
assert.match(editor, /\.\.\. show more/);
assert.match(editor, /\.\.\. show less/);
assert.match(editor, /fontSize: 18, fontWeight: '700'/);
assert.doesNotMatch(editor, />Trip readiness</);
assert.match(editor, /Ready to add to Trips\./);
console.log('✓ index and finished view use the canonical Saved interaction grammar');
