import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LocalPhotoUploadRecord } from '@/photo-uploads/types';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
const VERSION = 'v1';

export function photoUploadQueueKey(userId: string): string {
  return `tripideas.photoUploads.user.${userId}.${VERSION}`;
}

function parseRecords(raw: string | null, userId: string): LocalPhotoUploadRecord[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (record): record is LocalPhotoUploadRecord =>
        Boolean(record) &&
        typeof record === 'object' &&
        record.userId === userId &&
        typeof record.id === 'string' &&
        typeof record.clientRequestId === 'string' &&
        typeof record.localFileUri === 'string' &&
        typeof record.checksum === 'string' &&
        !('upload' in record) &&
        !('url' in record) &&
        !('accessToken' in record) &&
        !('refreshToken' in record)
    );
  } catch {
    return [];
  }
}

export function createPhotoUploadStorage(storage: Storage = AsyncStorage) {
  return {
    async list(userId: string): Promise<LocalPhotoUploadRecord[]> {
      return parseRecords(
        await storage.getItem(photoUploadQueueKey(userId)),
        userId
      );
    },

    async get(
      userId: string,
      uploadId: string
    ): Promise<LocalPhotoUploadRecord | null> {
      const records = await this.list(userId);
      return records.find((record) => record.id === uploadId) ?? null;
    },

    async set(record: LocalPhotoUploadRecord): Promise<void> {
      const records = await this.list(record.userId);
      const next = [
        ...records.filter((candidate) => candidate.id !== record.id),
        record,
      ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      await storage.setItem(
        photoUploadQueueKey(record.userId),
        JSON.stringify(next)
      );
    },
  };
}

export const photoUploadStorage = createPhotoUploadStorage();

