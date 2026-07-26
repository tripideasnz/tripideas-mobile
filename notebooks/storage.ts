import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NotebookDetail, NotebookSummary } from '@/notebooks/types';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

const VERSION = 'v1';

export function notebookListKey(userId: string): string {
  return `tripideas.notebooks.user.${userId}.${VERSION}`;
}

export function notebookDetailKey(userId: string, notebookId: string): string {
  return `tripideas.notebookDetails.user.${userId}.${notebookId}.${VERSION}`;
}

export function notebookDetailIndexKey(userId: string): string {
  return `tripideas.notebookDetails.user.${userId}.index.${VERSION}`;
}

function parseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function createNotebookStorage(storage: Storage = AsyncStorage) {
  return {
    async getList(userId: string): Promise<NotebookSummary[]> {
      return parseArray<NotebookSummary>(
        await storage.getItem(notebookListKey(userId))
      );
    },

    async setList(userId: string, notebooks: NotebookSummary[]): Promise<void> {
      await storage.setItem(notebookListKey(userId), JSON.stringify(notebooks));
    },

    async getDetail(
      userId: string,
      notebookId: string
    ): Promise<NotebookDetail | null> {
      const raw = await storage.getItem(notebookDetailKey(userId, notebookId));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as NotebookDetail;
      } catch {
        return null;
      }
    },

    async setDetail(userId: string, detail: NotebookDetail): Promise<void> {
      const indexKey = notebookDetailIndexKey(userId);
      const ids = parseArray<string>(await storage.getItem(indexKey));
      await Promise.all([
        storage.setItem(
          notebookDetailKey(userId, detail.id),
          JSON.stringify(detail)
        ),
        storage.setItem(indexKey, JSON.stringify(Array.from(new Set([...ids, detail.id])))),
      ]);
    },

    async removeDetail(userId: string, notebookId: string): Promise<void> {
      const indexKey = notebookDetailIndexKey(userId);
      const ids = parseArray<string>(await storage.getItem(indexKey));
      await Promise.all([
        storage.removeItem(notebookDetailKey(userId, notebookId)),
        storage.setItem(
          indexKey,
          JSON.stringify(ids.filter((id) => id !== notebookId))
        ),
      ]);
    },

    async clearUser(userId: string): Promise<void> {
      const indexKey = notebookDetailIndexKey(userId);
      const ids = parseArray<string>(await storage.getItem(indexKey));
      await Promise.all([
        storage.removeItem(notebookListKey(userId)),
        storage.removeItem(indexKey),
        ...ids.map((id) =>
          storage.removeItem(notebookDetailKey(userId, id))
        ),
      ]);
    },
  };
}

export const notebookStorage = createNotebookStorage();

export async function clearNotebookCache(userId: string): Promise<void> {
  await notebookStorage.clearUser(userId);
}
