import { Camera, Map as MapLibreMap, Marker } from '@maplibre/maplibre-react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapPin } from '@/components/map/map-pin';
import { AppButton } from '@/components/ui/app-button';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { MAP_STYLE_URL } from '@/constants/map';
import { Palette, Screen, Space } from '@/constants/design';
import { useNotebooks } from '@/notebooks/provider';

export default function NotebookLocationPicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ notebookId: string; blockId: string; latitude?: string; longitude?: string }>();
  const initialLatitude = Number(params.latitude);
  const initialLongitude = Number(params.longitude);
  const [selected, setSelected] = useState<{ latitude: number; longitude: number } | null>(
    Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude)
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : null
  );
  const [saving, setSaving] = useState(false);
  const { mutate } = useNotebooks();
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await mutate.updateRichBlock(params.notebookId, params.blockId, {
        location: { ...selected, source: 'MAP_SELECTED', accuracyMeters: null },
      });
      router.back();
    } finally { setSaving(false); }
  };
  return <View style={{ backgroundColor: Palette.background, flex: 1 }}>
    <Stack.Screen options={{ title: 'Choose location', headerLeft: () => <HeaderBackButton color={Palette.trip} /> }} />
    <MapLibreMap
      mapStyle={MAP_STYLE_URL}
      onPress={(event) => {
        const [longitude, latitude] = event.nativeEvent.lngLat;
        setSelected({ latitude, longitude });
      }}
      style={{ flex: 1 }}>
      <Camera initialViewState={selected
        ? { center: [selected.longitude, selected.latitude], zoom: 13 }
        : { center: [174.77557, -41.28664], zoom: 5 }} />
      {selected ? <Marker lngLat={[selected.longitude, selected.latitude]}><MapPin emphasis="focused" /></Marker> : null}
    </MapLibreMap>
    <View style={{ flexDirection: 'row', gap: Space.md, paddingBottom: Math.max(insets.bottom, Screen.bottom), paddingHorizontal: Screen.gutter, paddingTop: Space.lg }}>
      <AppButton label="Cancel" onPress={() => router.back()} style={{ flex: 1 }} variant="secondary" />
      <AppButton disabled={!selected || saving} label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} style={{ flex: 1 }} />
    </View>
  </View>;
}
