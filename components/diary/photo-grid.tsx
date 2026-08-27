import { PlacePhotoGrid } from '@/components/place-photo-grid';
import { useOrderedDiaryPhotoImages } from '@/components/diary/photo-assets';

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
    images={images}
    onImageError={refresh}
    onRemoveImage={onRemoveAsset ? (image) => image._key && onRemoveAsset(image._key) : undefined}
    placeTitle={label}
  />;
}
