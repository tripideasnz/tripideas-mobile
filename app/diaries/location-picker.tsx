import { Camera, Map as MapLibreMap, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from '@/components/map/map-pin';
import { MapZoomControls } from '@/components/map/map-controls';
import { AppButton } from '@/components/ui/app-button';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { Palette, Screen, Space } from '@/constants/design';
import { MAP_STYLE_URL } from '@/constants/map';
import { useDiaries } from '@/diaries/provider';

export default function DiaryLocationPicker() {
  const router = useRouter(); const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ diaryId: string; dayId: string; topicId: string; itemId?: string; latitude?: string; longitude?: string }>();
  const initialLatitude = Number(params.latitude); const initialLongitude = Number(params.longitude);
  const hasInitialLocation = Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude);
  const camera = useRef<CameraRef>(null); const zoom = useRef(hasInitialLocation ? 13 : 5);
  const [selected, setSelected] = useState<{ latitude: number; longitude: number } | null>(hasInitialLocation ? { latitude: initialLatitude, longitude: initialLongitude } : null);
  const [saving, setSaving] = useState(false); const { addItem, updateItem } = useDiaries();
  const save = async () => { if (!selected || saving) return; setSaving(true); try { if (params.itemId) await updateItem(params.diaryId, params.dayId, params.topicId, params.itemId, { location: selected }); else await addItem(params.diaryId, params.dayId, params.topicId, { type: 'LOCATION', label: null, location: selected, contentOrigin: 'USER_OWNED', includeOnMap: true }); router.back(); } finally { setSaving(false); } };
  return <View style={{ backgroundColor: Palette.background, flex: 1 }}><Stack.Screen options={{ title: 'Find on map', headerLeft: () => <HeaderBackButton color={Palette.trip} /> }} />
    <MapLibreMap mapStyle={MAP_STYLE_URL} onPress={(event) => { const [longitude, latitude] = event.nativeEvent.lngLat; setSelected({ latitude, longitude }); }} onRegionDidChange={(event) => { zoom.current = event.nativeEvent.zoom; }} style={{ flex: 1 }}><Camera ref={camera} initialViewState={selected ? { center: [selected.longitude, selected.latitude], zoom: 13 } : { center: [174.77557, -41.28664], zoom: 5 }} />{selected ? <Marker lngLat={[selected.longitude, selected.latitude]}><MapPin emphasis="focused" /></Marker> : null}</MapLibreMap>
    <View style={{ bottom: Math.max(insets.bottom, Screen.bottom) + 88, position: 'absolute', right: Space.md }}><MapZoomControls onZoomInPress={() => { zoom.current += 1; camera.current?.zoomTo(zoom.current, { duration: 250 }); }} onZoomOutPress={() => { zoom.current -= 1; camera.current?.zoomTo(zoom.current, { duration: 250 }); }} /></View>
    <View style={{ flexDirection: 'row', gap: Space.md, paddingBottom: Math.max(insets.bottom, Screen.bottom), paddingHorizontal: Screen.gutter, paddingTop: Space.lg }}><AppButton label="Cancel" onPress={() => router.back()} style={{ flex: 1 }} variant="secondary" /><AppButton disabled={!selected || saving} label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} style={{ flex: 1 }} /></View>
  </View>;
}
