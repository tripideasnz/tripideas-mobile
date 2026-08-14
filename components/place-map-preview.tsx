import { Camera, Map as MapLibreMap, Marker } from '@maplibre/maplibre-react-native';
import { Pressable } from 'react-native';

import { MAP_STYLE_URL } from '@/constants/map';
import { Radius, Shadow } from '@/constants/design';
import { MapPin } from '@/components/map/map-pin';

type PlaceMapPreviewProps = {
  latitude: number;
  longitude: number;
  onPress?: () => void;
  title?: string;
};

export function PlaceMapPreview({
  latitude,
  longitude,
  onPress,
}: PlaceMapPreviewProps) {
  return (
    <Pressable
      accessibilityLabel="Open this place on the TripIdeas.nz map"
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={{
        ...Shadow.card,
        borderRadius: Radius.card,
        height: 220,
        overflow: 'hidden',
        zIndex: 1,
      }}>
      <MapLibreMap
        mapStyle={MAP_STYLE_URL}
        dragPan={false}
        touchZoom={false}
        touchRotate={false}
        touchPitch={false}
        logo={false}
        style={{ flex: 1 }}>
        <Camera
          initialViewState={{
            center: [longitude, latitude],
            zoom: 13,
          }}
        />
        <Marker lngLat={[longitude, latitude]}>
          <MapPin emphasis="focused" />
        </Marker>
      </MapLibreMap>
    </Pressable>
  );
}
