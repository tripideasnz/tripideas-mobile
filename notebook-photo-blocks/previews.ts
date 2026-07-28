import type { LocalPhotoUploadRecord } from '@/photo-uploads/types';
import type { PendingNotebookPhotoBlock } from './storage';

export function notebookPhotoPreviewUris(
  pending: PendingNotebookPhotoBlock[],
  uploads: LocalPhotoUploadRecord[],
  notebookId: string
): Record<string, string> {
  const uploadsById = new Map(uploads.map((upload) => [upload.id, upload]));
  return Object.fromEntries(
    pending
      .filter((item) => item.notebookId === notebookId)
      .flatMap((item) => {
        const upload = uploadsById.get(item.uploadId);
        return upload?.localFileUri
          ? [[item.pageId, upload.localFileUri] as const]
          : [];
      })
  );
}
