import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DiaryApiParseError, diaryDetailView, parseDiaryDetail, parseDiaryList } from './api-model.ts';
import { createDiaryApiStorage, diaryApiCacheKey, replaceDiaryApiList } from './api-storage.ts';

const now = '2026-08-29T00:00:00.000Z';
const baseObject = (id, type, position, fields) => ({ id, type, position, clientRequestId: `request-${id}`, includeOnMap: false, createdAt: now, updatedAt: now, ...fields });
const location = (latitude, longitude, source = 'PLACE_SNAPSHOT') => ({ latitude, longitude, source, accuracyMeters: null });
const summary = { id: 'diary-1', title: 'South Island', description: null, startDate: '2026-08-01', endDate: '2026-08-03', version: 7, createdAt: now, updatedAt: now };
const detail = { ...summary, state: 'active', deletedAt: null,
  coverMedia: [{ id: 'cover-1', photoAssetId: 'asset-cover', position: 0, clientRequestId: 'request-cover', createdAt: now }],
  days: [{ id: 'day-2', date: '2026-08-02', heading: null, summary: null, createdAt: now, updatedAt: now, topics: [
    { id: 'topic-later-position', title: 'Manual first', startTime: '15:00', position: 0, createdAt: now, updatedAt: now, objects: [
      baseObject('pin', 'PIN', 5, { label: 'Lookout', includeOnMap: true, location: location(-44.69, 169.14, 'MAP_SELECTED') }),
      baseObject('narrative', 'NARRATIVE', 0, { title: 'Morning', text: 'A clear day.' }),
      baseObject('photo', 'PHOTO', 1, { photoAssetId: 'asset-photo', caption: null }),
      baseObject('link', 'LINK', 2, { url: 'https://example.com', title: 'Guide', note: 'Read later' }),
      baseObject('editorial', 'EDITORIAL_PLACE', 3, { availability: 'available', titleSnapshot: 'Editorial Place', reference: { kind: 'editorial', editorialPlaceId: 'place-1' }, locationSnapshot: location(-44.7, 169.1) }),
      baseObject('personal', 'PERSONAL_PLACE', 4, { availability: 'unavailable', titleSnapshot: 'Private Place', reference: { kind: 'personal', personalPlaceCardId: 'personal-1' }, locationSnapshot: null }),
    ] },
    { id: 'topic-earlier-time', title: 'Manual second', startTime: '08:00', position: 1, createdAt: now, updatedAt: now, objects: [] },
  ] }, { id: 'day-1', date: '2026-08-01', heading: 'Arrival', summary: null, createdAt: now, updatedAt: now, topics: [] }],
};

assert.deepEqual(parseDiaryList({ diaries: [summary] }), [summary]);
const parsed = parseDiaryDetail(detail);
assert.deepEqual(parsed.days.map(({ id }) => id), ['day-1', 'day-2']);
assert.deepEqual(parsed.days[1].topics.map(({ id }) => id), ['topic-later-position', 'topic-earlier-time']);
assert.deepEqual(parsed.days[1].topics[0].objects.map(({ type }) => type), ['NARRATIVE', 'PHOTO', 'LINK', 'EDITORIAL_PLACE', 'PERSONAL_PLACE', 'PIN']);
const view = diaryDetailView(parsed);
assert.equal(view.version, 7);
assert.deepEqual(view.coverPhotoAssetIds, ['asset-cover']);
assert.deepEqual(view.days[1].topics[0].items.map(({ type }) => type), ['NARRATIVE', 'PHOTO', 'LINK', 'EDITORIAL_PLACE', 'PERSONAL_PLACE', 'LOCATION']);
assert.equal(view.days[1].topics[0].items[4].presentationBody, null);
const withObjects = (objects) => ({ ...detail, days: [{ ...detail.days[0], topics: [{ ...detail.days[0].topics[0], objects }] }] });
assert.throws(() => parseDiaryDetail(withObjects([detail.days[0].topics[0].objects[0], { ...detail.days[0].topics[0].objects[1], position: 5 }])), DiaryApiParseError);
assert.throws(() => parseDiaryDetail(withObjects([baseObject('bad', 'PERSONAL_PLACE', 0, { availability: 'unavailable', titleSnapshot: 'Hidden', reference: { kind: 'personal', personalPlaceCardId: 'personal-1' }, locationSnapshot: location(-1, 2) })])), DiaryApiParseError);
assert.throws(() => parseDiaryList({ diaries: [{ ...summary, version: '7' }] }), DiaryApiParseError);

