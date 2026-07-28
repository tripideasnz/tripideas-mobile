import {
  preparePhotoUpload,
  runPhotoUpload,
} from '@/photo-uploads/engine';
import { nativePhotoUploadDependencies } from '@/photo-uploads/native';
import { photoUploadStorage } from '@/photo-uploads/storage';
import type {
  LocalPhotoUploadRecord,
  SelectedPhoto,
} from '@/photo-uploads/types';

const activeByUser = new Map<string, Set<AbortController>>();

function track(userId: string, controller: AbortController): () => void {
  const active = activeByUser.get(userId) ?? new Set<AbortController>();
  active.add(controller);
  activeByUser.set(userId, active);
  return () => {
    active.delete(controller);
    if (active.size === 0) activeByUser.delete(userId);
  };
}

export function cancelPhotoUploadsForUser(userId: string): void {
  const active = activeByUser.get(userId);
  if (!active) return;
  for (const controller of active) controller.abort();
  activeByUser.delete(userId);
}

export async function prepareNativePhotoUpload(
  userId: string,
  selected: SelectedPhoto
): Promise<LocalPhotoUploadRecord> {
  return preparePhotoUpload(nativePhotoUploadDependencies, userId, selected);
}

export async function startNativePhotoUpload(
  userId: string,
  uploadId: string,
  options: { interruptPutOnce?: boolean } = {}
): Promise<LocalPhotoUploadRecord> {
  const controller = new AbortController();
  const stopTracking = track(userId, controller);
  let shouldInterruptPut = options.interruptPutOnce === true;
  const dependencies = shouldInterruptPut
    ? {
        ...nativePhotoUploadDependencies,
        putFile: async (...args: Parameters<typeof nativePhotoUploadDependencies.putFile>) => {
          if (shouldInterruptPut) {
            shouldInterruptPut = false;
            controller.abort();
          }
          return nativePhotoUploadDependencies.putFile(...args);
        },
      }
    : nativePhotoUploadDependencies;
  try {
    return await runPhotoUpload(
      dependencies,
      userId,
      uploadId,
      controller.signal
    );
  } finally {
    stopTracking();
  }
}

export function listNativePhotoUploads(
  userId: string
): Promise<LocalPhotoUploadRecord[]> {
  return photoUploadStorage.list(userId);
}
