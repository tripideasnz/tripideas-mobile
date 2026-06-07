import MapView, { Marker } from 'react-native-maps';
import { Pressable, Text, View } from 'react-native';

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
  title,
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
      <MapView
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        pointerEvents="none"
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        zoomEnabled={false}
        style={{ flex: 1 }}>
        <Marker coordinate={{ latitude, longitude }} title={title} />
      </MapView>
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
