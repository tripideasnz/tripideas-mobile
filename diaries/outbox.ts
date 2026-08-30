import AsyncStorage from '@react-native-async-storage/async-storage';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
export type DiaryMutationKind = 'create_diary' | 'update_diary' | 'delete_diary' | 'ensure_day' | 'update_day' | 'delete_day' | 'create_topic' | 'update_topic' | 'delete_topic' | 'reorder_topics' | 'create_object' | 'update_object' | 'delete_object' | 'reorder_objects' | 'attach_cover' | 'remove_cover' | 'reorder_cover';
export type DiaryMutationIntent = {
  id: string; diaryId: string; kind: DiaryMutationKind; clientRequestId: string;
  expectedVersion: number | null; attempted: boolean; conflictRetries: number;
  status: 'queued' | 'blocked'; errorCode: string | null; payload: Record<string, unknown>; createdAt: string;
};
export type DiaryOutbox = { format: 'diary-mutation-outbox-v1'; items: DiaryMutationIntent[] };
const empty = (): DiaryOutbox => ({ format: 'diary-mutation-outbox-v1', items: [] });
export const diaryOutboxKey = (userId: string) => `tripideas.diaries.outbox.user.${userId}.v1`;
const kinds = new Set<DiaryMutationKind>(['create_diary', 'update_diary', 'delete_diary', 'ensure_day', 'update_day', 'delete_day', 'create_topic', 'update_topic', 'delete_topic', 'reorder_topics', 'create_object', 'update_object', 'delete_object', 'reorder_objects', 'attach_cover', 'remove_cover', 'reorder_cover']);
const valid = (value: unknown): value is DiaryOutbox => Boolean(value && typeof value === 'object' && (value as DiaryOutbox).format === 'diary-mutation-outbox-v1' && Array.isArray((value as DiaryOutbox).items) && (value as DiaryOutbox).items.every((item) => item && typeof item.id === 'string' && typeof item.diaryId === 'string' && typeof item.clientRequestId === 'string' && kinds.has(item.kind) && (item.expectedVersion === null || Number.isInteger(item.expectedVersion) && item.expectedVersion >= 1) && typeof item.attempted === 'boolean' && Number.isInteger(item.conflictRetries) && item.conflictRetries >= 0 && (item.status === 'queued' || item.status === 'blocked') && (item.errorCode === null || typeof item.errorCode === 'string') && item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload) && typeof item.createdAt === 'string'));

export function createDiaryOutboxStorage(storage: Storage = AsyncStorage) {
  return {
    async get(userId: string) { try { const raw = await storage.getItem(diaryOutboxKey(userId)); if (!raw) return empty(); const parsed = JSON.parse(raw); return valid(parsed) ? parsed : empty(); } catch { return empty(); } },
    async set(userId: string, value: DiaryOutbox) { await storage.setItem(diaryOutboxKey(userId), JSON.stringify(value)); },
    async clear(userId: string) { await storage.removeItem(diaryOutboxKey(userId)); },
  };
}
export const diaryOutboxStorage = createDiaryOutboxStorage();

export function appendDiaryIntent(outbox: DiaryOutbox, item: DiaryMutationIntent): DiaryOutbox {
  return { ...outbox, items: [...outbox.items, item] };
}

export const equivalentDiaryIntent = (item: DiaryMutationIntent, kind: DiaryMutationKind, diaryId: string, payload: Record<string, unknown>) =>
  item.status === 'queued' && JSON.stringify([item.kind, item.kind === 'create_diary' ? 'new' : item.diaryId, item.payload]) === JSON.stringify([kind, kind === 'create_diary' ? 'new' : diaryId, payload]);

export const resolveDiaryIntent = (outbox: DiaryOutbox, id: string): DiaryOutbox => ({ ...outbox, items: outbox.items.filter((item) => item.id !== id) });
export const blockDiaryIntent = (outbox: DiaryOutbox, id: string, errorCode: string): DiaryOutbox => ({ ...outbox, items: outbox.items.map((item) => item.id === id ? { ...item, status: 'blocked', errorCode } : item) });

export function nextDiaryIntents(outbox: DiaryOutbox): DiaryMutationIntent[] {
  const seen = new Set<string>();
  return outbox.items.filter((item) => item.status === 'queued' && !seen.has(item.diaryId) && Boolean(seen.add(item.diaryId)));
}
