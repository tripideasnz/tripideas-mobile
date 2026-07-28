import * as Crypto from 'expo-crypto';
import { fetch as expoFetch } from 'expo/fetch';
import { Directory, File, Paths } from 'expo-file-system';

import {
  completePhotoUpload,
  createPhotoUploadIntent,
} from '@/photo-uploads/api';
import type { PhotoUploadEngineDependencies } from '@/photo-uploads/engine';
import { photoUploadStorage } from '@/photo-uploads/storage';
import type {
  LocalPhotoMetadata,
  PhotoUploadAuthorization,
  SupportedPhotoContentType,
} from '@/photo-uploads/types';

const suffixes: Record<SupportedPhotoContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
};

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function inspectNativePhotoFile(
  uri: string
): Promise<LocalPhotoMetadata> {
  const file = new File(uri);
  return {
    exists: file.exists,
    size: file.size,
    mimeType: file.type,
  };
}

export async function checksumNativePhotoFile(uri: string): Promise<string> {
  const bytes = await new File(uri).bytes();
  return bytesToHex(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes)
  );
}

export async function copyPhotoToManagedFile(
  userId: string,
  uploadId: string,
  sourceUri: string,
  contentType: SupportedPhotoContentType
): Promise<string> {
  const directory = new Directory(
    Paths.document,
    'photo-uploads',
    encodeURIComponent(userId)
  );
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(
    directory,
    `${uploadId}.${suffixes[contentType]}`
  );
  new File(sourceUri).copy(destination);
  return destination.uri;
}

export async function putNativePhotoFile(
  authorization: PhotoUploadAuthorization,
  localFileUri: string,
  signal: AbortSignal
): Promise<{ status: number }> {
  const response = await expoFetch(authorization.url, {
    body: new File(localFileUri),
    headers: authorization.requiredHeaders,
    method: authorization.method,
    signal,
  });
  return { status: response.status };
}

export const nativePhotoUploadDependencies: PhotoUploadEngineDependencies = {
  createId: () => Crypto.randomUUID(),
  now: () => new Date().toISOString(),
  inspectFile: inspectNativePhotoFile,
  copyToManagedFile: copyPhotoToManagedFile,
  checksumFile: checksumNativePhotoFile,
  createIntent: createPhotoUploadIntent,
  complete: completePhotoUpload,
  putFile: putNativePhotoFile,
  getRecord: (userId, uploadId) => photoUploadStorage.get(userId, uploadId),
  saveRecord: (record) => photoUploadStorage.set(record),
};

