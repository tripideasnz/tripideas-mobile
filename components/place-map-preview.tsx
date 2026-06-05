import MapView, { Marker } from 'react-native-maps';
import { Text, View } from 'react-native';

type PlaceMapPreviewProps = {
  latitude: number;
  longitude: number;
  title?: string;
};

export function PlaceMapPreview({
  latitude,
  longitude,
  title,
}: PlaceMapPreviewProps) {
  return (
    <View
      style={{
        borderRadius: 14,
        height: 220,
        overflow: 'hidden',
      }}>
      <MapView
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
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
          left: 12,
          paddingHorizontal: 12,
          paddingVertical: 7,
          position: 'absolute',
        }}>
        <Text style={{ fontSize: 13, fontWeight: '700' }}>Map preview</Text>
      </View>
    </View>
  );
}
