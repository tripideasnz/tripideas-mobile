import { Camera, Map as MapLibreMap, Marker, UserLocation, type CameraRef } from '@maplibre/maplibre-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapRecenterControl, MapZoomControls } from '@/components/map/map-controls';
import { MapPin } from '@/components/map/map-pin';
import { AppButton } from '@/components/ui/app-button';
import { Palette, Screen, Space } from '@/constants/design';
import { MAP_STYLE_URL } from '@/constants/map';
import { useMapUserLocation } from '@/location/use-map-user-location';

export type SavedCoordinates = { latitude: number; longitude: number };

export function SavedLocationPicker({ initial, onCancel, onSave, saveLabel = 'Save location' }: {
  initial: SavedCoordinates | null;
  onCancel: () => void;
  onSave: (coordinates: SavedCoordinates) => Promise<void>;
  saveLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);
  const zoom = useRef(initial ? 13 : 5);
  const [selected, setSelected] = useState<SavedCoordinates | null>(initial);
  const [saving, setSaving] = useState(false);
  const { locateUser, userPosition } = useMapUserLocation(camera);
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try { await onSave(selected); } finally { setSaving(false); }
  };
  return <View style={{ backgroundColor: Palette.background, flex: 1 }}>
    <MapLibreMap mapStyle={MAP_STYLE_URL} onPress={(event) => {
      const [longitude, latitude] = event.nativeEvent.lngLat;
      setSelected({ latitude, longitude });
    }} onRegionDidChange={(event) => { zoom.current = event.nativeEvent.zoom; }} style={{ flex: 1 }}>
      <Camera ref={camera} initialViewState={initial
        ? { center: [initial.longitude, initial.latitude], zoom: 13 }
        : { center: [174.77557, -41.28664], zoom: 5 }} />
      {selected ? <Marker lngLat={[selected.longitude, selected.latitude]}><MapPin emphasis="focused" /></Marker> : null}
      {userPosition ? <UserLocation animated /> : null}
    </MapLibreMap>
    <View style={{ bottom: Math.max(insets.bottom, Screen.bottom) + 88, gap: Space.sm, position: 'absolute', right: Space.md }}>
      <MapRecenterControl onPress={() => void locateUser()} />
      <MapZoomControls onZoomInPress={() => { zoom.current += 1; camera.current?.zoomTo(zoom.current, { duration: 250 }); }} onZoomOutPress={() => { zoom.current -= 1; camera.current?.zoomTo(zoom.current, { duration: 250 }); }} />
    </View>
    <View style={{ flexDirection: 'row', gap: Space.md, paddingBottom: Math.max(insets.bottom, Screen.bottom), paddingHorizontal: Screen.gutter, paddingTop: Space.lg }}>
      <AppButton label="Cancel" onPress={onCancel} style={{ flex: 1 }} variant="secondary" />
      <AppButton disabled={!selected || saving} label={saving ? 'Saving…' : saveLabel} onPress={() => void save()} style={{ flex: 1 }} />
    </View>
  </View>;
}
