import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

function parseCoordinate(value?: string | string[]) {
  const selectedValue = Array.isArray(value) ? value[0] : value;
  const coordinate = Number(selectedValue);

  return Number.isFinite(coordinate) ? coordinate : undefined;
}

export default function MapScreen() {
  const params = useLocalSearchParams<{
    lat?: string | string[];
    lng?: string | string[];
    title?: string | string[];
  }>();
  const latitude = parseCoordinate(params.lat);
  const longitude = parseCoordinate(params.lng);
  const title = Array.isArray(params.title) ? params.title[0] : params.title;
  const hasMarker =
    typeof latitude === 'number' && typeof longitude === 'number';
  const initialRegion = {
    latitude: latitude ?? -41.28664,
    longitude: longitude ?? 174.77557,
    latitudeDelta: hasMarker ? 0.04 : 12,
    longitudeDelta: hasMarker ? 0.04 : 12,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 6 }}>
          Map
        </Text>
        <Text style={{ color: '#717171', fontSize: 15, marginBottom: 16 }}>
          {hasMarker
            ? title ?? 'Selected place'
            : 'Open a place and tap View on map.'}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <MapView initialRegion={initialRegion} style={{ flex: 1 }}>
          {hasMarker ? (
            <Marker
              coordinate={{ latitude, longitude }}
              title={title ?? 'Selected place'}
            />
          ) : null}
        </MapView>
      </View>
    </SafeAreaView>
  );
}
