import {
  Camera,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { HeaderBackButton } from '@/components/ui/header-back-button';
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

function hasValidCoordinates(place: PlaceCardData): place is MappablePlace {
  return (
    Number.isFinite(place.coordinates?.lat) &&
    Number.isFinite(place.coordinates?.lng)
  );
}

export default function TripMapScreen() {
  const { tripId } = useLocalSearchParams<{
    tripId?: string | string[];
  }>();
  const selectedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const { getTrip, isLoading: isLoadingTrips } = useMyTrips();
  const trip = getTrip(selectedTripId);
  const cameraRef = useRef<CameraRef>(null);
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
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
  const placesWithoutCoordinates = placeIds.length - mappablePlaces.length;
  const selectedPlace =
    places.find((place) => place._id === selectedPlaceId) ?? null;

  useEffect(() => {
    if (!trip || placeIds.length === 0) {
      setPlaces([]);
      setSelectedPlaceId(null);
      setErrorMessage(null);
      setIsLoadingPlaces(false);
      return;
    }

    let isMounted = true;

    setIsLoadingPlaces(true);
    setErrorMessage(null);
    setSelectedPlaceId(null);

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
  }, [placeIdsKey, selectedTripId]);

  useEffect(() => {
    if (!isMapReady || mappablePlaces.length === 0) {
      return;
    }

    if (mappablePlaces.length === 1) {
      cameraRef.current?.easeTo({
        center: [mappablePlaces[0].coordinates.lng, mappablePlaces[0].coordinates.lat],
        zoom: 13,
        duration: 350,
      });
      return;
    }

    const lngs = mappablePlaces.map((p) => p.coordinates.lng);
    const lats = mappablePlaces.map((p) => p.coordinates.lat);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 48, right: 48, bottom: 48, left: 48 }, duration: 350 }
    );
  }, [isMapReady, mappablePlaces]);

  const title = trip?.name ? `${trip.name} Map` : 'Trip Map';

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderBackButton />,
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
      ) : places.length === 0 ? (
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

          {mappablePlaces.length > 0 ? (
            <View style={{ flex: 1 }}>
              <MapLibreMap
                mapStyle={MAP_STYLE_URL}
                touchPitch={false}
                touchRotate={false}
                onDidFinishLoadingMap={() => setIsMapReady(true)}
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
                    onPress={() => setSelectedPlaceId(place._id ?? null)}>
                    <View
                      style={{
                        borderColor: '#fff',
                        borderRadius: 6,
                        borderWidth: 2,
                        backgroundColor: '#0080C8',
                        height: 12,
                        width: 12,
                      }}
                    />
                  </Marker>
                ))}
              </MapLibreMap>
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

          {mappablePlaces.length > 0 ? (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              style={{ maxHeight: '42%' }}>
              {selectedPlace ? (
                <PlaceCard place={selectedPlace} />
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
