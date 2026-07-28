export const PHOTO_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export type SupportedPhotoContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/heic'
  | 'image/heif'
  | 'image/webp';

export type PhotoUploadStatus =
  | 'PENDING'
  | 'UPLOADED'
  | 'EXPIRED'
  | 'FAILED';

export type PhotoProcessingStatus =
  | 'WAITING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'DELETING';

export type PhotoAssetOwnerDto = {
  id: string;
  version: number;
  uploadStatus: PhotoUploadStatus;
  processingStatus: PhotoProcessingStatus;
  originalMimeType: string | null;
  processedMimeType: string | null;
  originalFileSizeBytes: string | null;
  processedFileSizeBytes: string | null;
  thumbnailFileSizeBytes: string | null;
  width: number | null;
  height: number | null;
  capturedAt: string | null;
  location: {
    latitude: number;
    longitude: number;
    source: 'PHOTO_METADATA' | 'USER_SELECTED';
    accuracyMeters: number | null;
    displayName: string | null;
  } | null;
  locationRemovedByUser: boolean;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string | null;
  processedAt: string | null;
  deletedAt: string | null;
  purgeAfter: string | null;
};

export type PhotoUploadIntentRequest = {
  clientRequestId: string;
  contentType: SupportedPhotoContentType;
  fileSizeBytes: number;
};

export type PhotoUploadAuthorization = {
  method: 'PUT';
  url: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
};

export type PhotoUploadIntentResponse = {
  asset: PhotoAssetOwnerDto;
  upload: PhotoUploadAuthorization | null;
};

export type PhotoUploadCompletionRequest = {
  checksum: string;
};

export type PhotoUploadCompletionResponse = {
  asset: PhotoAssetOwnerDto;
};

export type LocalPhotoUploadState =
  | 'SELECTED'
  | 'VALIDATED'
  | 'INTENT_CREATED'
  | 'UPLOADING'
  | 'PUT_COMPLETED'
  | 'COMPLETING'
  | 'UPLOADED'
  | 'RETRYABLE_ERROR'
  | 'PERMANENT_ERROR';

export type PhotoUploadErrorCode =
  | 'authentication_required'
  | 'owner_mismatch'
  | 'unsupported_content_type'
  | 'invalid_file_size'
  | 'local_file_unreadable'
  | 'local_file_missing'
  | 'local_file_changed'
  | 'network_unavailable'
  | 'request_timeout'
  | 'signed_url_expired'
  | 'put_rejected'
  | 'put_interrupted'
  | 'photo_upload_incomplete'
  | 'photo_upload_mismatch'
  | 'photo_upload_conflict'
  | 'remote_asset_inaccessible'
  | 'storage_unavailable'
  | 'temporary_api_failure'
  | 'retry_limit_reached'
  | 'unexpected_failure';

export type LocalPhotoUploadRecord = {
  id: string;
  userId: string;
  localFileUri: string;
  contentType: SupportedPhotoContentType;
  fileSizeBytes: number;
  checksum: string;
  clientRequestId: string;
  assetId: string | null;
  assetVersion: number | null;
  state: LocalPhotoUploadState;
  retryCount: number;
  lastErrorCode: PhotoUploadErrorCode | null;
  createdAt: string;
  updatedAt: string;
};

export type SelectedPhoto = {
  uri: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
};

export type LocalPhotoMetadata = {
  exists: boolean;
  size: number;
  mimeType: string;
};

