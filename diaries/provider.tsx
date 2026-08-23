import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@/auth/provider';
import { moveDiaryItem } from '@/diaries/model';
import { diaryStorage } from '@/diaries/storage';
import { applyDiaryReorder } from '@/diaries/model';
import { outsideDiaryRange } from '@/diaries/dates';
import type { Diary, DiaryCoordinates, DiaryDay, DiaryItem, DiaryTopic, NewDiaryItem } from '@/diaries/types';

const id = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();
type Context = {
  diaries: Diary[]; isLoading: boolean;
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

export function DiaryProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const diariesRef = useRef<Diary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    let active = true;
    if (!userId) { diariesRef.current = []; setDiaries([]); return; }
    setIsLoading(true);
    void diaryStorage.get(userId).then((value) => { if (active) { diariesRef.current = value; setDiaries(value); } })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const mutate = useCallback(async (change: (current: Diary[]) => Diary[]) => {
    if (!userId) throw new Error('Diary drafts require sign-in.');
    const next = change(diariesRef.current);
    diariesRef.current = next;
    setDiaries(next);
    await diaryStorage.set(userId, next);
  }, [userId]);
  const updateDiary = useCallback((diaryId: string, change: (diary: Diary) => Diary) =>
    mutate((current) => current.map((diary) => diary.id === diaryId
      ? { ...change(diary), version: diary.version + 1, updatedAt: now() } : diary)), [mutate]);

  const value = useMemo<Context>(() => ({
    diaries, isLoading,
    async createDiary(input) {
      const timestamp = now();
      const diary: Diary = { id: id('diary'), title: input.title.trim(), description: null,
        coverPhotoAssetId: null, coverPhotoAssetIds: [], startDate: input.startDate, endDate: input.endDate,
        state: 'ACTIVE', version: 1, days: [], sources: [], createdAt: timestamp, updatedAt: timestamp };
      await mutate((current) => [diary, ...current]); return diary;
    },
    deleteDiary: (diaryId) => mutate((current) => current.filter(({ id }) => id !== diaryId)),
    updateDiaryMetadata: (diaryId, input) => updateDiary(diaryId, (diary) => ({ ...diary, ...input })),
    async ensureDay(diaryId, date) {
      const existing = diariesRef.current.find(({ id }) => id === diaryId)?.days.find((day) => day.date === date);
      if (existing) return existing;
      const created: DiaryDay = { id: id('day'), date, heading: null, summary: null, position: 0, topics: [] };
      await updateDiary(diaryId, (diary) => ({ ...diary, days: [...diary.days, created]
        .sort((a, b) => a.date.localeCompare(b.date)).map((day, position) => ({ ...day, position })) }));
      return created;
    },
    async updateDateRange(diaryId, startDate, endDate, removeOutside = false) {
      const diary = diariesRef.current.find(({ id }) => id === diaryId);
      const outsideDays = diary?.days.filter((day) => outsideDiaryRange(day.date, startDate, endDate)) ?? [];
      if (outsideDays.length && !removeOutside) return { outsideDays };
      await updateDiary(diaryId, (current) => ({ ...current, startDate, endDate,
        days: removeOutside ? current.days.filter((day) => !outsideDiaryRange(day.date, startDate, endDate)) : current.days }));
      return { outsideDays: [] };
    },
    deleteDay: (diaryId, dayId) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.filter(({ id }) => id !== dayId).map((day, position) => ({ ...day, position })) })),
    updateDay: (diaryId, dayId, input) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day, ...input } : day) })),
    async addTopic(diaryId, dayId, title) {
      const sourceDay = diariesRef.current.find(({ id }) => id === diaryId)?.days.find(({ id }) => id === dayId);
      const topic: DiaryTopic = { id: id('topic'), title: title.trim(), startTime: null, position: sourceDay?.topics.length ?? 0,
        version: 1, creationMethod: 'USER', manuallyEditedAt: null, items: [] };
      await updateDiary(diaryId, (diary) => ({ ...diary,
        days: diary.days.map((day) => day.id === dayId ? { ...day, topics: [...day.topics, topic] } : day) }));
      return topic;
    },
    deleteTopic: (diaryId, dayId, topicId) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day,
        topics: day.topics.filter(({ id }) => id !== topicId).map((topic, position) => ({ ...topic, position })) } : day) })),
    updateTopic: (diaryId, dayId, topicId, input) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day,
        topics: day.topics.map((topic) => topic.id === topicId ? { ...topic, ...input, manuallyEditedAt: now(), version: topic.version + 1 } : topic) } : day) })),
    async addItem(diaryId, dayId, topicId, item) {
      const sourceTopic = diariesRef.current.find(({ id }) => id === diaryId)?.days.find(({ id }) => id === dayId)?.topics.find(({ id }) => id === topicId);
      const created = { ...item, id: id('item'), position: sourceTopic?.items.length ?? 0,
        creationMethod: 'USER', manuallyEditedAt: null, sources: [] } as DiaryItem;
      await updateDiary(diaryId, (diary) => ({ ...diary,
        days: diary.days.map((day) => day.id === dayId ? { ...day,
          topics: day.topics.map((topic) => topic.id === topicId ? { ...topic, version: topic.version + 1,
            items: [...topic.items, created] } : topic) } : day) }));
      return created;
    },
    moveTopic: (diaryId, dayId, topicId, offset) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day, topics: moveDiaryItem(day.topics, topicId, offset) as DiaryTopic[] } : day) })),
    moveItem: (diaryId, dayId, topicId, itemId, offset) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day,
        topics: day.topics.map((topic) => topic.id === topicId ? { ...topic,
          items: moveDiaryItem(topic.items, itemId, offset) } : topic) } : day) })),
    reorderTopics: (diaryId, dayId, orderedIds) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day,
        topics: applyDiaryReorder(day.topics, orderedIds) as DiaryTopic[] } : day) })),
    reorderItems: (diaryId, dayId, topicId, orderedIds) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day,
        topics: day.topics.map((topic) => topic.id === topicId ? { ...topic,
          items: applyDiaryReorder(topic.items, orderedIds) } : topic) } : day) })),
    deleteItem: (diaryId, dayId, topicId, itemId) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day,
        topics: day.topics.map((topic) => topic.id === topicId ? { ...topic,
          items: topic.items.filter(({ id }) => id !== itemId).map((item, position) => ({ ...item, position })) } : topic) } : day) })),
    updateItem: (diaryId, dayId, topicId, itemId, input) => updateDiary(diaryId, (diary) => ({ ...diary,
      days: diary.days.map((day) => day.id === dayId ? { ...day,
        topics: day.topics.map((topic) => topic.id === topicId ? { ...topic,
          items: topic.items.map((item) => item.id === itemId ? { ...item, ...input, manuallyEditedAt: now() } as DiaryItem : item) } : topic) } : day) })),
  }), [diaries, isLoading, mutate, updateDiary]);
  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
}
export function useDiaries() { const value = useContext(DiaryContext); if (!value) throw new Error('useDiaries requires DiaryProvider'); return value; }
