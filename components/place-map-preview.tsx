import { Camera, Map as MapLibreMap, Marker } from '@maplibre/maplibre-react-native';
import { Pressable, Text, View } from 'react-native';

import { MAP_STYLE_URL } from '@/constants/map';
import { Radius, Shadow, Space, Type } from '@/constants/design';

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
          <View
            style={{
              borderColor: '#fff',
              borderRadius: 7,
              borderWidth: 2.5,
              backgroundColor: '#E74C3C',
              height: 14,
              width: 14,
            }}
          />
        </Marker>
      </MapLibreMap>
      <View
        pointerEvents="none"
        style={{
          backgroundColor: 'rgba(255,255,255,0.94)',
          borderRadius: Radius.pill,
          bottom: 12,
          elevation: 2,
          left: 12,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
          position: 'absolute',
          zIndex: 2,
        }}>
        <Text style={Type.label}>Map preview</Text>
      </View>
    </Pressable>
  );
}
