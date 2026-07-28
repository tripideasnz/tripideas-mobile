import type { NotebookDetail } from '@/notebooks/types';
import {
  listNativePhotoUploads,
  prepareNativePhotoUpload,
  startNativePhotoUpload,
} from '@/photo-uploads/service';
import type { SelectedPhoto } from '@/photo-uploads/types';
import {
  notebookPhotoBlockStorage,
  type PendingNotebookPhotoBlock,
} from './storage';
import { notebookPhotoPreviewUris } from './previews';

type AddBlock = (input: {
  id: string;
  pageId: string;
  photoAssetId: string;
  clientRequestId: string;
}) => Promise<NotebookDetail>;

const finish = async (
  pending: PendingNotebookPhotoBlock,
  addBlock: AddBlock
): Promise<NotebookDetail | null> => {
  const uploaded = await startNativePhotoUpload(
    pending.userId,
    pending.uploadId
  );
  if (uploaded.state !== 'UPLOADED' || !uploaded.assetId) return null;
  const detail = await addBlock({
    id: pending.notebookId,
    pageId: pending.pageId,
    photoAssetId: uploaded.assetId,
    clientRequestId: pending.blockClientRequestId,
  });
  await notebookPhotoBlockStorage.remove(
    pending.userId,
    pending.uploadId
  );
  return detail;
};

export async function addNotebookPhoto(
  userId: string,
  notebookId: string,
  pageId: string,
  selected: SelectedPhoto,
  addBlock: AddBlock
): Promise<NotebookDetail | null> {
  const upload = await prepareNativePhotoUpload(userId, selected);
  const pending: PendingNotebookPhotoBlock = {
    userId,
    notebookId,
    pageId,
    uploadId: upload.id,
    blockClientRequestId: `photo-block:${upload.clientRequestId}`,
    createdAt: new Date().toISOString(),
  };
  await notebookPhotoBlockStorage.set(pending);
  return finish(pending, addBlock);
}

export async function resumeNotebookPhotos(
  userId: string,
  notebookId: string,
  addBlock: AddBlock
): Promise<{ completed: NotebookDetail[]; pendingCount: number }> {
  const pending = (await notebookPhotoBlockStorage.list(userId)).filter(
    (item) => item.notebookId === notebookId
  );
  const completed: NotebookDetail[] = [];
  for (const item of pending) {
    try {
      const detail = await finish(item, addBlock);
      if (detail) completed.push(detail);
    } catch {
      // The pending record is retained for an explicit or restart retry.
    }
  }
  return {
    completed,
    pendingCount: Math.max(0, pending.length - completed.length),
  };
}

export async function listNotebookPhotoPreviews(
  userId: string,
  notebookId: string
): Promise<Record<string, string>> {
  const [pending, uploads] = await Promise.all([
    notebookPhotoBlockStorage.list(userId),
    listNativePhotoUploads(userId),
  ]);
  return notebookPhotoPreviewUris(pending, uploads, notebookId);
}
