import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Diary } from '@/diaries/types';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
const VERSION = 'prototype-v1';
export const diaryStorageKey = (userId: string) => `tripideas.diaries.user.${userId}.${VERSION}`;

function normalizeDiaries(values: Diary[]): Diary[] {
  return values.map((diary) => ({ ...diary, days: (diary.days ?? []).map((day) => ({ ...day,
    topics: (day.topics ?? []).map((topic) => ({ ...topic, startTime: topic.startTime ?? null, items: (topic.items ?? []).map((item) =>
      item.type === 'NARRATIVE' ? { ...item, title: item.title ?? null } : item) })) })) }));
}

export function createDiaryStorage(storage: Storage = AsyncStorage) {
  return {
    async get(userId: string): Promise<Diary[]> {
      try {
        const parsed = JSON.parse(await storage.getItem(diaryStorageKey(userId)) ?? '[]');
        return Array.isArray(parsed) ? normalizeDiaries(parsed) : [];
      } catch { return []; }
    },
    async set(userId: string, diaries: Diary[]) {
      await storage.setItem(diaryStorageKey(userId), JSON.stringify(diaries));
    },
    async clear(userId: string) { await storage.removeItem(diaryStorageKey(userId)); },
  };
}
export const diaryStorage = createDiaryStorage();