const stored = new Map();
const cacheStorage = createDiaryApiStorage({
  getItem: async (key) => stored.get(key) ?? null,
  setItem: async (key, value) => { stored.set(key, value); },
  removeItem: async (key) => { stored.delete(key); },
});
await cacheStorage.set('user-a', { format: 'diary-api-read-v1', summaries: [summary], details: [parsed] });
assert.equal((await cacheStorage.get('user-a')).details[0].version, 7);
assert.deepEqual(await cacheStorage.get('user-b'), { format: 'diary-api-read-v1', summaries: [], details: [] });
const refreshedSummary = { ...summary, title: 'Server replacement', version: 8 };
assert.deepEqual(replaceDiaryApiList({ format: 'diary-api-read-v1', summaries: [summary], details: [parsed] }, [refreshedSummary]), { format: 'diary-api-read-v1', summaries: [refreshedSummary], details: [] });
assert.notEqual(diaryApiCacheKey('user-a'), diaryApiCacheKey('user-b'));
stored.set(diaryApiCacheKey('user-b'), '{malformed');
assert.deepEqual(await cacheStorage.get('user-b'), { format: 'diary-api-read-v1', summaries: [], details: [] });

const [api, apiStorage, provider, index, cover, contents, day, map, prototypeStorage] = await Promise.all([
  readFile(new URL('./api.ts', import.meta.url), 'utf8'), readFile(new URL('./api-storage.ts', import.meta.url), 'utf8'),
  readFile(new URL('./provider.tsx', import.meta.url), 'utf8'), readFile(new URL('../app/diaries/index.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/[diaryId].tsx', import.meta.url), 'utf8'), readFile(new URL('../app/diaries/[diaryId]/contents.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/diaries/[diaryId]/day.tsx', import.meta.url), 'utf8'), readFile(new URL('../app/diaries/[diaryId]/map.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./storage.ts', import.meta.url), 'utf8'),
]);
assert.match(api, /authenticatedApiFetch\('\/diaries'\)/);
assert.match(api, /authenticatedApiFetch\(`\/diaries\/\$\{encodeURIComponent\(id\)\}`\)/);
assert.doesNotMatch(api, /method:\s*['"](?:POST|PATCH|PUT|DELETE)/);
assert.match(provider, /checkApiCapability\('diaries-v1'\)/);
assert.match(provider, /canEdit: false/);
assert.doesNotMatch(provider, /from '@\/diaries\/storage'/);
assert.match(apiStorage, /tripideas\.diaries\.api\.user\.\$\{userId\}\.v1/);
assert.match(prototypeStorage, /tripideas\.diaries\.user\.\$\{userId\}\.\$\{VERSION\}/);
assert.match(prototypeStorage, /const VERSION = 'prototype-v1'/);
assert.doesNotMatch(apiStorage, /tripideas\.diaries\.user\./);
for (const surface of [cover, contents, day, map]) { assert.match(surface, /isDetailLoaded/); assert.match(surface, /loadDiary/); }
assert.doesNotMatch(index, /createDiary|deleteDiary|FloatingStructuralAdd/);
assert.match(cover, /\{canEdit \? <IconAction accessibilityLabel="Edit Diary Cover"/);
assert.match(day, /canEdit \? <FloatingStructuralAdd/);
assert.match(day, /if \(!canEdit\) \{ router\.replace/);
assert.match(cover, /instantiated\[0\]\?\.date \?\? \(canEdit \? diary\.startDate : null\)/);
console.log('✓ Diary API list/detail parsing, ordering, cache isolation, lazy reads and Stage 1 edit gating');
