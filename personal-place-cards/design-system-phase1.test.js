import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [editor, list, pickerRoute, pickerShell, finish, diaryFinish, remove, diaryRemove, photoGrid, input, foreground] = await Promise.all([
  read('app/personal-place-cards/[cardId].tsx'), read('app/personal-place-cards/index.tsx'),
  read('app/personal-place-cards/location-picker.tsx'), read('components/map/saved-location-picker.tsx'),
  read('components/ui/finish-edit-action.tsx'), read('components/diary/finish-edit-action.tsx'),
  read('components/ui/contained-remove-button.tsx'), read('components/diary/contained-remove-button.tsx'),
  read('components/place-photo-grid.tsx'), read('components/ui/app-text-input.tsx'), read('location/foreground.ts'),
]);

assert.match(editor, /<FinishEditAction accessibilityLabel="Finish editing Personal Place"/);
assert.doesNotMatch(editor, /check-circle|label="Done"|label="Save"/);
assert.match(finish, /Palette\.success/); assert.match(finish, /name="check"/);
assert.match(diaryFinish, /export \{ FinishEditAction \} from '@\/components\/ui\/finish-edit-action'/);
assert.match(editor, /icon="edit"[\s\S]{0,100}semantic="edit"/);
assert.match(list, /destructive[\s\S]{0,80}icon="delete-outline"/);
assert.match(list, /Alert\.alert\([\s\S]*Delete Personal Place/);

assert.match(editor, /<ContainedRemoveButton/); assert.match(editor, /<PlacePhotoGrid/);
assert.match(photoGrid, /ContainedRemoveButton/); assert.match(remove, />×<\/Text>/);
assert.match(diaryRemove, /export \{ ContainedRemoveButton \} from '@\/components\/ui\/contained-remove-button'/);
assert.equal((editor.match(/'main'/g) ?? []).length > 0, true);
assert.match(editor, /bodyMedia = card\.media\.filter/); assert.match(editor, /position/);

assert.match(input, /textVariant\?: keyof typeof Type/); assert.match(editor, /textVariant="title"/);
assert.match(editor, /<AutosaveStatus[\s\S]{0,220}queueMetadataSave/);
assert.match(editor, /await queueMetadataSave\(revisionRef\.current\)/);
assert.match(editor, /if \(revisionRef\.current === 0\) setIsEditing\(false\)/);

assert.match(editor, /getOneForegroundLocation/); assert.match(foreground, /requestForegroundPermissionsAsync/);
assert.match(editor, /locationConfirmed: true/); assert.doesNotMatch(editor, /accessibilityLabel="Latitude"|accessibilityLabel="Longitude"/);
assert.match(pickerRoute, /<SavedLocationPicker/); assert.match(pickerRoute, /await mutate\.update/);
assert.match(pickerShell, /const \[selected, setSelected\] = useState/);
assert.match(pickerShell, /onCancel=|onPress=\{onCancel\}/); assert.match(pickerShell, /await onSave\(selected\)/);
assert.match(pickerShell, /<UserLocation animated/);
assert.doesNotMatch(pickerShell, /userPosition[\s\S]{0,140}<MapPin emphasis="selected"/);

console.log('✓ Phase 1 shared controls and Personal Place reference contracts are preserved');
