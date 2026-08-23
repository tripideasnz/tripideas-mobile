import {
  Camera,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { PersonalPlaceCardView } from '@/components/personal-place-card-view';
import { MapPin } from '@/components/map/map-pin';
import { MapZoomControls } from '@/components/map/map-controls';
import { useMapSelection } from '@/components/map/use-map-selection';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { Palette, Radius } from '@/constants/design';
import { MAP_STYLE_URL } from '@/constants/map';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { useMyTrips } from '@/trips/provider';
import type { PlaceCardData } from '@/types/content';

type MappablePlace = PlaceCardData & {
  coordinates: {
    lat: number;
    lng: number;
  };
};
type TripMapSelection =
  | { kind: 'editorial'; place: MappablePlace }
  | { kind: 'personal'; entryId: string; card: import('@/personal-place-cards/types').PersonalPlaceCard };

function hasValidCoordinates(place: PlaceCardData): place is MappablePlace {
  return (
    Number.isFinite(place.coordinates?.lat) &&
    Number.isFinite(place.coordinates?.lng)
  );
}

export default function TripMapScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{
    tripId?: string | string[];
  }>();
  const selectedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const { getTrip, isLoading: isLoadingTrips } = useMyTrips();
  const trip = getTrip(selectedTripId);
  const cameraRef = useRef<CameraRef>(null);
  const zoomRef = useRef(5);
  const centerRef = useRef<[number, number]>([174.77557, -41.28664]);
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const openSelection = useCallback((selection: TripMapSelection) => {
    if (selection.kind === 'editorial') {
      const slug = selection.place.slug?.current;
      if (slug) router.push({ pathname: '/place/[slug]', params: { slug } });
      return;
    }
    router.push({ pathname: '/personal-place-cards/[cardId]', params: { cardId: selection.card.id, mode: 'view' } });
  }, [router]);
  const { activate, clear: clearSelection, select, selectedId: selectedPlaceId } = useMapSelection(openSelection);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const placeIds = useMemo(
    () => trip?.places.map((place) => place.placeId) ?? [],
    [trip?.places]
  );
  const placeIdsKey = placeIds.join('|');
  const mappablePlaces = useMemo(
    () => places.filter(hasValidCoordinates),
    [places]
  );
  const personalEntries = useMemo(
    () => (trip?.entries ?? []).filter(
      (entry) =>
        entry.type === 'personalPlaceCard' &&
        'personalPlaceCard' in entry
    ),
    [trip?.entries]
  );
  const personalMarkers = useMemo(
    () => personalEntries.flatMap((entry) => {
      const location = entry.personalPlaceCard.location;
      return location?.confirmed
        ? [{
            entryId: entry.id,
            latitude: location.latitude,
            longitude: location.longitude,
            card: entry.personalPlaceCard,
          }]
        : [];
    }),
    [personalEntries]
  );
  const allCoordinates = useMemo(
    () => [
      ...mappablePlaces.map((place) => ({
        latitude: place.coordinates.lat,
        longitude: place.coordinates.lng,
      })),
      ...personalMarkers,
    ],
    [mappablePlaces, personalMarkers]
  );
  const placesWithoutCoordinates =
    placeIds.length - mappablePlaces.length +
    personalEntries.length - personalMarkers.length;
  const selectedPlace =
    places.find((place) => place._id === selectedPlaceId) ?? null;
  const selectedPersonal = personalMarkers.find(
    (item) => `personal:${item.entryId}` === selectedPlaceId
  ) ?? null;

  useEffect(() => {
    if (!trip || placeIds.length === 0) {
      setPlaces([]);
      select(null);
      setErrorMessage(null);
      setIsLoadingPlaces(false);
      return;
    }

    let isMounted = true;

    setIsLoadingPlaces(true);
    setErrorMessage(null);
    select(null);

    fetchPlaceCardsByIds(placeIds)
      .then((data) => {
        if (isMounted) {
          setPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setPlaces([]);
          setErrorMessage('Unable to load places for this trip.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPlaces(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // A stable string prevents refetching when unrelated trip fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeIdsKey, selectedTripId, select]);

  useEffect(() => {
    if (!isMapReady || allCoordinates.length === 0) {
      return;
    }

    if (allCoordinates.length === 1) {
      cameraRef.current?.easeTo({
        center: [allCoordinates[0].longitude, allCoordinates[0].latitude],
        zoom: 13,
        duration: 350,
      });
      return;
    }

    const lngs = allCoordinates.map((p) => p.longitude);
    const lats = allCoordinates.map((p) => p.latitude);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 48, right: 48, bottom: 48, left: 48 }, duration: 350 }
    );
  }, [allCoordinates, isMapReady]);

  const title = trip?.name ? `${trip.name} Map` : 'Trip Map';

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderBackButton color={Palette.trip} />,
          title,
        }}
      />

      {isLoadingTrips || isLoadingPlaces ? (
        <Text style={{ color: '#717171', fontSize: 16, padding: 24 }}>
          Loading trip map...
        </Text>
      ) : !trip || !selectedTripId ? (
        <Text style={{ color: '#717171', fontSize: 16, padding: 24 }}>
          This trip could not be found.
        </Text>
      ) : errorMessage ? (
        <Text style={{ color: '#717171', fontSize: 16, padding: 24 }}>
          {errorMessage}
        </Text>
      ) : places.length === 0 && personalEntries.length === 0 ? (
        <Text style={{ color: '#717171', fontSize: 16, padding: 24 }}>
          This trip has no places to show yet.
        </Text>
      ) : (
        <>
          {placesWithoutCoordinates > 0 ? (
            <Text
              style={{
                color: '#717171',
                fontSize: 14,
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}>
              Some places could not be shown on the map.
            </Text>
          ) : null}

          {allCoordinates.length > 0 ? (
            <View style={{ flex: 1 }}>
              <MapLibreMap
                mapStyle={MAP_STYLE_URL}
                touchPitch={false}
                touchRotate={false}
                onPress={clearSelection}
                onDidFinishLoadingMap={() => setIsMapReady(true)}
                onRegionDidChange={(event) => { zoomRef.current = event.nativeEvent.zoom; centerRef.current = event.nativeEvent.center; }}
                style={{ flex: 1 }}>
                <Camera
                  ref={cameraRef}
                  initialViewState={{
                    center: [174.77557, -41.28664],
                    zoom: 5,
                  }}
                />
                {mappablePlaces.map((place, index) => (
                  <Marker
                    key={place._id ?? place.slug?.current ?? index}
                    id={String(place._id ?? place.slug?.current ?? index)}
                    lngLat={[place.coordinates.lng, place.coordinates.lat]}
                    onPress={() => { const markerId = place._id ?? place.slug?.current; if (markerId) activate(markerId, { kind: 'editorial', place }); }}>
                    <MapPin emphasis={selectedPlaceId === (place._id ?? place.slug?.current) ? 'selected' : 'default'} />
                  </Marker>
                ))}
                {personalMarkers.map((item) => (
                  <Marker
                    key={item.entryId}
                    id={`personal:${item.entryId}`}
                    lngLat={[item.longitude, item.latitude]}
                    onPress={() => activate(`personal:${item.entryId}`, { kind: 'personal', entryId: item.entryId, card: item.card })}>
                    <MapPin emphasis={selectedPlaceId === `personal:${item.entryId}` ? 'selected' : 'default'} />
                  </Marker>
                ))}
              </MapLibreMap>
              <View style={{ position: 'absolute', right: 16, top: 16 }}>
                <MapZoomControls
                  onZoomInPress={() => { zoomRef.current = Math.min(20, zoomRef.current + 1); cameraRef.current?.easeTo({ center: centerRef.current, zoom: zoomRef.current, duration: 180 }); }}
                  onZoomOutPress={() => { zoomRef.current = Math.max(2, zoomRef.current - 1); cameraRef.current?.easeTo({ center: centerRef.current, zoom: zoomRef.current, duration: 180 }); }}
                />
              </View>
            </View>
          ) : (
            <View
              style={{
                alignItems: 'center',
                flex: 1,
                justifyContent: 'center',
                padding: 24,
              }}>
              <Text
                style={{
                  color: '#717171',
                  fontSize: 16,
                  textAlign: 'center',
                }}>
                None of the places in this trip have map coordinates yet.
              </Text>
            </View>
          )}

          {allCoordinates.length > 0 ? (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              style={{ maxHeight: '42%' }}>
              {selectedPersonal ? (
                <View accessibilityLabel={`${selectedPersonal.card.title || 'Personal Place'}, selected`} accessibilityState={{ selected: true }} style={{ borderColor: Palette.trip, borderRadius: Radius.card, borderWidth: 2, overflow: 'hidden' }}><PersonalPlaceCardView card={selectedPersonal.card} onPress={() => openSelection({ kind: 'personal', entryId: selectedPersonal.entryId, card: selectedPersonal.card })} /></View>
              ) : selectedPlace ? (
                <View accessibilityLabel={`${selectedPlace.title || 'Place'}, selected`} accessibilityState={{ selected: true }} style={{ borderColor: Palette.trip, borderRadius: Radius.card, borderWidth: 2, overflow: 'hidden' }}><PlaceCard onPress={() => openSelection({ kind: 'editorial', place: selectedPlace as MappablePlace })} place={selectedPlace} /></View>
              ) : (
                <Text
                  style={{
                    color: '#717171',
                    fontSize: 15,
                    textAlign: 'center',
                  }}>
                  Tap a pin to view its place card.
                </Text>
              )}
            </ScrollView>
          ) : null}
        </>
      )}
    </View>
  );
}
