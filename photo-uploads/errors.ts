import type { PhotoUploadErrorCode } from '@/photo-uploads/types';

export class PhotoUploadError extends Error {
  constructor(
    public readonly code: PhotoUploadErrorCode,
    public readonly retryable: boolean,
    message = 'The photo upload could not be completed.'
  ) {
    super(message);
    this.name = 'PhotoUploadError';
  }
}

export function safePhotoUploadMessage(code: PhotoUploadErrorCode): string {
  switch (code) {
    case 'unsupported_content_type':
      return 'Choose a JPEG, PNG, HEIC, HEIF, or WebP image.';
    case 'invalid_file_size':
      return 'Choose an image between 1 byte and 25 MiB.';
    case 'local_file_missing':
    case 'local_file_unreadable':
      return 'The selected photo is no longer available.';
    case 'local_file_changed':
      return 'The selected photo changed and must be selected again.';
    case 'authentication_required':
    case 'owner_mismatch':
      return 'Sign in with the account that started this upload.';
    case 'photo_upload_mismatch':
    case 'photo_upload_conflict':
      return 'This upload cannot continue. Select the photo again.';
    default:
      return 'The upload was interrupted. Try again.';
  }
}

