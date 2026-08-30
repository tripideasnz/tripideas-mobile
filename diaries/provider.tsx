import * as Crypto from 'expo-crypto';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/auth/provider';
import { diaryMutationApi, listApiDiaries, readApiDiary } from '@/diaries/api';
import { diaryDetailView, diarySummaryView, type DiaryApiDetail, type DiaryApiSummary } from '@/diaries/api-model';
import { diaryApiStorage, replaceDiaryApiList } from '@/diaries/api-storage';
import { appendDiaryIntent, blockDiaryIntent, diaryOutboxStorage, equivalentDiaryIntent, nextDiaryIntents, resolveDiaryIntent, type DiaryMutationIntent, type DiaryMutationKind, type DiaryOutbox } from '@/diaries/outbox';
import type { Diary, DiaryCoordinates, DiaryDay, DiaryItem, DiaryTopic, NewDiaryItem } from '@/diaries/types';
import { ApiError } from '@/lib/api-client';
import { checkApiCapability, type ApiCapabilityStatus } from '@/lib/api-compatibility';

type Capability = ApiCapabilityStatus | 'checking';
type MutationResult = { detail: DiaryApiDetail; clientRequestId: string };
type MutationWaiter = { resolve: (result: MutationResult) => void; reject: (error: unknown) => void };
type Context = {
  diaries: Diary[]; isLoading: boolean; loadError: string | null; mutationError: string | null; canRetryPending: boolean; capability: Capability; canEdit: boolean; canEditMedia: false;
  isDetailLoaded(id: string): boolean; loadDiary(id: string): Promise<Diary>; refresh(): Promise<void>; retryPending(): Promise<void>;
  createDiary(input: { title: string; startDate: string | null; endDate: string | null }): Promise<Diary>; deleteDiary(diaryId: string): Promise<void>;
  updateDiaryMetadata(diaryId: string, input: { title?: string; description?: string | null; coverPhotoAssetId?: string | null; coverPhotoAssetIds?: string[] }): Promise<void>;
  ensureDay(diaryId: string, date: string): Promise<DiaryDay>; updateDateRange(diaryId: string, startDate: string | null, endDate: string | null, removeOutside?: boolean): Promise<{ outsideDays: DiaryDay[] }>;
  deleteDay(diaryId: string, dayId: string): Promise<void>; updateDay(diaryId: string, dayId: string, input: { heading?: string | null; summary?: string | null }): Promise<void>;
  addTopic(diaryId: string, dayId: string, title: string): Promise<DiaryTopic>; deleteTopic(diaryId: string, dayId: string, topicId: string): Promise<void>; updateTopic(diaryId: string, dayId: string, topicId: string, input: { title?: string; startTime?: string | null }): Promise<void>;
  addItem(diaryId: string, dayId: string, topicId: string, item: NewDiaryItem & { locationSource?: 'PIN_NOW' | 'MAP_SELECTED' }): Promise<DiaryItem>; moveTopic(diaryId: string, dayId: string, topicId: string, offset: -1 | 1): Promise<void>; moveItem(diaryId: string, dayId: string, topicId: string, itemId: string, offset: -1 | 1): Promise<void>;
  reorderTopics(diaryId: string, dayId: string, orderedIds: string[]): Promise<void>; reorderItems(diaryId: string, dayId: string, topicId: string, orderedIds: string[]): Promise<void>;
  deleteItem(diaryId: string, dayId: string, topicId: string, itemId: string): Promise<void>;
  updateItem(diaryId: string, dayId: string, topicId: string, itemId: string, input: Partial<Pick<DiaryItem, 'manuallyEditedAt'>> & { text?: string; title?: string | null; note?: string | null; label?: string | null; url?: string; location?: DiaryCoordinates }): Promise<void>;
};

const DiaryContext = createContext<Context | null>(null);
const emptyOutbox = (): DiaryOutbox => ({ format: 'diary-mutation-outbox-v1', items: [] });
const requestId = () => Crypto.randomUUID();
const project = (summaries: DiaryApiSummary[], details: DiaryApiDetail[]) => { const byId = new Map(details.map((detail) => [detail.id, detail])); return summaries.map((summary) => { const detail = byId.get(summary.id); return detail?.version === summary.version ? diaryDetailView(detail) : diarySummaryView(summary); }); };
const retryable = (error: unknown) => !(error instanceof ApiError) || error.status === 0 || error.status === 401 || error.status >= 500;
const blockedMessage = (code: string) => code === 'diary_version_conflict' ? 'This Diary changed elsewhere. Review the refreshed content and retry your edit.' : code === 'idempotency_conflict' ? 'This edit could not be safely retried.' : 'This Diary change could not be saved.';

