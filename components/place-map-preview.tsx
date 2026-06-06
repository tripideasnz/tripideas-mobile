import MapView, { Marker } from 'react-native-maps';
import { Pressable, Text, View } from 'react-native';

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
      accessibilityLabel="Open this place on the TripIdeas map"
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={{
        borderRadius: 14,
        elevation: 1,
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
        <Marker
          coordinate={{ latitude, longitude }}
          title={title ?? 'Selected place'}
        />
      </MapView>
      <View
        pointerEvents="none"
        style={{
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderRadius: 999,
          bottom: 12,
          elevation: 2,
          left: 12,
          paddingHorizontal: 12,
          paddingVertical: 7,
          position: 'absolute',
          zIndex: 2,
        }}>
        <Text style={{ fontSize: 13, fontWeight: '700' }}>Map preview</Text>
      </View>
    </Pressable>
  );
}
