import { authenticatedApiFetch } from '@/lib/api-client';
import type {
  PhotoUploadCompletionRequest,
  PhotoUploadCompletionResponse,
  PhotoUploadIntentRequest,
  PhotoUploadIntentResponse,
} from '@/photo-uploads/types';

export async function createPhotoUploadIntent(
  request: PhotoUploadIntentRequest,
  signal?: AbortSignal
): Promise<PhotoUploadIntentResponse> {
  return authenticatedApiFetch('/photo-assets/upload-intents', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export async function completePhotoUpload(
  assetId: string,
  request: PhotoUploadCompletionRequest,
  signal?: AbortSignal
): Promise<PhotoUploadCompletionResponse> {
  return authenticatedApiFetch(
    `/photo-assets/${encodeURIComponent(assetId)}/upload-completion`,
    {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    }
  );
}
