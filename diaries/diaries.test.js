import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyDiaryReorder, appendDiaryMaterial, deriveDiaryOrigin, diaryMapFeatures, diaryMapItems, proposedDiaryCandidateOrder } from './model.ts';
import { createDiaryStorage, diaryStorageKey } from './storage.ts';
import { createDiaryLastViewedStorage, diaryLastViewedKey } from './last-viewed.ts';
import { editorialPlaceCandidate, notebookBlockCandidate } from './sources.ts';
import { adjacentDiaryDate, diaryDateRange, formatDiaryDate, formatDiaryDateInput, instantiatedDiaryIndex, outsideDiaryRange, parseDiaryDate, validateDiaryDateRange } from './dates.ts';
import { formatDiaryTopicTime, parseDiaryTopicTime } from './times.ts';

const candidate = (sourceId, overrides = {}) => ({ sourceKind: 'NOTEBOOK_BLOCK', sourceId,
  displayTitle: sourceId, eventAt: null, capturedAt: null, sourceOrder: null, tripOrder: null,
  createdAt: '2026-08-15T00:00:00.000Z', locationEvidence: null, contentOrigin: 'USER_OWNED', presentation: {}, ...overrides });
assert.deepEqual(proposedDiaryCandidateOrder([
  candidate('fallback'), candidate('trip', { tripOrder: 1 }), candidate('source', { sourceOrder: 1 }),
  candidate('capture', { capturedAt: '2026-08-14T00:00:00.000Z' }), candidate('event', { eventAt: '2026-08-13T00:00:00.000Z' }),
]).map(({ sourceId }) => sourceId), ['event', 'capture', 'source', 'trip', 'fallback']);
assert.deepEqual(applyDiaryReorder([{ id: 'a', position: 0 }, { id: 'b', position: 1 }], ['b', 'a']).map(({ id, position }) => ({ id, position })), [{ id: 'b', position: 0 }, { id: 'a', position: 1 }]);
const timeEditedTopics = applyDiaryReorder([{ id: 'early-time', position: 0, startTime: null }, { id: 'late-time', position: 1, startTime: null }], ['late-time', 'early-time'])
  .map((topic) => topic.id === 'early-time' ? { ...topic, startTime: '09:15' } : { ...topic, startTime: '11:00' });
assert.deepEqual(timeEditedTopics.map(({ id, position }) => ({ id, position })), [{ id: 'late-time', position: 0 }, { id: 'early-time', position: 1 }]);
assert.throws(() => applyDiaryReorder([{ id: 'a' }], ['wrong']));
assert.deepEqual(appendDiaryMaterial([{ id: 'a', position: 0 }], [{ id: 'b' }]).map(({ id }) => id), ['a', 'b']);
assert.equal(deriveDiaryOrigin([{ contentOrigin: 'USER_OWNED' }, { contentOrigin: 'TRIPIDEAS_SUPPLIED' }]), 'MIXED');
const base = { position: 0, creationMethod: 'USER', contentOrigin: 'USER_OWNED', manuallyEditedAt: null, sources: [] };
assert.deepEqual(diaryMapItems([
  { ...base, id: 'text', type: 'NARRATIVE', text: 'coordinates in source', includeOnMap: true },
  { ...base, id: 'hidden', type: 'LOCATION', label: null, location: { latitude: 1, longitude: 2 }, includeOnMap: false },
  { ...base, id: 'shown', type: 'LOCATION', label: 'Shown', location: { latitude: 3, longitude: 4 }, includeOnMap: true },
]).map(({ itemId }) => itemId), ['shown']);
console.log('✓ Diary ordering, origin, insertion and map projection are deterministic');
const mapDiary = { id: 'diary-map', days: [{ id: 'day-map', topics: [{ id: 'topic-map', items: [
  { ...base, id: 'pin', type: 'LOCATION', label: 'Harbour', location: { latitude: -36.84, longitude: 174.76 }, includeOnMap: true },
  { ...base, id: 'place', type: 'PERSONAL_PLACE', personalPlaceCardId: 'place-1', presentationTitle: 'Cafe', presentationBody: null, location: { latitude: -36.85, longitude: 174.77 }, includeOnMap: true },
  { ...base, id: 'prose', type: 'NARRATIVE', text: 'Mentions a location', includeOnMap: true },
] }] }] };
assert.deepEqual(diaryMapFeatures(mapDiary).map(({ diaryId, dayId, topicId, itemId }) => ({ diaryId, dayId, topicId, itemId })), [
  { diaryId: 'diary-map', dayId: 'day-map', topicId: 'topic-map', itemId: 'pin' },
  { diaryId: 'diary-map', dayId: 'day-map', topicId: 'topic-map', itemId: 'place' },
]);
mapDiary.days[0].topics[0].items = mapDiary.days[0].topics[0].items.filter(({ id }) => id !== 'pin');
assert.deepEqual(diaryMapFeatures(mapDiary).map(({ itemId }) => itemId), ['place']);
mapDiary.days = [];
assert.deepEqual(diaryMapFeatures(mapDiary), []);
console.log('✓ Diary map projection retains ownership identities and follows current selected content');
const candidateBase = { sourceId: 'source', displayTitle: 'Source', eventAt: null,
  capturedAt: null, sourceOrder: null, tripOrder: null, createdAt: '2026-08-15T00:00:00.000Z', locationEvidence: null };
