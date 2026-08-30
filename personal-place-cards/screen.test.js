import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [editor, list, tripDetail, tripEntry, personalCard, placeDetail, editorial, picker, autosaveStatus, showMore, sharedRemove] = await Promise.all([
  read('app/personal-place-cards/[cardId].tsx'),
  read('app/personal-place-cards/index.tsx'),
  read('app/trips/[tripId].tsx'),
  read('components/trip-entry-card.tsx'),
  read('components/personal-place-card-view.tsx'),
  read('components/place-detail-content.tsx'),
  read('app/(tabs)/(discover)/place/[slug].tsx'),
  read('photo-uploads/picker.ts'),
  read('components/ui/autosave-status.tsx'),
  read('components/ui/show-more-text.tsx'),
  read('components/ui/contained-remove-button.tsx'),
]);

assert.doesNotMatch(editor, /accessibilityLabel="Latitude"|accessibilityLabel="Longitude"|Confirm location/);
assert.match(editor, /label="Locate now"/);
assert.match(editor, /label="Locate on map"/);
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
];
let previous = -1;
for (const marker of hierarchy) {
  const position = placeDetail.indexOf(marker);
  assert.ok(position > previous, `${marker} is out of the finished Place hierarchy`);
  previous = position;
}
assert.match(editor, /<PlaceDetailContent/);
assert.match(editor, /galleryImages=\{galleryImages\}/);
assert.match(editor, /galleryPosition="before-location"/);
assert.match(placeDetail, /galleryPosition === 'before-location'[\s\S]*\{location \?/);
assert.match(editor, /titleActions=\{/);
assert.match(editor, /icon="edit"/);
assert.match(editor, /if \(!isEditing\)/);
assert.match(placeDetail, /PlacePhotoGrid/);
assert.match(placeDetail, /\{location \?[\s\S]*galleryPosition === 'after-location'/);
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
assert.match(editor, /10 - bodyMedia\.length - pendingBodyPreviews\.length/);
assert.match(editor, /\{bodyMedia\.length\} of 10 body photos/);
assert.doesNotMatch(editor, /bodyMedia\.length \+ pendingBodyPreviews\.length/);
assert.match(editor, /failedPhotoUploadMessage\(failedBodyPhotoCount\)/);
assert.doesNotMatch(editor, /Upload paused/);
assert.doesNotMatch(editor, /Retry photo uploads/);
assert.match(editor, /label="Try again"/);
assert.match(editor, /hasRetryableBodyPhotos \? <AppButton/);
assert.match(editor, /label="Try again"[\s\S]{0,500}resumePersonalPlaceCardPhotos\(/);
assert.match(editor, /preview\.state === 'uploading' \? <StatusText>Uploading…<\/StatusText> : null/);
assert.match(editor, /if \(!uploaded\) throw new Error\('Photo upload remains incomplete\.'\)/);
assert.match(editor, /replacePersonalPlaceCardPhoto/);
assert.match(sharedRemove, /borderRadius: Radius\.pill/);
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
assert.match(tripEntry, /icon="delete-outline"/);
assert.match(tripEntry, /Remove \$\{title\} from Trip/);
assert.match(tripEntry, /Delete from Trip Idea\?/);
assert.match(tripEntry, /underlying place will not be deleted/);
console.log('✓ Personal Place presentation omits readiness controls and Trip deletion remains scoped');

assert.match(list, /accessibilityLabel="Add Personal Place"/);
assert.match(list, /name="add" size=\{30\}/);
assert.match(list, /alignSelf: 'flex-end'/);
assert.match(list, /height: 44[\s\S]{0,180}width: 44/);
assert.match(list, /<PersonalPlaceCardView card=\{card\} compact/);
assert.match(list, /icon="delete-outline"/);
assert.match(personalCard, /<TripImageCollage/);
assert.match(personalCard, /slice\(0, 4\)/);
assert.match(personalCard, /params: \{ cardId: card\.id, mode: 'view' \}/);
assert.match(editor, /setIsEditing\(initialMode === 'edit'\)/);
assert.match(editor, /<ShowMoreText/);
assert.match(showMore, /numberOfLines=\{expanded \? undefined : 3\}/);
assert.match(showMore, /\.\.\. show more/);
assert.match(showMore, /\.\.\. show less/);
assert.match(editorial, /<ShowMoreText/);
assert.match(editorial, /const collapsedText = fullText \|\| displayText/);
assert.match(editorial, /place\.textBlocks\?\.filter\(\(block\) => block\.style !== 'h3'\)/);
assert.match(editorial, /value=\{collapsedText \?\? ''\}/);
assert.doesNotMatch(editorial, /read more|EXCERPT_LENGTH/i);
assert.match(editor, /textVariant="title"/);
assert.match(editor, /<FinishEditAction accessibilityLabel="Finish editing Personal Place"/);
assert.doesNotMatch(editor, /check-circle|color=\{Palette\.success\}/);
assert.match(editor, /semantic="edit"/);
assert.match(editor, /<ContainedRemoveButton/);
assert.match(editor, /<PlacePhotoGrid[\s\S]*onRemoveImage=/);
assert.doesNotMatch(editor, />Trip readiness</);
assert.match(editor, /Ready to add to Trips\./);
console.log('✓ index and finished view use the canonical Saved interaction grammar');
