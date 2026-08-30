import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDiaryPhotoAttachmentStorage } from './photo-attachment-storage.ts';

const [day, cover, photos, grid, assets, storage] = await Promise.all([
  readFile(new URL('../app/diaries/[diaryId]/day.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/[diaryId].tsx', import.meta.url), 'utf8'),
  readFile(new URL('./photos.ts', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/photo-grid.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/photo-assets.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./storage.ts', import.meta.url), 'utf8'),
]);

assert.match(day, /pickPhotosForUpload\(\)/);
assert.match(day, /addDiaryPhotos/);
assert.match(day, /type: 'PHOTO'/);
assert.match(day, /mutationClientRequestId: pending\.clientRequestId/);
assert.match(day, /SavedPlaceSelector cards=\{cards\}/);
assert.match(day, /personalPlaceCardId: card\.id/);
assert.match(day, /editorialPlaceId: place\._id/);
assert.match(photos, /for \(const photo of selected\)/);
assert.match(photos, /prepareNativePhotoUpload/);
assert.match(photos, /startNativePhotoUpload/);
assert.match(photos, /uploaded\.state !== 'UPLOADED'/);
assert.match(photos, /diary-photo:\$\{upload\.clientRequestId\}/);
assert.match(photos, /diaryPhotoAttachmentStorage\.remove/);
assert.doesNotMatch(photos, /copy|writeFile|localFileUri/);
assert.match(day, /while \(ordered\[index\]\?\.type === 'PHOTO'\)/);
assert.match(day, /photos\.map\(\(\{ photoAssetId \}\) => photoAssetId\)/);
assert.doesNotMatch(day, /filter\(\(item\) => item\.type !== 'PHOTO'\)/);
assert.match(day, /onRemoveAsset/);
assert.doesNotMatch(day, /function TopicPhotoManagement/);
assert.match(day, /<DragReorderRow[\s\S]*<DiaryPhotoGrid/);
assert.doesNotMatch(day, /collapsed=\{item\.type === 'PHOTO' \? <DiaryPhotoGrid/);
assert.doesNotMatch(day, /<DiaryObjectEditorShell[^>]*label=\{"PHOTO"\}/);
assert.match(grid, /PlacePhotoGrid/);
assert.match(grid, /bottomMargin=\{bottomMargin\}/);
assert.match(grid, /onRemoveImage/);
assert.match(assets, /authorizedUrlCache/);
assert.match(assets, /authorizationInFlight/);
assert.match(assets, /Promise\.all\(assetIds\.map/);
assert.match(cover, /diaryCoverAssetIds/);
assert.match(cover, /pickPhotosForUpload\(availableSlots\)/);
assert.match(cover, /addDiaryPhotos/);
assert.match(cover, /attachCoverPhoto/);
assert.match(cover, /No cover photos/);
assert.match(cover, /disabled=\{!canEditMedia \|\| coverBusy\}/);
assert.match(cover, /const opensInEditMode = editCover === '1'/);
assert.match(cover, /useState<boolean>\(opensInEditMode && canEdit\)/);
assert.match(cover, /autoFocus=\{!opensInEditMode\}/);
assert.doesNotMatch(cover, /setEditing\(true\);[\s\S]{0,80}\}, \[diary, editCover\]\)/);
assert.match(cover, /<DiaryPhotoGrid[\s\S]*onRemoveAsset/);
assert.match(cover, /<TripImageCollage/);
assert.equal(cover.match(/<DiaryPhotoGrid/g)?.length, 1);
assert.match(cover, /selectedCoverIds\.length < 4 \? 'Add Diary cover photos' : 'Replace Diary cover photos'/);
assert.doesNotMatch(cover, /label=\{coverBusy \? 'Uploading…'|Clear cover photos|Choose cover photos|Replace cover photos/);
assert.match(storage, /coverPhotoAssetIds:/);
assert.match(storage, /diaryStorageKey\(userId\)/);

const values = new Map();
const pendingStorage = createDiaryPhotoAttachmentStorage({ getItem: async (storageKey) => values.get(storageKey) ?? null, setItem: async (storageKey, value) => { values.set(storageKey, value); } });
const pending = { userId: 'owner-a', uploadId: 'upload-1', clientRequestId: 'diary-photo:stable', target: { kind: 'object', diaryId: 'diary-1', dayId: 'day-1', topicId: 'topic-1' }, createdAt: '2026-08-30T00:00:00.000Z' };
await pendingStorage.set(pending);
assert.deepEqual(await pendingStorage.list('owner-a'), [pending]);
assert.deepEqual(await pendingStorage.list('owner-b'), []);
await pendingStorage.remove('owner-a', 'upload-1');
assert.deepEqual(await pendingStorage.list('owner-a'), []);
console.log('✓ Diary photos use ordered PhotoAsset references, Notebook grid UI, user-scoped restart storage and real cover collage selection');