assert.equal(notebookBlockCandidate(candidateBase).contentOrigin, 'USER_OWNED');
assert.equal(editorialPlaceCandidate(candidateBase).contentOrigin, 'TRIPIDEAS_SUPPLIED');
console.log('✓ source adapters normalize origin without depending on raw provider DTOs');
for (const value of ['1/1/27', '01/01/27', '1/01/2027', '01/01/2027']) assert.equal(parseDiaryDate(value), '2027-01-01');
assert.equal(parseDiaryDate('31/2/27'), null); assert.equal(parseDiaryDate('12/31/27'), null);
assert.equal(formatDiaryDate('2027-01-01'), '1 Jan 27'); assert.equal(formatDiaryDateInput('2027-01-01'), '1/1/2027');
assert.equal(validateDiaryDateRange('2027-01-10', '2027-01-01'), 'End date must not be before start date.');
assert.deepEqual(diaryDateRange('2027-01-01', '2027-01-03'), ['2027-01-01', '2027-01-02', '2027-01-03']);
assert.equal(adjacentDiaryDate(['2027-01-01', '2027-01-02'], '2027-01-01', 1), '2027-01-02');
assert.equal(outsideDiaryRange('2027-01-03', '2027-01-01', '2027-01-02'), true);
assert.equal(diaryDateRange('2027-01-01', '2027-12-31').length, 365);
assert.deepEqual(instantiatedDiaryIndex([{ date: '2027-01-17' }, { date: '2027-01-01' }]).map(({ date }) => date), ['2027-01-01', '2027-01-17']);
console.log('✓ New Zealand dates normalize, format and form sparse bounded page ranges');
for (const [input, expected] of [['9', '09:00'], ['9 am', '09:00'], ['9am', '09:00'], ['9:15', '09:15'], ['9.15 am', '09:15'], ['0915', '09:15'], ['9:15 am', '09:15'], ['9:15am', '09:15'], ['2:30 pm', '14:30'], ['14:30', '14:30'], ['12:00 am', '00:00'], ['12:00 pm', '12:00']]) assert.equal(parseDiaryTopicTime(input), expected);
for (const input of ['25:00', '9:75', '13:30 pm', '0:30 am', '14:30 pm', 'noon']) assert.equal(parseDiaryTopicTime(input), null);
assert.equal(formatDiaryTopicTime('09:15'), '9:15 am'); assert.equal(formatDiaryTopicTime('14:30'), '2:30 pm');
console.log('✓ Topic time accepts forgiving input and normalizes without fabricating a date or timezone');

const values = new Map();
const storage = createDiaryStorage({ getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => { values.set(key, value); }, removeItem: async (key) => { values.delete(key); } });
await storage.set('user-a', [{ id: 'diary-a', title: 'A' }]);
assert.equal((await storage.get('user-a'))[0].id, 'diary-a');
assert.deepEqual(await storage.get('user-b'), []);
assert.notEqual(diaryStorageKey('user-a'), diaryStorageKey('user-b'));
const manuallyOrdered = applyDiaryReorder([{ id: 'early', position: 0 }, { id: 'late', position: 1 }], ['late', 'early']);
await storage.set('user-a', [{ id: 'diary-order', days: [{ topics: manuallyOrdered }] }]);
assert.deepEqual((await storage.get('user-a'))[0].days[0].topics.map(({ id }) => id), ['late', 'early']);
await storage.set('user-a', [{ id: 'legacy-diary', days: [{ topics: [{ items: [{ id: 'legacy-narrative', type: 'NARRATIVE', text: 'Existing text' }] }] }] }]);
assert.equal((await storage.get('user-a'))[0].days[0].topics[0].items[0].title, null);
assert.equal((await storage.get('user-a'))[0].days[0].topics[0].startTime, null);
console.log('✓ local prototype storage round-trips without cross-user visibility');

