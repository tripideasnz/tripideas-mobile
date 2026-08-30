import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const [editor, list, tripDetail, tripEntry, personalCard, placeDetail, editorial, picker, autosaveStatus, showMore, sharedRemove, provider, mapPreview] = await Promise.all([
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
  read('personal-place-cards/provider.tsx'),
  read('components/place-map-preview.tsx'),
]);

assert.doesNotMatch(editor, /accessibilityLabel="Latitude"|accessibilityLabel="Longitude"|Confirm location/);
assert.match(editor, /label="Locate now"/);
assert.match(editor, /label="Locate on map"/);
assert.match(mapPreview, /camera\.current\?\.easeTo/);
assert.match(mapPreview, /center: \[longitude, latitude\]/);
assert.match(mapPreview, /zoom: 13/);
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
assert.match(editor, /listPersonalPlaceCardPhotoPreviews/);
assert.match(editor, /pendingBodyPreviews/);
assert.match(editor, /aspectRatio: 1/);
assert.match(editor, /Loading photo…/);
assert.match(editor, /Upload paused/);
assert.match(editor, /Retry photo uploads/);
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

assert.match(list, /headerAddAction\(\{/);
assert.match(list, /accessibilityLabel: 'Add Personal Place'/);
assert.match(list, /<PersonalPlaceCardView card=\{card\} compact/);
assert.match(list, /gap: Space\.lg/);
assert.match(list, /icon="delete-outline"/);
assert.match(personalCard, /<TripImageCollage/);
assert.match(personalCard, /slice\(0, 4\)/);
assert.match(personalCard, /style=\{\{ height: 92, width: 112 \}\}/);
assert.match(personalCard, /compact \? Palette\.textMuted : Palette\.textBody/);
assert.match(personalCard, /compact \? Type\.label : Type\.body/);
assert.doesNotMatch(personalCard, /PlaceCardPresentation|editorialIndex/);
assert.match(personalCard, /params: \{ cardId: card\.id, mode: 'view' \}/);
assert.match(editor, /setIsEditing\(initialMode === 'edit'\)/);
assert.match(editor, /onPress=\{\(\) => void finishEditing\(\)\}/);
assert.doesNotMatch(editor, /<AppText[^>]*>Edit Personal Place<\/AppText>/);
assert.match(editor, /<AutoExpandingTextInput[\s\S]{0,500}<FinishEditAction/);
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
assert.match(editor, /label=\{`Remove body photo \$\{index \+ 1\}`\}/);
assert.doesNotMatch(editor, />Trip readiness</);
assert.match(editor, /Ready to add to Trips\./);
console.log('✓ index and finished view use the canonical Saved interaction grammar');

assert.match(list, /useFocusEffect\(useCallback/);
assert.match(list, /void refresh\(\)\.catch/);
assert.match(provider, /personalPlaceCardStorage\.get\(userId\)/);
assert.match(provider, /refreshInFlightRef/);
assert.match(provider, /photoAuthorizationInFlightRef/);
assert.match(provider, /Date\.parse\(cached\.expiresAt\) > Date\.now\(\) \+ 30_000/);
assert.match(provider, /photoAuthorizationRef\.current\.clear\(\)/);
assert.match(personalCard, /authorizePhoto\(media\.photoAssetId\)/);
assert.doesNotMatch(personalCard, /authorizePhotoRead/);
console.log('✓ Personal Places render user-scoped cache first, refresh on focus and deduplicate photo authorization');

assert.equal((list.match(/<Stack\.Screen/g) ?? []).length, 1);
assert.match(list, /options=\{session \? headerAddAction/);
assert.match(list, /clearHeaderRightAction\(\)/);
assert.match(list, /onPress: \(\) => void createPlace\(\)/);
console.log('✓ Personal Places registers exactly one lifecycle-stable native Add action');
