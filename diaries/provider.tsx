import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/auth/provider';
import { readApiDiary, listApiDiaries } from '@/diaries/api';
import { diaryDetailView, diarySummaryView, type DiaryApiDetail, type DiaryApiSummary } from '@/diaries/api-model';
import { diaryApiStorage, replaceDiaryApiList, type DiaryApiCache } from '@/diaries/api-storage';
import type { Diary, DiaryCoordinates, DiaryDay, DiaryItem, DiaryTopic, NewDiaryItem } from '@/diaries/types';
import { ApiError } from '@/lib/api-client';
import { checkApiCapability, type ApiCapabilityStatus } from '@/lib/api-compatibility';

type Capability = ApiCapabilityStatus | 'checking';
type Context = {
  diaries: Diary[]; isLoading: boolean; loadError: string | null; capability: Capability; canEdit: false;
  isDetailLoaded(id: string): boolean; loadDiary(id: string): Promise<Diary>; refresh(): Promise<void>;
  createDiary(input: { title: string; startDate: string | null; endDate: string | null }): Promise<Diary>;
  deleteDiary(diaryId: string): Promise<void>;
  updateDiaryMetadata(diaryId: string, input: { title?: string; description?: string | null; coverPhotoAssetId?: string | null; coverPhotoAssetIds?: string[] }): Promise<void>;
  ensureDay(diaryId: string, date: string): Promise<DiaryDay>;
  updateDateRange(diaryId: string, startDate: string | null, endDate: string | null, removeOutside?: boolean): Promise<{ outsideDays: DiaryDay[] }>;
  deleteDay(diaryId: string, dayId: string): Promise<void>;
  updateDay(diaryId: string, dayId: string, input: { heading?: string | null; summary?: string | null }): Promise<void>;
  addTopic(diaryId: string, dayId: string, title: string): Promise<DiaryTopic>;
  deleteTopic(diaryId: string, dayId: string, topicId: string): Promise<void>;
  updateTopic(diaryId: string, dayId: string, topicId: string, input: { title?: string; startTime?: string | null }): Promise<void>;
  addItem(diaryId: string, dayId: string, topicId: string, item: NewDiaryItem): Promise<DiaryItem>;
  moveTopic(diaryId: string, dayId: string, topicId: string, offset: -1 | 1): Promise<void>;
  moveItem(diaryId: string, dayId: string, topicId: string, itemId: string, offset: -1 | 1): Promise<void>;
  reorderTopics(diaryId: string, dayId: string, orderedIds: string[]): Promise<void>;
  reorderItems(diaryId: string, dayId: string, topicId: string, orderedIds: string[]): Promise<void>;
  deleteItem(diaryId: string, dayId: string, topicId: string, itemId: string): Promise<void>;
  updateItem(diaryId: string, dayId: string, topicId: string, itemId: string, input: Partial<Pick<DiaryItem, 'manuallyEditedAt'>> & { text?: string; title?: string | null; note?: string | null; label?: string | null; url?: string; location?: DiaryCoordinates }): Promise<void>;
};

const DiaryContext = createContext<Context | null>(null);
const mutationUnavailable = async (): Promise<never> => { throw new ApiError(409, 'diary_mutations_unavailable', 'Diary editing will be enabled in the next update.'); };
const project = (summaries: DiaryApiSummary[], details: DiaryApiDetail[]) => {
  const byId = new Map(details.map((detail) => [detail.id, detail]));
  return summaries.map((summary) => {
    const detail = byId.get(summary.id);
    return detail?.version === summary.version ? diaryDetailView(detail) : diarySummaryView(summary);
  });
};