export function DiaryProvider({ children }: PropsWithChildren) {
  const { session } = useSession(); const userId = session?.userId ?? null;
  const activeUser = useRef<string | null>(null); const summaries = useRef<DiaryApiSummary[]>([]); const details = useRef<DiaryApiDetail[]>([]); const outbox = useRef<DiaryOutbox>(emptyOutbox());
  const draining = useRef(new Map<string, Promise<void>>()); const waiters = useRef(new Map<string, MutationWaiter[]>());
  const [diaries, setDiaries] = useState<Diary[]>([]); const [isLoading, setIsLoading] = useState(false); const [loadError, setLoadError] = useState<string | null>(null); const [mutationError, setMutationError] = useState<string | null>(null); const [canRetryPending, setCanRetryPending] = useState(false); const [capability, setCapability] = useState<Capability>('checking');

  const publish = useCallback((ownerId: string) => { if (activeUser.current === ownerId) setDiaries(project(summaries.current, details.current)); }, []);
  const storeRead = useCallback(async (ownerId: string) => { if (activeUser.current === ownerId) await diaryApiStorage.set(ownerId, { format: 'diary-api-read-v1', summaries: summaries.current, details: details.current }); }, []);
  const storeDetail = useCallback(async (ownerId: string, detail: DiaryApiDetail) => { if (activeUser.current !== ownerId) return detail; details.current = [...details.current.filter(({ id }) => id !== detail.id), detail]; summaries.current = summaries.current.some(({ id }) => id === detail.id) ? summaries.current.map((value) => value.id === detail.id ? detail : value) : [detail, ...summaries.current]; publish(ownerId); await storeRead(ownerId); return detail; }, [publish, storeRead]);
  const removeDetail = useCallback(async (ownerId: string, id: string) => { summaries.current = summaries.current.filter((value) => value.id !== id); details.current = details.current.filter((value) => value.id !== id); publish(ownerId); await storeRead(ownerId); }, [publish, storeRead]);
  const persistOutbox = useCallback(async (ownerId: string) => { if (activeUser.current === ownerId) await diaryOutboxStorage.set(ownerId, outbox.current); }, []);
  const resolveWaiters = useCallback((intentId: string, result: MutationResult) => { waiters.current.get(intentId)?.forEach((waiter) => waiter.resolve(result)); waiters.current.delete(intentId); }, []);
  const rejectWaiters = useCallback((intentId: string, error: unknown) => { waiters.current.get(intentId)?.forEach((waiter) => waiter.reject(error)); waiters.current.delete(intentId); }, []);

  const execute = useCallback(async (intent: DiaryMutationIntent, expectedVersion: number | null) => {
    const p: Record<string, unknown> = { ...intent.payload, clientRequestId: intent.clientRequestId, ...(intent.kind === 'create_diary' ? {} : { expectedVersion }) }; const d = intent.diaryId;
    switch (intent.kind) {
      case 'create_diary': return diaryMutationApi.create(p as never);
      case 'update_diary': return diaryMutationApi.update(d, p); case 'delete_diary': return diaryMutationApi.delete(d, p);
      case 'ensure_day': { const { date, ...body } = p; return diaryMutationApi.ensureDay(d, String(date), body); }
      case 'update_day': { const { dayId, ...body } = p; return diaryMutationApi.updateDay(d, String(dayId), body); }
      case 'delete_day': { const { dayId, ...body } = p; return diaryMutationApi.deleteDay(d, String(dayId), body); }
      case 'create_topic': { const { dayId, ...body } = p; return diaryMutationApi.createTopic(d, String(dayId), body); }
      case 'update_topic': { const { topicId, ...body } = p; return diaryMutationApi.updateTopic(d, String(topicId), body); }
      case 'delete_topic': { const { topicId, ...body } = p; return diaryMutationApi.deleteTopic(d, String(topicId), body); }
      case 'reorder_topics': { const { dayId, ...body } = p; return diaryMutationApi.reorderTopics(d, String(dayId), body); }
      case 'create_object': { const { topicId, ...body } = p; return diaryMutationApi.createObject(d, String(topicId), body); }
      case 'update_object': { const { objectId, ...body } = p; return diaryMutationApi.updateObject(d, String(objectId), body); }
      case 'delete_object': { const { objectId, ...body } = p; return diaryMutationApi.deleteObject(d, String(objectId), body); }
      case 'reorder_objects': { const { topicId, ...body } = p; return diaryMutationApi.reorderObjects(d, String(topicId), body); }
    }
  }, []);

  const semanticallySatisfied = useCallback((intent: DiaryMutationIntent, detail: DiaryApiDetail) => {
    const p = intent.payload; const days = detail.days; const topics = days.flatMap((day) => day.topics); const objects = topics.flatMap((topic) => topic.objects);
    if (intent.kind === 'update_diary') return ['title', 'description', 'startDate', 'endDate'].every((key) => p[key] === undefined || detail[key as keyof DiaryApiDetail] === p[key]);
    if (intent.kind === 'ensure_day') return days.some((day) => day.date === p.date); if (intent.kind === 'delete_day') return !days.some((day) => day.id === p.dayId);
    if (intent.kind === 'delete_topic') return !topics.some((topic) => topic.id === p.topicId); if (intent.kind === 'delete_object') return !objects.some((object) => object.id === p.objectId);
    if (intent.kind === 'create_object') return objects.some((object) => object.clientRequestId === intent.clientRequestId);
    if (intent.kind === 'reorder_topics') return days.find((day) => day.id === p.dayId)?.topics.map(({ id }) => id).join('|') === (p.topicIds as string[]).join('|');
    if (intent.kind === 'reorder_objects') return topics.find((topic) => topic.id === p.topicId)?.objects.map(({ id }) => id).join('|') === (p.objectIds as string[]).join('|'); return false;
  }, []);

  const processDiary = useCallback(async (ownerId: string, diaryId: string): Promise<void> => {
    if (draining.current.has(diaryId)) return draining.current.get(diaryId)!;
    const run = (async () => { while (activeUser.current === ownerId) {
      const intent = outbox.current.items.find((item) => item.diaryId === diaryId); if (!intent || intent.status === 'blocked') return;
      let authority = intent.kind === 'create_diary' ? null : details.current.find(({ id }) => id === diaryId) ?? await storeDetail(ownerId, await readApiDiary(diaryId));
      const expectedVersion = intent.expectedVersion ?? authority?.version ?? null; intent.expectedVersion = expectedVersion; intent.attempted = true; await persistOutbox(ownerId);
      try { const result = await execute(intent, expectedVersion); if (result) await storeDetail(ownerId, result); outbox.current = resolveDiaryIntent(outbox.current, intent.id); await persistOutbox(ownerId); setMutationError(null); setCanRetryPending(false); if (result) resolveWaiters(intent.id, { detail: result, clientRequestId: intent.clientRequestId }); else if (authority) resolveWaiters(intent.id, { detail: authority, clientRequestId: intent.clientRequestId }); if (intent.kind === 'delete_diary') await removeDetail(ownerId, diaryId); }
      catch (error) {
        if (error instanceof ApiError && error.code === 'diary_version_conflict' && intent.conflictRetries < 1) { authority = await storeDetail(ownerId, await readApiDiary(diaryId)); if (semanticallySatisfied(intent, authority)) { outbox.current = resolveDiaryIntent(outbox.current, intent.id); await persistOutbox(ownerId); resolveWaiters(intent.id, { detail: authority, clientRequestId: intent.clientRequestId }); continue; } intent.expectedVersion = authority.version; intent.attempted = false; intent.conflictRetries += 1; await persistOutbox(ownerId); continue; }
        if (retryable(error)) { setMutationError('Some Diary changes are waiting for a connection.'); setCanRetryPending(true); rejectWaiters(intent.id, error); return; }
        const errorCode = error instanceof ApiError ? error.code : 'mutation_failed'; outbox.current = blockDiaryIntent(outbox.current, intent.id, errorCode); await persistOutbox(ownerId); setMutationError(blockedMessage(errorCode)); setCanRetryPending(false); rejectWaiters(intent.id, error); return;
      }
    } })().finally(() => draining.current.delete(diaryId)); draining.current.set(diaryId, run); return run;
  }, [execute, persistOutbox, rejectWaiters, removeDetail, resolveWaiters, semanticallySatisfied, storeDetail]);

  const drain = useCallback(async () => { const ownerId = activeUser.current; if (!ownerId || capability === 'unsupported') return; await Promise.all(nextDiaryIntents(outbox.current).map((item) => processDiary(ownerId, item.diaryId))); }, [capability, processDiary]);
  const enqueue = useCallback(async (diaryId: string, kind: DiaryMutationKind, payload: Record<string, unknown>) => { const ownerId = activeUser.current; if (!ownerId) throw new ApiError(401, 'mobile_session_required'); let item = outbox.current.items.find((value) => equivalentDiaryIntent(value, kind, diaryId, payload)); if (!item) { item = { id: requestId(), diaryId, kind, payload, clientRequestId: requestId(), expectedVersion: null, attempted: false, conflictRetries: 0, status: 'queued', errorCode: null, createdAt: new Date().toISOString() }; outbox.current = appendDiaryIntent(outbox.current, item); await persistOutbox(ownerId); } const promise = new Promise<MutationResult>((resolve, reject) => waiters.current.set(item!.id, [...(waiters.current.get(item!.id) ?? []), { resolve, reject }])); void processDiary(ownerId, item.diaryId); return promise; }, [persistOutbox, processDiary]);

  const refresh = useCallback(async () => { const ownerId = activeUser.current; if (!ownerId) return; setIsLoading(true); setLoadError(null); try { const latest = await listApiDiaries(); if (activeUser.current !== ownerId) return; const replaced = replaceDiaryApiList({ format: 'diary-api-read-v1', summaries: summaries.current, details: details.current }, latest); summaries.current = replaced.summaries; details.current = replaced.details; publish(ownerId); await storeRead(ownerId); await drain(); } catch { if (activeUser.current === ownerId) setLoadError('Showing saved Diaries. Connect to refresh them.'); } finally { if (activeUser.current === ownerId) setIsLoading(false); } }, [drain, publish, storeRead]);
  const loadDiary = useCallback(async (id: string) => { const ownerId = activeUser.current; if (!ownerId) throw new ApiError(401, 'mobile_session_required'); try { return diaryDetailView(await storeDetail(ownerId, await readApiDiary(id))); } catch (error) { const cached = details.current.find((detail) => detail.id === id); if (cached) { setLoadError('Showing a saved Diary. Connect to refresh it.'); return diaryDetailView(cached); } throw error; } }, [storeDetail]);

  useEffect(() => { if (!userId || capability === 'unsupported' || capability === 'checking') return; const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void drain(); }); return () => subscription.remove(); }, [capability, drain, userId]);

  useEffect(() => { let mounted = true; activeUser.current = userId; summaries.current = []; details.current = []; outbox.current = emptyOutbox(); setDiaries([]); setLoadError(null); setMutationError(null); setCanRetryPending(false); setCapability('checking'); if (!userId) { setIsLoading(false); return; } setIsLoading(true); void (async () => { const [cached, pending] = await Promise.all([diaryApiStorage.get(userId), diaryOutboxStorage.get(userId)]); if (!mounted || activeUser.current !== userId) return; summaries.current = cached.summaries; details.current = cached.details; outbox.current = pending; publish(userId); const status = await checkApiCapability('diaries-v1'); if (!mounted || activeUser.current !== userId) return; setCapability(status); if (status === 'supported') { const latest = await listApiDiaries(); const replaced = replaceDiaryApiList(cached, latest); summaries.current = replaced.summaries; details.current = replaced.details; publish(userId); await storeRead(userId); await Promise.all(nextDiaryIntents(outbox.current).map((item) => processDiary(userId, item.diaryId))); } else { setLoadError(status === 'unreachable' ? (cached.summaries.length ? 'Showing saved Diaries. Connect to refresh them.' : 'Diaries are unavailable while offline.') : 'This version of the API does not support Diaries.'); if (status === 'unsupported') setDiaries([]); } setIsLoading(false); })().catch(() => { if (mounted && activeUser.current === userId) { setCapability('unreachable'); setLoadError('Diaries could not be refreshed.'); setIsLoading(false); } }); return () => { mounted = false; if (activeUser.current === userId) activeUser.current = null; }; }, [processDiary, publish, storeRead, userId]);

  const current = (id: string) => details.current.find((detail) => detail.id === id);
  const value = useMemo<Context>(() => ({
    diaries, isLoading, loadError, mutationError, canRetryPending, capability, canEdit: capability !== 'unsupported' && capability !== 'checking', canEditMedia: false,
    isDetailLoaded: (id) => Boolean(current(id)), loadDiary, refresh, retryPending: drain,
    async createDiary(input) { return diaryDetailView((await enqueue(`pending:${requestId()}`, 'create_diary', input)).detail); }, async deleteDiary(id) { await enqueue(id, 'delete_diary', {}); },
    async updateDiaryMetadata(id, input) { if (input.coverPhotoAssetId !== undefined || input.coverPhotoAssetIds !== undefined) throw new ApiError(409, 'diary_media_mutations_unavailable'); await enqueue(id, 'update_diary', input); },
    async ensureDay(id, date) { const result = diaryDetailView((await enqueue(id, 'ensure_day', { date })).detail); return result.days.find((day) => day.date === date)!; },
    async updateDateRange(id, startDate, endDate, removeOutsideDays = false) { const source = diaryDetailView(current(id)!); const outsideDays = source.days.filter((day) => Boolean(startDate && day.date < startDate) || Boolean(endDate && day.date > endDate)); if (outsideDays.length && !removeOutsideDays) return { outsideDays }; await enqueue(id, 'update_diary', { startDate, endDate, removeOutsideDays }); return { outsideDays: [] }; },
    async deleteDay(id, dayId) { await enqueue(id, 'delete_day', { dayId }); }, async updateDay(id, dayId, input) { await enqueue(id, 'update_day', { dayId, ...input }); },
    async addTopic(id, dayId, title) { const sourceTopics = current(id)!.days.find((day) => day.id === dayId)?.topics ?? []; const previousIds = new Set(sourceTopics.map(({ id }) => id)); const position = sourceTopics.length; const result = diaryDetailView((await enqueue(id, 'create_topic', { dayId, title, position })).detail); const topics = result.days.find((day) => day.id === dayId)!.topics; const created = topics.find((topic) => !previousIds.has(topic.id) && topic.title === title) ?? topics[position]; if (!created) throw new ApiError(500, 'diary_created_topic_missing'); return created; },
    async deleteTopic(id, _dayId, topicId) { await enqueue(id, 'delete_topic', { topicId }); }, async updateTopic(id, _dayId, topicId, input) { await enqueue(id, 'update_topic', { topicId, ...input }); },
    async addItem(id, _dayId, topicId, item) { if (item.type === 'PHOTO' || item.type === 'EDITORIAL_PLACE' || item.type === 'PERSONAL_PLACE') throw new ApiError(409, 'diary_reference_mutations_unavailable'); const topic = current(id)!.days.flatMap(({ topics }) => topics).find((value) => value.id === topicId)!; const position = topic.objects.length; const payload = item.type === 'LOCATION' ? { topicId, type: 'PIN', label: item.label, location: { ...item.location, source: item.locationSource ?? 'PIN_NOW' }, position } : item.type === 'NARRATIVE' ? { topicId, type: 'NARRATIVE', title: item.title, text: item.text, position, includeOnMap: item.includeOnMap } : { topicId, type: 'LINK', title: item.title, url: item.url, note: item.note, position, includeOnMap: item.includeOnMap }; const completed = await enqueue(id, 'create_object', payload); const objectId = completed.detail.days.flatMap(({ topics }) => topics).flatMap(({ objects }) => objects).find((value) => value.clientRequestId === completed.clientRequestId)?.id; const result = diaryDetailView(completed.detail); const created = result.days.flatMap(({ topics }) => topics).flatMap(({ items }) => items).find((value) => value.id === objectId); if (!created) throw new ApiError(500, 'diary_created_object_missing'); return created; },
    async moveTopic(id, dayId, topicId, offset) { const topics = current(id)!.days.find((day) => day.id === dayId)!.topics; const index = topics.findIndex((topic) => topic.id === topicId); const target = index + offset; if (target < 0 || target >= topics.length) return; const topicIds = topics.map(({ id }) => id); [topicIds[index], topicIds[target]] = [topicIds[target], topicIds[index]]; await enqueue(id, 'reorder_topics', { dayId, topicIds }); },
    async moveItem(id, _dayId, topicId, objectId, offset) { const objects = current(id)!.days.flatMap(({ topics }) => topics).find((topic) => topic.id === topicId)!.objects; const index = objects.findIndex((item) => item.id === objectId); const target = index + offset; if (target < 0 || target >= objects.length) return; const objectIds = objects.map(({ id }) => id); [objectIds[index], objectIds[target]] = [objectIds[target], objectIds[index]]; await enqueue(id, 'reorder_objects', { topicId, objectIds }); },
    async reorderTopics(id, dayId, topicIds) { await enqueue(id, 'reorder_topics', { dayId, topicIds }); }, async reorderItems(id, _dayId, topicId, objectIds) { await enqueue(id, 'reorder_objects', { topicId, objectIds }); },
    async deleteItem(id, _dayId, _topicId, objectId) { await enqueue(id, 'delete_object', { objectId }); },
    async updateItem(id, _dayId, _topicId, objectId, input) { const { manuallyEditedAt: _, note, label, location, ...rest } = input; await enqueue(id, 'update_object', { objectId, ...rest, ...(note !== undefined ? { text: note } : {}), ...(label !== undefined ? { title: label } : {}), ...(location ? { location: { ...location, source: 'MAP_SELECTED' } } : {}) }); },
  }), [canRetryPending, capability, diaries, drain, enqueue, isLoading, loadDiary, loadError, mutationError, refresh]);
  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
}

export function useDiaries() { const value = useContext(DiaryContext); if (!value) throw new Error('useDiaries requires DiaryProvider'); return value; }
