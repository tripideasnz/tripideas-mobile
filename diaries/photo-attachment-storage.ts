import AsyncStorage from '@react-native-async-storage/async-storage';

export type DiaryPhotoTarget =
  | { kind: 'object'; diaryId: string; dayId: string; topicId: string }
  | { kind: 'cover'; diaryId: string };
export type PendingDiaryPhotoAttachment = {
  userId: string; uploadId: string; clientRequestId: string;
  target: DiaryPhotoTarget; createdAt: string;
};
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
const key = (userId: string) => `tripideas.diaryPhotoAttachments.user.${userId}.v1`;
const validTarget = (value: unknown): value is DiaryPhotoTarget => Boolean(value && typeof value === 'object' &&
  ((value as DiaryPhotoTarget).kind === 'cover' && typeof (value as { diaryId?: unknown }).diaryId === 'string' ||
   (value as DiaryPhotoTarget).kind === 'object' && typeof (value as { diaryId?: unknown }).diaryId === 'string' && typeof (value as { dayId?: unknown }).dayId === 'string' && typeof (value as { topicId?: unknown }).topicId === 'string'));

export function createDiaryPhotoAttachmentStorage(storage: Storage = AsyncStorage) {
  const list = async (userId: string): Promise<PendingDiaryPhotoAttachment[]> => { try { const value = JSON.parse((await storage.getItem(key(userId))) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is PendingDiaryPhotoAttachment => item?.userId === userId && typeof item.uploadId === 'string' && typeof item.clientRequestId === 'string' && typeof item.createdAt === 'string' && validTarget(item.target)) : []; } catch { return []; } };
  return {
    list,
    async set(item: PendingDiaryPhotoAttachment) { const items = await list(item.userId); await storage.setItem(key(item.userId), JSON.stringify([...items.filter((value) => value.uploadId !== item.uploadId), item])); },
    async remove(userId: string, uploadId: string) { const items = await list(userId); await storage.setItem(key(userId), JSON.stringify(items.filter((item) => item.uploadId !== uploadId))); },
  };
}
export const diaryPhotoAttachmentStorage = createDiaryPhotoAttachmentStorage();
