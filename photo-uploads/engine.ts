import { ApiError } from '@/lib/api-client';
import { PhotoUploadError } from '@/photo-uploads/errors';
import {
  failPhotoUpload,
  transitionPhotoUpload,
} from '@/photo-uploads/state-machine';
import type {
  LocalPhotoMetadata,
  LocalPhotoUploadRecord,
  PhotoUploadAuthorization,
  PhotoUploadCompletionRequest,
  PhotoUploadCompletionResponse,
  PhotoUploadErrorCode,
  PhotoUploadIntentRequest,
  PhotoUploadIntentResponse,
  SelectedPhoto,
  SupportedPhotoContentType,
} from '@/photo-uploads/types';
import { validatePhotoMetadata } from '@/photo-uploads/validation';

export const PHOTO_UPLOAD_MAX_RETRIES = 5;

export type PhotoUploadEngineDependencies = {
  createId: () => string;
  now: () => string;
  inspectFile: (uri: string) => Promise<LocalPhotoMetadata>;
  copyToManagedFile: (
    userId: string,
    uploadId: string,
    sourceUri: string,
    contentType: SupportedPhotoContentType
  ) => Promise<string>;
  checksumFile: (uri: string) => Promise<string>;
  createIntent: (
    request: PhotoUploadIntentRequest,
    signal: AbortSignal
  ) => Promise<PhotoUploadIntentResponse>;
  complete: (
    assetId: string,
    request: PhotoUploadCompletionRequest,
    signal: AbortSignal
  ) => Promise<PhotoUploadCompletionResponse>;
  putFile: (
    authorization: PhotoUploadAuthorization,
    localFileUri: string,
    signal: AbortSignal
  ) => Promise<{ status: number }>;
  getRecord: (
    userId: string,
    uploadId: string
  ) => Promise<LocalPhotoUploadRecord | null>;
  saveRecord: (record: LocalPhotoUploadRecord) => Promise<void>;
};

function safeError(error: unknown): PhotoUploadError {
  if (error instanceof PhotoUploadError) return error;
  if (error instanceof ApiError) {
    const retryable = error.status === 408 || error.status === 429 || error.status >= 500;
    const mappings: Record<string, [PhotoUploadErrorCode, boolean]> = {
      mobile_session_required: ['authentication_required', false],
      not_found: ['remote_asset_inaccessible', false],
      photo_upload_conflict: ['photo_upload_conflict', false],
      photo_upload_incomplete: ['photo_upload_incomplete', true],
      photo_upload_mismatch: ['photo_upload_mismatch', false],
      storage_unavailable: ['storage_unavailable', true],
    };
    const mapped = mappings[error.code];
    if (mapped) return new PhotoUploadError(mapped[0], mapped[1]);
    return new PhotoUploadError(
      retryable ? 'temporary_api_failure' : 'unexpected_failure',
      retryable
    );
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new PhotoUploadError('put_interrupted', true);
  }
  return new PhotoUploadError('network_unavailable', true);
}

async function persist(
  dependencies: PhotoUploadEngineDependencies,
  record: LocalPhotoUploadRecord
): Promise<LocalPhotoUploadRecord> {
  await dependencies.saveRecord(record);
  return record;
}

async function verifyIntegrity(
  dependencies: PhotoUploadEngineDependencies,
  record: LocalPhotoUploadRecord
): Promise<void> {
  let metadata: LocalPhotoMetadata;
  try {
    metadata = await dependencies.inspectFile(record.localFileUri);
  } catch {
    throw new PhotoUploadError('local_file_unreadable', false);
  }
  if (!metadata.exists) throw new PhotoUploadError('local_file_missing', false);
  const contentType = validatePhotoMetadata(metadata, record.contentType);
  if (
    contentType.fileSizeBytes !== record.fileSizeBytes ||
    contentType.contentType !== record.contentType
  ) {
    throw new PhotoUploadError('local_file_changed', false);
  }
  const checksum = await dependencies.checksumFile(record.localFileUri);
  if (checksum !== record.checksum) {
    throw new PhotoUploadError('local_file_changed', false);
  }
}

