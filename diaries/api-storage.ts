import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseDiaryDetail, parseDiarySummary, type DiaryApiDetail, type DiaryApiSummary } from '@/diaries/api-model';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
type DiaryApiCache = { format: 'diary-api-read-v1'; summaries: DiaryApiSummary[]; details: DiaryApiDetail[] };
export const diaryApiCacheKey = (userId: string) => `tripideas.diaries.api.user.${userId}.v1`;
const empty = (): DiaryApiCache => ({ format: 'diary-api-read-v1', summaries: [], details: [] });

export function replaceDiaryApiList(cache: DiaryApiCache, summaries: DiaryApiSummary[]): DiaryApiCache {
  const versions = new Map(summaries.map((summary) => [summary.id, summary.version]));
  return { format: 'diary-api-read-v1', summaries, details: cache.details.filter((detail) => versions.get(detail.id) === detail.version) };
}

export function createDiaryApiStorage(storage: Storage = AsyncStorage) {
  return {
    async get(userId: string): Promise<DiaryApiCache> {
      const raw = await storage.getItem(diaryApiCacheKey(userId));
      if (!raw) return empty();
      try {
        const value = JSON.parse(raw);
        if (value?.format !== 'diary-api-read-v1' || !Array.isArray(value.summaries) || !Array.isArray(value.details)) return empty();
        return { format: 'diary-api-read-v1', summaries: value.summaries.map(parseDiarySummary), details: value.details.map(parseDiaryDetail) };
      } catch {
        return empty();
      }
    },
    async set(userId: string, cache: DiaryApiCache) {
      await storage.setItem(diaryApiCacheKey(userId), JSON.stringify(cache));
    },
    async clear(userId: string) {
      await storage.removeItem(diaryApiCacheKey(userId));
    },
  };
}

export const diaryApiStorage = createDiaryApiStorage();
export type { DiaryApiCache };
