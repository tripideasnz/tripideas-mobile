import { listNativePhotoUploads, prepareNativePhotoUpload, startNativePhotoUpload } from '@/photo-uploads/service';
import type { LocalPhotoUploadRecord, SelectedPhoto } from '@/photo-uploads/types';
import { diaryPhotoAttachmentStorage, type DiaryPhotoTarget, type PendingDiaryPhotoAttachment } from '@/diaries/photo-attachment-storage';
export type { DiaryPhotoTarget, PendingDiaryPhotoAttachment } from '@/diaries/photo-attachment-storage';
export type AttachDiaryPhoto = (pending: PendingDiaryPhotoAttachment, photoAssetId: string) => Promise<void>;

async function finish(pending: PendingDiaryPhotoAttachment, attach: AttachDiaryPhoto) {
  const uploaded = await startNativePhotoUpload(pending.userId, pending.uploadId);
  if (uploaded.state !== 'UPLOADED' || !uploaded.assetId) return false;
  await attach(pending, uploaded.assetId);
  await diaryPhotoAttachmentStorage.remove(pending.userId, pending.uploadId);
  return true;
}

export async function addDiaryPhotos(userId: string, target: DiaryPhotoTarget, selected: SelectedPhoto[], attach: AttachDiaryPhoto) {
  const pending: PendingDiaryPhotoAttachment[] = []; const errors: unknown[] = [];
  for (const photo of selected) { try { const upload = await prepareNativePhotoUpload(userId, photo); const item: PendingDiaryPhotoAttachment = { userId, uploadId: upload.id, clientRequestId: `diary-photo:${upload.clientRequestId}`, target, createdAt: new Date().toISOString() }; await diaryPhotoAttachmentStorage.set(item); pending.push(item); } catch (error) { errors.push(error); } }
  let completed = 0; let blocked = false;
  for (const item of pending) { try { if (blocked) { await startNativePhotoUpload(userId, item.uploadId); continue; } if (await finish(item, attach)) completed += 1; else blocked = true; } catch (error) { blocked = true; errors.push(error); } }
  return { completed, errors, pendingCount: pending.length - completed };
}

export async function resumeDiaryPhotos(userId: string, diaryId: string, kind: DiaryPhotoTarget['kind'], attach: AttachDiaryPhoto) {
  const pending = (await diaryPhotoAttachmentStorage.list(userId)).filter((item) => item.target.diaryId === diaryId && item.target.kind === kind); let completed = 0; let blocked = false;
  for (const item of pending) { try { if (blocked) { await startNativePhotoUpload(userId, item.uploadId); continue; } if (await finish(item, attach)) completed += 1; else blocked = true; } catch { blocked = true; } }
  return { completed, pendingCount: pending.length - completed };
}

export async function listDiaryPhotoPreviews(userId: string, diaryId: string): Promise<{ pending: PendingDiaryPhotoAttachment[]; uploads: LocalPhotoUploadRecord[] }> {
  const [pending, uploads] = await Promise.all([diaryPhotoAttachmentStorage.list(userId), listNativePhotoUploads(userId)]);
  return { pending: pending.filter((item) => item.target.diaryId === diaryId), uploads };
}
