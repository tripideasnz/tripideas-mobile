import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  listNativePhotoUploads,
  prepareNativePhotoUpload,
  startNativePhotoUpload,
} from '@/photo-uploads/service';
import type { SelectedPhoto } from '@/photo-uploads/types';
import type { PersonalPlaceCard } from './types';
import { hasAttachedPhoto } from './model';
import {
  type PendingPersonalPlacePhoto,
  reconcilePendingPersonalPlacePhotos,
} from './photo-reconciliation';

export type { PendingPersonalPlacePhoto } from './photo-reconciliation';
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

async function reconcile(
  userId: string,
  card: PersonalPlaceCard
) {
  const [allPending, uploads] = await Promise.all([
    list(userId),
    listNativePhotoUploads(userId),
  ]);
  const cardPending = allPending.filter((item) => item.cardId === card.id);
  const result = reconcilePendingPersonalPlacePhotos(cardPending, uploads, card);
  const next = [
    ...allPending.filter((item) => item.cardId !== card.id),
    ...result.retained,
  ];
  if (
    next.length !== allPending.length ||
    next.some((item, index) => item.uploadId !== allPending[index]?.uploadId)
  ) await set(userId, next);
  return result;
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
  const authoritative = await read(cardId);
  const pending = (await reconcile(userId, authoritative)).retained;
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

export async function listPersonalPlaceCardPhotoPreviews(
  userId: string,
  card: PersonalPlaceCard
) {
  return (await reconcile(userId, card)).previews;
}

export async function retryPersonalPlaceCardPhoto(
  userId: string,
  cardId: string,
  uploadId: string,
  attach: Attach,
  read: Read,
  remove?: Remove
) {
  const authoritative = await read(cardId);
  const pending = (await reconcile(userId, authoritative)).retained.find(
    (item) => item.uploadId === uploadId
  );
  if (!pending) return null;
  const upload = (await listNativePhotoUploads(userId)).find(
    (item) => item.id === uploadId
  );
  if (upload?.state !== 'RETRYABLE_ERROR') return null;
  return finish(pending, attach, read, remove);
}

export async function retirePersonalPlaceCardPhotoIntent(
  userId: string,
  cardId: string,
  photoAssetId: string
) {
  const [pending, uploads] = await Promise.all([
    list(userId),
    listNativePhotoUploads(userId),
  ]);
  const matchingUploadIds = new Set(uploads
    .filter((upload) => upload.assetId === photoAssetId)
    .map((upload) => upload.id));
  if (matchingUploadIds.size === 0) return;
  await set(userId, pending.filter((item) =>
    item.cardId !== cardId || !matchingUploadIds.has(item.uploadId)
  ));
}
