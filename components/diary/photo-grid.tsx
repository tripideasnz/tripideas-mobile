import { PlacePhotoGrid } from '@/components/place-photo-grid';
import { useOrderedDiaryPhotoImages } from '@/components/diary/photo-assets';
import { Space } from '@/constants/design';

export function DiaryPhotoGrid({
  assetIds,
  bottomMargin,
  label,
  onRemoveAsset,
}: {
  assetIds: string[];
  bottomMargin?: number;
  label: string;
  onRemoveAsset?: (assetId: string) => void;
}) {
  const { images, refresh } = useOrderedDiaryPhotoImages(assetIds, label);
  return <PlacePhotoGrid
    bottomMargin={bottomMargin}
    horizontalInset={Space.md}
    images={images}
    onImageError={refresh}
    onRemoveImage={onRemoveAsset ? (image) => image._key && onRemoveAsset(image._key) : undefined}
    placeTitle={label}
  />;
}