const lastViewedValues = new Map();
const lastViewed = createDiaryLastViewedStorage({
  getItem: async (key) => lastViewedValues.get(key) ?? null,
  setItem: async (key, value) => { lastViewedValues.set(key, value); },
});
await lastViewed.set('user-a', 'diary-a', '2027-01-02');
assert.equal(await lastViewed.get('user-a', 'diary-a'), '2027-01-02');
assert.equal(await lastViewed.get('user-a', 'diary-b'), null);
assert.notEqual(diaryLastViewedKey('user-a', 'diary-a'), diaryLastViewedKey('user-b', 'diary-a'));
console.log('✓ last-viewed Diary Day is scoped to the signed-in user and Diary');

const [saved, layout, library, cover, diaryIndex, day, provider, toolbar, dragRow, shell, autosaveField, picker, diaryMap, viewMenu, removeButton, plainAction, iconAction, finishAction] = await Promise.all([
  readFile(new URL('../app/(tabs)/saved.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/index.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/[diaryId].tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/[diaryId]/contents.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/[diaryId]/day.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./provider.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/object-toolbar.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/drag-reorder-row.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/object-editor-shell.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/autosave-field.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/location-picker.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/[diaryId]/map.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/view-menu.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/contained-remove-button.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/ui/plain-icon-action.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/ui/icon-action.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/diary/finish-edit-action.tsx', import.meta.url), 'utf8'),
]);
assert.match(saved, /title: 'Diaries'/); assert.match(saved, /openPrivateFeature\('\/diaries'\)/);
assert.match(layout, /<DiaryProvider>/); assert.match(library, /if \(!title\.trim\(\)\)/);
assert.match(library, /Sign in to create and edit private travel Diaries/);
assert.doesNotMatch(library, /pathname: '\/diaries\/\[diaryId\]\/day'/); assert.match(library, /pathname: '\/diaries\/\[diaryId\]'/);
assert.doesNotMatch(layout, /<ApiCompatibilityNotice/); assert.match(cover, /Diary Cover/); assert.match(cover, /outsideDays\.length/);
assert.match(cover, /TripImageCollage/); assert.match(cover, /Edit Diary Cover/); assert.match(cover, /Use automatic collage/); assert.doesNotMatch(cover, /instantiatedDiaryIndex/);
assert.match(cover, /function CoverModeTile/); assert.match(cover, /label="Diary"/); assert.match(cover, /label="Map"/); assert.match(cover, /flex: 1/); assert.match(cover, /minHeight: 132/);
assert.match(cover, /getLastViewedDiaryDay/); assert.match(cover, /instantiated\.some/); assert.match(cover, /instantiated\[0\]\?\.date/); assert.match(cover, /diary\.startDate/);
assert.doesNotMatch(cover, /DiaryViewMenu|accessibilityLabel="Open Diary Index"/); assert.match(cover, /headerRight: \(\) => null/);
assert.match(cover, /accessibilityLabel="Diary title"[^>]*inputStyle=\{Type\.title\}/); assert.match(cover, /accessibilityLabel="Delete Diary" destructive icon="delete-outline"/); assert.doesNotMatch(cover, /accessibilityLabel="Delete Diary"[^>]*size="compact"/);
assert.match(diaryIndex, /instantiatedDiaryIndex\(diary\.days\)/); assert.doesNotMatch(diaryIndex, /DiaryAutosaveField|Diary introduction/);
assert.match(diaryIndex, /Only instantiated Diary Days appear here/);
for (const label of ['Cover', 'Index', 'Map']) assert.match(viewMenu, new RegExp(`text: '${label}'`));
assert.match(provider, /async ensureDay/); assert.match(provider, /if \(existing\) return existing/); assert.match(provider, /outsideDiaryRange/);
assert.match(day, /Previous day/); assert.match(day, /Next day/); assert.match(dragRow, /onStartShouldSetPanResponder/);
assert.match(day, /setLastViewedDiaryDay/); assert.match(day, /<PlainIconAction[\s\S]*accessibilityLabel="Previous day"/); assert.match(day, /<PlainIconAction[\s\S]*accessibilityLabel="Next day"/);
assert.match(day, /accessibilityLabel="Day navigation"[\s\S]{0,180}gap: 0/); assert.match(plainAction, /height: 44/); assert.match(plainAction, /width: 36/); assert.match(plainAction, /left: 4, right: 4/); assert.doesNotMatch(plainAction, /borderRadius|borderWidth/);
assert.match(day, /This Day is empty/); assert.match(day, /activeTopicId/); assert.match(day, /useState<string \| null>\(null\)/);
assert.match(day, /actionsRef\.current\.ensureDay/); assert.match(day, /\[date, diary\?\.id\]/);
assert.match(day, /actions\.addTopic[\s\S]*setActiveTopicId\(topic\.id\)/);
assert.match(day, /accessibilityLabel="Add Topic"/); assert.match(day, /setActiveTopicId\(null\)/);
assert.match(day, /function CompletedTopic/); assert.match(day, /function CompletedItem/);
assert.match(day, /function CompletedTopic[\s\S]{0,500}backgroundColor: Palette\.surfaceMuted/); assert.match(day, /function CompletedTopic[\s\S]{0,500}borderRadius: Radius\.card/);
assert.match(day, /topic\.startTime \? <AppText color=\{Palette\.textMuted\} variant="caption">\{formatDiaryTopicTime\(topic\.startTime\)\}/);
assert.match(day, /accessibilityLabel=\{`Edit \$\{topic\.title \|\| 'Topic'\}`\}/);
assert.match(day, /icon="delete-outline"/); assert.match(day, /DiaryObjectEditorShell/); assert.match(shell, /ContainedRemoveButton/); assert.match(shell, /label=\{`Remove/);
assert.match(removeButton, /borderRadius: Radius\.pill/); assert.match(removeButton, />×<\/Text>/);
for (const label of ['NARRATIVE', 'PHOTO', 'LINK', 'PLACE', 'PIN']) assert.match(day, new RegExp(`'${label}'`));
assert.doesNotMatch(provider, /activeTopicId|editingTopic|completedTopic/);
for (const label of ['Narrative', 'Photo', 'Link', 'Place', 'Pin']) assert.match(toolbar, new RegExp(label));
assert.match(day, /Paste a URL or search term/); assert.match(day, /Paste a link or search the web/); assert.match(day, /label="Use link"/); assert.doesNotMatch(day, /label="Add link"|supported search provider/); assert.match(day, /label="Open web"/); assert.match(day, /\^https\?:/);
const completedLink = day.slice(day.indexOf("if (item.type === 'LINK')"), day.indexOf("if (item.type === 'LOCATION')"));
assert.match(completedLink, /accessibilityRole="link"/); assert.match(completedLink, /color=\{Palette\.trip\}/); assert.match(completedLink, /textDecorationLine: 'underline'/); assert.doesNotMatch(completedLink, /Palette\.textMuted|variant="caption"/);
const linkEditor = day.slice(day.indexOf("{item.type === 'LINK' ?"), day.indexOf("{item.type === 'LOCATION' ?"));
assert.match(linkEditor, /accessibilityRole="link"/); assert.match(linkEditor, /textDecorationLine: 'underline'/); assert.match(linkEditor, /color=\{Palette\.textMuted\} variant="caption">\{domain\(item\.url\)\}/); assert.match(linkEditor, /accessibilityLabel="Link URL"/);
assert.match(day, /<Modal animationType="slide"/); assert.match(day, /visible=\{Boolean\(capture\)\}/);
assert.match(day, /const url = linkQuery\.trim\(\)/); assert.doesNotMatch(day, /url: linkQuery/);
assert.match(day, /Choose a Place/); assert.match(day, /PERSONAL PLACES/); assert.match(day, /TRIPIDEAS PLACES/); assert.match(day, /SEARCH_QUERY/);
assert.match(day, /getOneForegroundLocation/); assert.match(day, /Locate now/); assert.match(day, /Locate on map/); assert.doesNotMatch(day, /Update location|Change on map|Find on map|Save this location\?|Save Pin/);
assert.match(day, /result\.status !== 'granted'/); assert.match(day, /label="Cancel"/);
assert.match(picker, /onPress=\{\(event\)/); assert.match(picker, /label="Cancel"/); assert.match(picker, /label=\{saving \? 'Saving…' : 'Save'\}/);
assert.match(day, /Open Day Map/); assert.match(diaryMap, /diaryMapFeatures\(diary\)/);
assert.match(diaryMap, /focusFeatures/); assert.match(diaryMap, /feature\.dayId === dayId/); assert.match(diaryMap, /allFeatures\.map/);
assert.match(diaryMap, /MapLibreMap/); assert.doesNotMatch(diaryMap, /getOneForegroundLocation/);
assert.match(picker, /MapLibreMap/); assert.match(day, /getOneForegroundLocation/);
assert.doesNotMatch(dragRow, /MaterialIcons|drag-handle/); assert.match(dragRow, /\[0, 1, 2\]\.map/); assert.match(dragRow, /height: 2, width: 20/); assert.match(dragRow, /height: 44/); assert.match(dragRow, /accessibilityActions/); assert.match(dragRow, /onStartShouldSetPanResponder/);
assert.ok(dragRow.indexOf('{header}') < dragRow.indexOf('<Pressable accessibilityActions'), 'grip must share the internal object header');
assert.match(shell, /header=\{<AppText/); assert.doesNotMatch(day, /icon="arrow-upward"|icon="arrow-downward"|moveTopic\(/);
assert.doesNotMatch(day, /<DragReorderRow/); assert.doesNotMatch(day, /Update Day/);
for (const field of ['Diary title', 'Diary introduction']) assert.match(cover, new RegExp(field));
for (const field of ['Day heading', 'Day summary', 'Topic title', 'Link title', 'Link note']) assert.match(day, new RegExp(field));
assert.match(day, /type: 'NARRATIVE', title: null, text: ''/); assert.doesNotMatch(day, /Add Narrative|Add narrative/);
assert.match(day, /accessibilityLabel="Narrative title"/); assert.match(day, /maxLength=\{10_000\}/); assert.match(day, /item\.title \? <AppText variant="bodyStrong"/);
assert.match(day, /actions\.addTopic\(diary\.id, target\.id, ''\)/); assert.match(day, /placeholder="Topic name"/); assert.doesNotMatch(day, /'New Topic'/);
assert.match(day, /expandedItemId/); assert.match(day, /expanded=\{!isPlace && expandedItemId === item\.id\}/); assert.match(day, /setExpandedItemId\(item\.id\)/); assert.match(day, /setExpandedItemId\(null\)/);
assert.match(day, /function CollapsedItem/); assert.match(shell, /onExpand/); assert.match(shell, /onCollapse/); assert.match(shell, /Finish editing/); assert.doesNotMatch(shell, /Save|Update|Add|Done/);
assert.match(shell, /FinishEditAction/); assert.match(shell, /ContainedRemoveButton/); assert.match(finishAction, /Palette\.success/); assert.match(finishAction, /name="check"/); assert.match(finishAction, /size === 'compact' \? 36 : 44/);
assert.match(day, /accessibilityLabel="Day navigation"/); const dayHeader = day.slice(day.indexOf('accessibilityLabel="Day navigation"'), day.indexOf('accessibilityLabel="Day navigation"') + 700); assert.doesNotMatch(dayHeader, /Add Topic/);
assert.equal(day.match(/accessibilityLabel="Add Topic"/g)?.length, 1); assert.match(day, /accessibilityLabel="Add Topic" accessibilityRole="button" onPress=\{createTopic\}/); assert.match(day, /backgroundColor: Palette\.trip/); assert.match(day, /position: 'absolute'/); assert.match(day, /bottom: Math\.max\(insets\.bottom, Screen\.bottom\)/);
assert.match(day, /accessibilityLabel="Edit Day heading and summary"[^>]*trip/); assert.match(day, /Alert\.alert\('Delete Day'/); assert.doesNotMatch(day, /Alert\.alert\('Delete Day'[\s\S]{0,300}size="compact"/);
const dayEditor = day.slice(day.indexOf('{editingDay ?'), day.indexOf(': <View style={{ gap: Space.sm }}>', day.indexOf('{editingDay ?'))); assert.match(dayEditor, /accessibilityLabel="Day heading" inputStyle=\{Type\.title\}/); assert.match(dayEditor, /FinishEditAction accessibilityLabel="Finish editing Day"/); assert.doesNotMatch(dayEditor, /<AppButton label="Done"/);
assert.match(day, /accessibilityLabel=\{`Edit \$\{topic\.title \|\| 'Topic'\}`\}[\s\S]*size="compact"[\s\S]*trip/);
assert.match(day, /accessibilityLabel=\{`Topic title[\s\S]{0,220}inputStyle=\{Type\.section\}/);
assert.match(day, /accessibilityLabel="Topic start time"/); assert.match(day, /placeholder="Start time"/); assert.match(day, /parseDiaryTopicTime\(value\)/); assert.match(day, /startTime: normalized/);
assert.match(provider, /startTime: null/); assert.match(provider, /input: \{ title\?: string; startTime\?: string \| null \}/); assert.doesNotMatch(provider, /sort\([^\n]*startTime|startTime[^\n]*sort\(/);
assert.match(iconAction, /trip \? Palette\.trip/); assert.match(iconAction, /size === 'compact' \? 36 : 44/);
assert.doesNotMatch(day, /variant="caption">Title<\/AppText><DiaryAutosaveField accessibilityLabel="Narrative title"/);
assert.match(day, /DiaryAutosaveField accessibilityLabel="Diary narrative"/); assert.match(autosaveField, /setTimeout/); assert.match(autosaveField, /700/); assert.match(autosaveField, /AutosaveStatus/); assert.match(autosaveField, /draftRef\.current !== saved\.current/);
assert.match(autosaveField, /onContentSizeChange/); assert.match(autosaveField, /Math\.min\(180, Math\.max\(48/); assert.match(autosaveField, /Math\.abs\(current - nextHeight\) >= 2/); assert.match(autosaveField, /scrollEnabled=\{multiline\}/);
assert.match(dragRow, /paddingVertical: Space\.xs/); assert.match(dragRow, /minHeight: 28/); assert.match(dragRow, /position: 'absolute'/); assert.match(dragRow, /height: 44/); assert.match(dragRow, /width: 44/); assert.match(shell, /expanded \? <View style=\{\{ gap: Space\.xs \}\}/);
assert.doesNotMatch(cover, /<AppButton label="Done"/); assert.match(cover, /FinishEditAction accessibilityLabel="Finish editing Diary Cover" size="default"/); assert.match(cover, /DiaryAutosaveField accessibilityLabel="Diary title"/); assert.match(cover, /DiaryAutosaveField accessibilityLabel="Diary introduction"/);
assert.match(day, /const isPlace = item\.type === 'PERSONAL_PLACE' \|\| item\.type === 'EDITORIAL_PLACE'/); assert.match(day, /editable=\{!isPlace\}/); assert.match(day, /expanded=\{!isPlace && expandedItemId === item\.id\}/); assert.match(shell, /!editable \? <View/); assert.doesNotMatch(shell.slice(shell.indexOf('!editable ?'), shell.indexOf(': expanded ?')), /onExpand|FinishEditAction|Pressable/);
assert.match(autosaveField, /typeof normalized === 'string'/); assert.match(autosaveField, /setDraft\(next\)/);
assert.match(day, /pendingRevealTopicId\.current = topic\.id/); assert.match(day, /onLayout=\{\(event\) => revealNewTopic\(topic\.id, event\.nativeEvent\.layout\.y\)\}/); assert.match(day, /Keyboard\.metrics\(\)\?\.height/); assert.match(day, /visibleHeight \* 0\.42/); assert.match(day, /scrollRef\.current\?\.scrollTo/); assert.match(day, /paddingBottom: 112/);
assert.match(diaryMap, /MapZoomControls/); assert.match(diaryMap, /onRegionDidChange/); assert.match(diaryMap, /selectedFeature/); assert.match(diaryMap, /formatDiaryDate\(selectedDay\.date\)/); assert.match(diaryMap, /pathname: '\/diaries\/\[diaryId\]\/day'/);
assert.match(picker, /MapZoomControls/); assert.match(picker, /onRegionDidChange/); assert.doesNotMatch(picker, /getOneForegroundLocation/);
console.log('✓ Cover, sparse Index, full\/Day Map, compact Topic editing and Saved gating are wired');
