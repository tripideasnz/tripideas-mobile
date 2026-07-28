import { PhotoUploadError } from '@/photo-uploads/errors';
import {
  PHOTO_UPLOAD_MAX_BYTES,
  type LocalPhotoMetadata,
  type SupportedPhotoContentType,
} from '@/photo-uploads/types';

const SUPPORTED_TYPES = new Set<SupportedPhotoContentType>([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]);

const MIME_ALIASES: Record<string, SupportedPhotoContentType> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-heic': 'image/heic',
  'image/x-heif': 'image/heif',
};

export function normalizePhotoContentType(
  value: string | null | undefined
): SupportedPhotoContentType | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized in MIME_ALIASES) return MIME_ALIASES[normalized];
  return SUPPORTED_TYPES.has(normalized as SupportedPhotoContentType)
    ? (normalized as SupportedPhotoContentType)
    : null;
}

export function validatePhotoMetadata(
  metadata: LocalPhotoMetadata,
  pickerMimeType?: string | null
): {
  contentType: SupportedPhotoContentType;
  fileSizeBytes: number;
} {
  if (!metadata.exists) {
    throw new PhotoUploadError('local_file_missing', false);
  }
  if (!Number.isSafeInteger(metadata.size) || metadata.size < 1) {
    throw new PhotoUploadError('invalid_file_size', false);
  }
  if (metadata.size > PHOTO_UPLOAD_MAX_BYTES) {
    throw new PhotoUploadError('invalid_file_size', false);
  }

  const contentType =
    normalizePhotoContentType(metadata.mimeType) ??
    normalizePhotoContentType(pickerMimeType);
  if (!contentType) {
    throw new PhotoUploadError('unsupported_content_type', false);
  }

  return { contentType, fileSizeBytes: metadata.size };
}

