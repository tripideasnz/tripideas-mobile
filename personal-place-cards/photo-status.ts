export function failedPhotoUploadMessage(failedCount: number): string | null {
  if (failedCount < 1) return null;
  return `${failedCount} ${failedCount === 1 ? 'photo' : 'photos'} failed to upload`;
}
