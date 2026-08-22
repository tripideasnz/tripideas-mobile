import AsyncStorage from '@react-native-async-storage/async-storage';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
export const diaryLastViewedKey = (userId: string, diaryId: string) => `tripideas.diaries.last-day.${userId}.${diaryId}`;

export function createDiaryLastViewedStorage(storage: Storage = AsyncStorage) {
  return {
    async get(userId: string, diaryId: string) { try { return await storage.getItem(diaryLastViewedKey(userId, diaryId)); } catch { return null; } },
    async set(userId: string, diaryId: string, date: string) { try { await storage.setItem(diaryLastViewedKey(userId, diaryId), date); } catch { /* non-critical navigation preference */ } },
  };
}

const diaryLastViewedStorage = createDiaryLastViewedStorage();
export const getLastViewedDiaryDay = diaryLastViewedStorage.get;
export const setLastViewedDiaryDay = diaryLastViewedStorage.set;
