import { Camera, Map as MapLibreMap, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';

import { MAP_STYLE_URL } from '@/constants/map';
import { Radius, Shadow } from '@/constants/design';
import { MapPin } from '@/components/map/map-pin';
import { needsRecentre } from '@/components/place-map-camera';

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
  const camera = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  // The camera is created centred on the mount-time coordinates.
  const applied = useRef({ latitude, longitude });

  // Centre only once MapLibre reports it is ready (earlier commands can be
  // dropped), and only when the saved coordinates actually changed.
  useEffect(() => {
    const next = { latitude, longitude };
    if (!needsRecentre(mapReady, applied.current, next)) return;
    applied.current = next;
    camera.current?.easeTo({
      center: [longitude, latitude],
      duration: 400,
      zoom: 13,
    });
  }, [latitude, longitude, mapReady]);

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
        onDidFinishLoadingMap={() => setMapReady(true)}
        dragPan={false}
        touchZoom={false}
        touchRotate={false}
        touchPitch={false}
        logo={false}
        style={{ flex: 1 }}>
        <Camera
          ref={camera}
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