export function DiaryProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const activeUser = useRef<string | null>(null);
  const summaries = useRef<DiaryApiSummary[]>([]);
  const details = useRef<DiaryApiDetail[]>([]);
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [capability, setCapability] = useState<Capability>('checking');

  const publish = useCallback((ownerId: string) => {
    if (activeUser.current === ownerId) setDiaries(project(summaries.current, details.current));
  }, []);
  const store = useCallback(async (ownerId: string) => {
    if (activeUser.current !== ownerId) return;
    const cache: DiaryApiCache = { format: 'diary-api-read-v1', summaries: summaries.current, details: details.current };
    await diaryApiStorage.set(ownerId, cache);
  }, []);
  const refresh = useCallback(async () => {
    const ownerId = activeUser.current;
    if (!ownerId) return;
    setIsLoading(true); setLoadError(null);
    try {
      const latest = await listApiDiaries();
      if (activeUser.current !== ownerId) return;
      const replaced = replaceDiaryApiList({ format: 'diary-api-read-v1', summaries: summaries.current, details: details.current }, latest);
      summaries.current = replaced.summaries; details.current = replaced.details;
      publish(ownerId); await store(ownerId);
    } catch {
      if (activeUser.current === ownerId) setLoadError('Showing saved Diaries. Connect to refresh them.');
    } finally {
      if (activeUser.current === ownerId) setIsLoading(false);
    }
  }, [publish, store]);
  const loadDiary = useCallback(async (id: string) => {
    const ownerId = activeUser.current;
    if (!ownerId) throw new ApiError(401, 'mobile_session_required');
    if (capability !== 'supported') {
      const cached = details.current.find((detail) => detail.id === id);
      if (capability === 'unreachable' && cached) return diaryDetailView(cached);
      throw new ApiError(503, capability === 'unsupported' ? 'diaries_unsupported' : 'diaries_unavailable');
    }
    try {
      const detail = await readApiDiary(id);
      if (activeUser.current !== ownerId) throw new ApiError(401, 'mobile_session_required');
      details.current = [...details.current.filter((value) => value.id !== id), detail];
      summaries.current = summaries.current.some((value) => value.id === id)
        ? summaries.current.map((value) => value.id === id ? detail : value)
        : [detail, ...summaries.current];
      publish(ownerId); await store(ownerId); return diaryDetailView(detail);
    } catch (error) {
      const cached = details.current.find((detail) => detail.id === id);
      if (cached) { setLoadError('Showing a saved Diary. Connect to refresh it.'); return diaryDetailView(cached); }
      throw error;
    }
  }, [capability, publish, store]);

  useEffect(() => {
    let mounted = true;
    activeUser.current = userId; summaries.current = []; details.current = [];
    setDiaries([]); setLoadError(null); setCapability('checking');
    if (!userId) { setIsLoading(false); return; }
    setIsLoading(true);
    void (async () => {
      const cached = await diaryApiStorage.get(userId);
      if (!mounted || activeUser.current !== userId) return;
      summaries.current = cached.summaries; details.current = cached.details; publish(userId);
      const status = await checkApiCapability('diaries-v1');
      if (!mounted || activeUser.current !== userId) return;
      setCapability(status);
      if (status === 'supported') await refresh();
      else if (status === 'unreachable') {
        setLoadError(cached.summaries.length ? 'Showing saved Diaries. Connect to refresh them.' : 'Diaries are unavailable while offline.'); setIsLoading(false);
      } else {
        setDiaries([]); setLoadError('This version of the API does not support Diaries.'); setIsLoading(false);
      }
    })().catch(() => {
      if (mounted && activeUser.current === userId) { setCapability('unreachable'); setLoadError('Diaries could not be loaded.'); setIsLoading(false); }
    });
    return () => { mounted = false; if (activeUser.current === userId) activeUser.current = null; };
  }, [publish, refresh, userId]);

  const value = useMemo<Context>(() => ({
    diaries, isLoading, loadError, capability, canEdit: false,
    isDetailLoaded: (id) => details.current.some((detail) => detail.id === id && summaries.current.some((summary) => summary.id === id && summary.version === detail.version)),
    loadDiary, refresh,
    createDiary: mutationUnavailable, deleteDiary: mutationUnavailable, updateDiaryMetadata: mutationUnavailable,
    ensureDay: mutationUnavailable, updateDateRange: mutationUnavailable, deleteDay: mutationUnavailable,
    updateDay: mutationUnavailable, addTopic: mutationUnavailable, deleteTopic: mutationUnavailable,
    updateTopic: mutationUnavailable, addItem: mutationUnavailable, moveTopic: mutationUnavailable,
    moveItem: mutationUnavailable, reorderTopics: mutationUnavailable, reorderItems: mutationUnavailable,
    deleteItem: mutationUnavailable, updateItem: mutationUnavailable,
  }), [capability, diaries, isLoading, loadDiary, loadError, refresh]);
  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
}

export function useDiaries() {
  const value = useContext(DiaryContext);
  if (!value) throw new Error('useDiaries requires DiaryProvider');
  return value;
}
