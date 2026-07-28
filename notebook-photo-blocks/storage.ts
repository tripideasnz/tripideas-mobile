import AsyncStorage from '@react-native-async-storage/async-storage';

export type PendingNotebookPhotoBlock = {
  userId: string;
  notebookId: string;
  pageId: string;
  uploadId: string;
  blockClientRequestId: string;
  createdAt: string;
};

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
const VERSION = 'v1';

const key = (userId: string) =>
  `tripideas.notebookPhotoBlocks.user.${userId}.${VERSION}`;

export function createNotebookPhotoBlockStorage(
  storage: Storage = AsyncStorage
) {
  const list = async (userId: string): Promise<PendingNotebookPhotoBlock[]> => {
    try {
      const parsed = JSON.parse((await storage.getItem(key(userId))) ?? '[]');
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is PendingNotebookPhotoBlock =>
              item?.userId === userId &&
              typeof item.notebookId === 'string' &&
              typeof item.pageId === 'string' &&
              typeof item.uploadId === 'string' &&
              typeof item.blockClientRequestId === 'string'
          )
        : [];
    } catch {
      return [];
    }
  };
  return {
    list,
    async set(record: PendingNotebookPhotoBlock): Promise<void> {
      const records = await list(record.userId);
      await storage.setItem(
        key(record.userId),
        JSON.stringify([
          ...records.filter((item) => item.uploadId !== record.uploadId),
          record,
        ])
      );
    },
    async remove(userId: string, uploadId: string): Promise<void> {
      const records = await list(userId);
      await storage.setItem(
        key(userId),
        JSON.stringify(records.filter((item) => item.uploadId !== uploadId))
      );
    },
  };
}

export const notebookPhotoBlockStorage =
  createNotebookPhotoBlockStorage();
