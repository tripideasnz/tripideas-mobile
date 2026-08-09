import * as ImagePicker from 'expo-image-picker';

import type { SelectedPhoto } from '@/photo-uploads/types';

export async function pickPhotoForUpload(): Promise<SelectedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: false,
    base64: false,
    exif: false,
    mediaTypes: ['images'],
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? null,
    fileSizeBytes: asset.fileSize ?? null,
  };
}

export async function pickPhotosForUpload(
  selectionLimit: number
): Promise<SelectedPhoto[]> {
  if (!Number.isInteger(selectionLimit) || selectionLimit < 1) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: true,
    base64: false,
    exif: false,
    mediaTypes: ['images'],
    orderedSelection: true,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    quality: 1,
    selectionLimit,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? null,
    fileSizeBytes: asset.fileSize ?? null,
  }));
}