export async function preparePhotoUpload(
  dependencies: PhotoUploadEngineDependencies,
  userId: string,
  selected: SelectedPhoto
): Promise<LocalPhotoUploadRecord> {
  if (!userId.trim()) {
    throw new PhotoUploadError('authentication_required', false);
  }
  const id = dependencies.createId();
  const createdAt = dependencies.now();

  let sourceMetadata: LocalPhotoMetadata;
  try {
    sourceMetadata = await dependencies.inspectFile(selected.uri);
  } catch {
    throw new PhotoUploadError('local_file_unreadable', false);
  }
  const validated = validatePhotoMetadata(sourceMetadata, selected.mimeType);
  const localFileUri = await dependencies.copyToManagedFile(
    userId,
    id,
    selected.uri,
    validated.contentType
  );
  const managedMetadata = await dependencies.inspectFile(localFileUri);
  const managed = validatePhotoMetadata(managedMetadata, validated.contentType);
  if (managed.fileSizeBytes !== validated.fileSizeBytes) {
    throw new PhotoUploadError('local_file_changed', false);
  }
  const checksum = await dependencies.checksumFile(localFileUri);
  const selectedRecord: LocalPhotoUploadRecord = {
    id,
    userId,
    localFileUri,
    contentType: managed.contentType,
    fileSizeBytes: managed.fileSizeBytes,
    checksum,
    clientRequestId: id,
    assetId: null,
    assetVersion: null,
    state: 'SELECTED',
    retryCount: 0,
    lastErrorCode: null,
    createdAt,
    updatedAt: createdAt,
  };
  return persist(
    dependencies,
    transitionPhotoUpload(selectedRecord, 'VALIDATED', dependencies.now())
  );
}

async function saveFailure(
  dependencies: PhotoUploadEngineDependencies,
  record: LocalPhotoUploadRecord,
  error: unknown
): Promise<LocalPhotoUploadRecord> {
  const classified = safeError(error);
  return persist(
    dependencies,
    failPhotoUpload(
      record,
      classified.code,
      classified.retryable,
      dependencies.now(),
      PHOTO_UPLOAD_MAX_RETRIES
    )
  );
}

function shouldCompleteWithoutPut(record: LocalPhotoUploadRecord): boolean {
  return (
    record.state === 'PUT_COMPLETED' ||
    record.state === 'COMPLETING'
  );
}

export async function runPhotoUpload(
  dependencies: PhotoUploadEngineDependencies,
  userId: string,
  uploadId: string,
  signal: AbortSignal
): Promise<LocalPhotoUploadRecord> {
  let record = await dependencies.getRecord(userId, uploadId);
  if (!record) throw new PhotoUploadError('local_file_missing', false);
  if (record.userId !== userId) {
    throw new PhotoUploadError('owner_mismatch', false);
  }
  if (record.state === 'UPLOADED' || record.state === 'PERMANENT_ERROR') {
    return record;
  }

  try {
    await verifyIntegrity(dependencies, record);

    if (!shouldCompleteWithoutPut(record)) {
      const intent = await dependencies.createIntent({
        clientRequestId: record.clientRequestId,
        contentType: record.contentType,
        fileSizeBytes: record.fileSizeBytes,
      }, signal);
      record = await persist(
        dependencies,
        transitionPhotoUpload(record, 'INTENT_CREATED', dependencies.now(), {
          assetId: intent.asset.id,
          assetVersion: intent.asset.version,
          lastErrorCode: null,
        })
      );

      if (intent.upload === null) {
        if (intent.asset.uploadStatus !== 'UPLOADED') {
          throw new PhotoUploadError('photo_upload_conflict', false);
        }
        return persist(
          dependencies,
          transitionPhotoUpload(record, 'UPLOADED', dependencies.now(), {
            assetVersion: intent.asset.version,
            lastErrorCode: null,
          })
        );
      }
      if (Date.parse(intent.upload.expiresAt) <= Date.now()) {
        throw new PhotoUploadError('signed_url_expired', true);
      }

      record = await persist(
        dependencies,
        transitionPhotoUpload(record, 'UPLOADING', dependencies.now())
      );
      const put = await dependencies.putFile(
        intent.upload,
        record.localFileUri,
        signal
      );
      if (put.status === 401 || put.status === 403) {
        throw new PhotoUploadError('signed_url_expired', true);
      }
      if (put.status < 200 || put.status >= 300) {
        throw new PhotoUploadError(
          'put_rejected',
          put.status === 408 || put.status === 429 || put.status >= 500
        );
      }
      record = await persist(
        dependencies,
        transitionPhotoUpload(record, 'PUT_COMPLETED', dependencies.now())
      );
    }

    if (!record.assetId) {
      throw new PhotoUploadError('photo_upload_conflict', false);
    }
    const assetId = record.assetId;
    record = await persist(
      dependencies,
      transitionPhotoUpload(record, 'COMPLETING', dependencies.now())
    );
    const completed = await dependencies.complete(assetId, {
      checksum: record.checksum,
    }, signal);
    if (completed.asset.uploadStatus !== 'UPLOADED') {
      throw new PhotoUploadError('photo_upload_incomplete', true);
    }
    return persist(
      dependencies,
      transitionPhotoUpload(record, 'UPLOADED', dependencies.now(), {
        assetVersion: completed.asset.version,
        lastErrorCode: null,
      })
    );
  } catch (error) {
    return saveFailure(dependencies, record, error);
  }
}
