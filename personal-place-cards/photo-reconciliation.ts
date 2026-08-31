import type { LocalPhotoUploadRecord } from '@/photo-uploads/types';
import type { PersonalPlaceCard } from './types';
import { hasAttachedPhoto } from './model';

export type PendingPersonalPlacePhoto = {
  cardId: string;
  createdAt: string;
  replaceMediaId?: string;
  role: 'main' | 'body';
  uploadId: string;
  userId: string;
};

export function personalPlaceBodyPhotoCount(
  attachedCount: number,
  unresolvedBodyCount: number
) {
  return attachedCount + unresolvedBodyCount;
}

export function reconcilePendingPersonalPlacePhotos(
  pending: PendingPersonalPlacePhoto[],
  uploads: LocalPhotoUploadRecord[],
  card: PersonalPlaceCard
) {
  const uploadsById = new Map(uploads.map((upload) => [upload.id, upload]));
  const retained: PendingPersonalPlacePhoto[] = [];
  const previews: Array<PendingPersonalPlacePhoto & {
    state: LocalPhotoUploadRecord['state'];
    uri: string;
  }> = [];
  const seen = new Set<string>();

  for (const item of pending) {
    if (item.cardId !== card.id || seen.has(item.uploadId)) continue;
    seen.add(item.uploadId);
    const upload = uploadsById.get(item.uploadId);
    if (!upload || upload.userId !== item.userId) continue;
    if (upload.assetId && hasAttachedPhoto(card, upload.assetId)) continue;
    if (
      item.replaceMediaId &&
      !card.media.some((media) => media.id === item.replaceMediaId)
    ) continue;
    if (upload.state === 'PERMANENT_ERROR') continue;
    if (upload.state === 'UPLOADED' && !upload.assetId) continue;
    retained.push(item);
    previews.push({ ...item, state: upload.state, uri: upload.localFileUri });
  }

  return { previews, retained };
}
