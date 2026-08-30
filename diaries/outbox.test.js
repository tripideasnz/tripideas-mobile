import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { appendDiaryIntent, blockDiaryIntent, createDiaryOutboxStorage, diaryOutboxKey, equivalentDiaryIntent, nextDiaryIntents, resolveDiaryIntent } from './outbox.ts';

const intent = (id, diaryId, payload = { title: id }) => ({ id, diaryId, kind: 'update_diary', clientRequestId: `request-${id}`, expectedVersion: null, attempted: false, conflictRetries: 0, status: 'queued', errorCode: null, payload, createdAt: '2026-08-29T00:00:00.000Z' });
let queue = { format: 'diary-mutation-outbox-v1', items: [] };
queue = appendDiaryIntent(queue, intent('a1', 'diary-a'));
queue = appendDiaryIntent(queue, intent('a2', 'diary-a'));
queue = appendDiaryIntent(queue, intent('b1', 'diary-b'));
assert.deepEqual(nextDiaryIntents(queue).map(({ id }) => id), ['a1', 'b1']);
assert.equal(equivalentDiaryIntent(queue.items[0], 'update_diary', 'diary-a', { title: 'a1' }), true);
assert.equal(equivalentDiaryIntent(queue.items[0], 'update_diary', 'diary-a', { title: 'changed' }), false);
assert.equal(resolveDiaryIntent(queue, 'a1').items.some(({ id }) => id === 'a1'), false);
const blocked = blockDiaryIntent(queue, 'a1', 'idempotency_conflict');
assert.equal(blocked.items[0].status, 'blocked'); assert.equal(blocked.items[0].errorCode, 'idempotency_conflict');

const values = new Map();
const storage = createDiaryOutboxStorage({ getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async (key) => { values.delete(key); } });
await storage.set('user-a', queue);
assert.deepEqual((await storage.get('user-a')).items.map(({ clientRequestId }) => clientRequestId), ['request-a1', 'request-a2', 'request-b1']);
assert.deepEqual((await storage.get('user-b')).items, []);
assert.notEqual(diaryOutboxKey('user-a'), diaryOutboxKey('user-b'));
values.set(diaryOutboxKey('user-b'), '{broken'); assert.deepEqual((await storage.get('user-b')).items, []);

const [api, provider, prototypeStorage] = await Promise.all([readFile(new URL('./api.ts', import.meta.url), 'utf8'), readFile(new URL('./provider.tsx', import.meta.url), 'utf8'), readFile(new URL('./storage.ts', import.meta.url), 'utf8')]);
for (const route of ['/diaries', '/days/date/', '/topics/order', '/objects/order']) assert.match(api, new RegExp(route.replaceAll('/', '\\/')));
for (const kind of ['create_diary', 'update_diary', 'delete_diary', 'ensure_day', 'update_day', 'delete_day', 'create_topic', 'update_topic', 'delete_topic', 'reorder_topics', 'create_object', 'update_object', 'delete_object', 'reorder_objects']) assert.match(provider, new RegExp(`'${kind}'`));
assert.match(provider, /diary_version_conflict/); assert.match(provider, /semanticallySatisfied/); assert.match(provider, /conflictRetries < 1/);
assert.match(provider, /intent\.expectedVersion = authority\.version/); assert.match(provider, /intent\.clientRequestId/);
assert.match(provider, /retryable\(error\)/); assert.match(provider, /idempotency_conflict/); assert.match(provider, /nextDiaryIntents/);
assert.doesNotMatch(provider, /from '@\/diaries\/storage'/); assert.match(prototypeStorage, /prototype-v1/);
assert.match(provider, /diary_media_mutations_unavailable/); assert.match(provider, /diary_reference_mutations_unavailable/);
console.log('✓ Diary durable outbox isolates users, preserves request IDs, serializes per Diary, and exposes bounded conflict handling');
