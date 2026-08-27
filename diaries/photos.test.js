import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [day, cover, photos, grid, assets, storage] = await Promise.all([
  readFile(new URL('../app/diaries/[diaryId]/day.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/[diaryId].tsx', import.meta.url), 'utf8'),
  readFile(new URL('./photos.ts', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/photo-grid.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/photo-assets.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./storage.ts', import.meta.url), 'utf8'),
]);

assert.match(day, /pickPhotosForUpload\(\)/);
assert.match(day, /uploadDiaryPhotos\(session\.userId, selected\)/);
assert.match(day, /for \(const photoAssetId of result\.assetIds\)/);
assert.match(day, /type: 'PHOTO', photoAssetId/);
assert.match(photos, /for \(const photo of selected\)/);
assert.match(photos, /prepareNativePhotoUpload/);
assert.match(photos, /startNativePhotoUpload/);
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
assert.match(cover, /pickPhotosForUpload\(availableSlots \|\| 4\)/);
assert.match(cover, /uploadDiaryPhotos\(session\.userId, selected\)/);
assert.match(cover, /result\.assetIds\.slice\(0, 4\)/);
assert.match(cover, /Tap to add up to 4 collage images/);
assert.match(cover, /accessibilityLabel=\{coverBusy \? 'Uploading Diary cover photos' : coverImages\.length \? 'Edit Diary cover photos' : 'Add Diary cover photos'\}/);
assert.match(cover, /const opensInEditMode = editCover === '1'/);
assert.match(cover, /useState\(opensInEditMode\)/);
assert.match(cover, /autoFocus=\{!opensInEditMode\}/);
assert.doesNotMatch(cover, /setEditing\(true\);[\s\S]{0,80}\}, \[diary, editCover\]\)/);
assert.match(cover, /<DiaryPhotoGrid[\s\S]*onRemoveAsset/);
assert.match(cover, /<TripImageCollage/);
assert.equal(cover.match(/<DiaryPhotoGrid/g)?.length, 1);
assert.match(cover, /selectedCoverIds\.length < 4 \? 'Add Diary cover photos' : 'Replace Diary cover photos'/);
assert.doesNotMatch(cover, /label=\{coverBusy \? 'Uploading…'|Clear cover photos|Choose cover photos|Replace cover photos/);
assert.match(storage, /coverPhotoAssetIds:/);
assert.match(storage, /diaryStorageKey\(userId\)/);
assert.match(day, /if \(!session\?\.userId/);
console.log('✓ Diary photos use ordered PhotoAsset references, Notebook grid UI, user-scoped restart storage and real cover collage selection');
