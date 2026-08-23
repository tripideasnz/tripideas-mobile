import { prepareNativePhotoUpload, startNativePhotoUpload } from '@/photo-uploads/service';
import type { SelectedPhoto } from '@/photo-uploads/types';

export async function uploadDiaryPhotos(
  userId: string,
  selected: SelectedPhoto[]
): Promise<{ assetIds: string[]; errors: unknown[] }> {
  const assetIds: string[] = [];
  const errors: unknown[] = [];
  for (const photo of selected) {
    try {
      const prepared = await prepareNativePhotoUpload(userId, photo);
      const uploaded = await startNativePhotoUpload(userId, prepared.id);
      if (!uploaded.assetId) throw new Error('Diary photo upload did not produce a PhotoAsset.');
      assetIds.push(uploaded.assetId);
    } catch (error) { errors.push(error); }
  }
  return { assetIds, errors };
}
