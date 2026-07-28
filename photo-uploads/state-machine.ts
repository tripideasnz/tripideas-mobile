import { PhotoUploadError } from '@/photo-uploads/errors';
import type {
  LocalPhotoUploadRecord,
  LocalPhotoUploadState,
  PhotoUploadErrorCode,
} from '@/photo-uploads/types';

const ALLOWED_TRANSITIONS: Record<LocalPhotoUploadState, LocalPhotoUploadState[]> = {
  SELECTED: ['VALIDATED', 'PERMANENT_ERROR'],
  VALIDATED: ['INTENT_CREATED', 'UPLOADED', 'RETRYABLE_ERROR', 'PERMANENT_ERROR'],
  INTENT_CREATED: ['UPLOADING', 'UPLOADED', 'RETRYABLE_ERROR', 'PERMANENT_ERROR'],
  UPLOADING: ['PUT_COMPLETED', 'RETRYABLE_ERROR', 'PERMANENT_ERROR'],
  PUT_COMPLETED: ['COMPLETING', 'RETRYABLE_ERROR', 'PERMANENT_ERROR'],
  COMPLETING: ['UPLOADED', 'RETRYABLE_ERROR', 'PERMANENT_ERROR'],
  UPLOADED: [],
  RETRYABLE_ERROR: [
    'INTENT_CREATED',
    'UPLOADING',
    'PUT_COMPLETED',
    'COMPLETING',
    'UPLOADED',
    'RETRYABLE_ERROR',
    'PERMANENT_ERROR',
  ],
  PERMANENT_ERROR: [],
};

export function transitionPhotoUpload(
  record: LocalPhotoUploadRecord,
  state: LocalPhotoUploadState,
  updatedAt: string,
  fields: Partial<
    Pick<
      LocalPhotoUploadRecord,
      'assetId' | 'assetVersion' | 'retryCount' | 'lastErrorCode'
    >
  > = {}
): LocalPhotoUploadRecord {
  if (
    state !== record.state &&
    !ALLOWED_TRANSITIONS[record.state].includes(state)
  ) {
    throw new PhotoUploadError('unexpected_failure', false);
  }
  return { ...record, ...fields, state, updatedAt };
}

export function failPhotoUpload(
  record: LocalPhotoUploadRecord,
  code: PhotoUploadErrorCode,
  retryable: boolean,
  updatedAt: string,
  maxRetries: number
): LocalPhotoUploadRecord {
  const retryCount = record.retryCount + 1;
  if (retryable && retryCount <= maxRetries) {
    return transitionPhotoUpload(record, 'RETRYABLE_ERROR', updatedAt, {
      retryCount,
      lastErrorCode: code,
    });
  }
  return transitionPhotoUpload(record, 'PERMANENT_ERROR', updatedAt, {
    retryCount,
    lastErrorCode: retryable ? 'retry_limit_reached' : code,
  });
}
