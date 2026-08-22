import type { LocalPhotoUploadRecord } from '@/photo-uploads/types';
import type { PendingNotebookPhotoBlock } from './storage';

export function notebookPhotoPreviewUris(
  pending: PendingNotebookPhotoBlock[],
  uploads: LocalPhotoUploadRecord[],
  notebookId: string
): Record<string, string[]> {
  const uploadsById = new Map(uploads.map((upload) => [upload.id, upload]));
  const previews: Record<string, string[]> = {};
  for (const item of pending) {
    if (item.notebookId !== notebookId) continue;
    const uri = uploadsById.get(item.uploadId)?.localFileUri;
    if (!uri) continue;
    previews[item.pageId] = [...(previews[item.pageId] ?? []), uri];
  }
  return previews;
}
