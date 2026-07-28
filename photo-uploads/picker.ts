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
