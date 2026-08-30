import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  listNativePhotoUploads,
  prepareNativePhotoUpload,
  startNativePhotoUpload,
} from '@/photo-uploads/service';
import type { SelectedPhoto } from '@/photo-uploads/types';
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
const key = (userId: string) =>
  `tripideas.personalPlaceCardPhotos.user.${userId}.v1`;

async function list(userId: string): Promise<PendingPersonalPlacePhoto[]> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
async function set(userId: string, values: PendingPersonalPlacePhoto[]) {
  await AsyncStorage.setItem(key(userId), JSON.stringify(values));
}

type Attach = (
  id: string,
  photoAssetId: string,
  role: 'main' | 'body'
) => Promise<PersonalPlaceCard>;
type Read = (id: string) => Promise<PersonalPlaceCard>;
type Remove = (id: string, mediaId: string) => Promise<PersonalPlaceCard>;

async function finish(
  pending: PendingPersonalPlacePhoto,
  attach: Attach,
  read: Read,
  remove?: Remove
) {
  const uploaded = await startNativePhotoUpload(pending.userId, pending.uploadId);
  if (uploaded.state !== 'UPLOADED' || !uploaded.assetId) return null;
  const authoritative = await read(pending.cardId);
  if (hasAttachedPhoto(authoritative, uploaded.assetId)) {
    await set(
      pending.userId,
      (await list(pending.userId)).filter((item) => item.uploadId !== pending.uploadId)
    );
    return authoritative;
  }
  if (
    pending.replaceMediaId &&
    authoritative.media.some((item) => item.id === pending.replaceMediaId)
  ) {
    if (!remove) throw new Error('Photo replacement requires media removal.');
    await remove(pending.cardId, pending.replaceMediaId);
  }
  let card: PersonalPlaceCard;
  try {
    card = await attach(pending.cardId, uploaded.assetId, pending.role);
  } catch (error) {
    const authoritative = await read(pending.cardId);
    if (!hasAttachedPhoto(authoritative, uploaded.assetId)) {
      throw error;
    }
    card = authoritative;
  }
  await set(
    pending.userId,
    (await list(pending.userId)).filter((item) => item.uploadId !== pending.uploadId)
  );
  return card;
}

export async function addPersonalPlaceCardPhoto(
  userId: string,
  cardId: string,
  role: 'main' | 'body',
  selected: SelectedPhoto,
  attach: Attach,
  read: Read
) {
  const upload = await prepareNativePhotoUpload(userId, selected);
  const pending: PendingPersonalPlacePhoto = {
    cardId,
    createdAt: new Date().toISOString(),
    role,
    uploadId: upload.id,
    userId,
  };
  await set(userId, [...await list(userId), pending]);
  return finish(pending, attach, read);
}

export async function replacePersonalPlaceCardPhoto(
  userId: string,
  cardId: string,
  mediaId: string,
  role: 'main' | 'body',
  selected: SelectedPhoto,
  attach: Attach,
  read: Read,
  remove: Remove
) {
  const upload = await prepareNativePhotoUpload(userId, selected);
  const pending: PendingPersonalPlacePhoto = {
    cardId,
    createdAt: new Date().toISOString(),
    replaceMediaId: mediaId,
    role,
    uploadId: upload.id,
    userId,
  };
  await set(userId, [...await list(userId), pending]);
  return finish(pending, attach, read, remove);
}

export async function resumePersonalPlaceCardPhotos(
  userId: string,
  cardId: string,
  attach: Attach,
  read: Read,
  remove?: Remove
) {
  const pending = (await list(userId)).filter((item) => item.cardId === cardId);
  let completed = 0;
  for (const item of pending) {
    try {
      if (await finish(item, attach, read, remove)) completed += 1;
    } catch {
      // Keep the isolated pending context for explicit retry or restart recovery.
    }
  }
  return { completed, pendingCount: pending.length - completed };
}

export async function listPersonalPlaceCardPhotoPreviews(userId: string, cardId: string) {
  const [pending, uploads] = await Promise.all([list(userId), listNativePhotoUploads(userId)]);
  const byId = new Map(uploads.map((upload) => [upload.id, upload]));
  return pending.filter((item) => item.cardId === cardId).map((item) => {
    const upload = byId.get(item.uploadId);
    return { ...item, uri: upload?.localFileUri ?? null, state: upload?.state ?? 'PERMANENT_ERROR' };
  });
}
