import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { PlaceCard } from '@/components/place-card';
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
  const mapRef = useRef<MapView>(null);
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

    const coordinates = mappablePlaces.map((place) => ({
      latitude: place.coordinates.lat,
      longitude: place.coordinates.lng,
    }));

    if (coordinates.length === 1) {
      mapRef.current?.animateToRegion(
        {
          ...coordinates[0],
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        350
      );
      return;
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { bottom: 48, left: 48, right: 48, top: 48 },
    });
  }, [isMapReady, mappablePlaces]);

  const title = trip?.name ? `${trip.name} Map` : 'Trip Map';

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ title }} />

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
              <MapView
                ref={mapRef}
                initialRegion={{
                  latitude: -41.28664,
                  longitude: 174.77557,
                  latitudeDelta: 12,
                  longitudeDelta: 12,
                }}
                onMapReady={() => setIsMapReady(true)}
                style={{ flex: 1 }}>
                {mappablePlaces.map((place, index) => (
                  <Marker
                    coordinate={{
                      latitude: place.coordinates.lat,
                      longitude: place.coordinates.lng,
                    }}
                    key={place._id ?? place.slug?.current ?? index}
                    onPress={() => setSelectedPlaceId(place._id ?? null)}
                    title={place.title ?? 'Untitled place'}
                  />
                ))}
              </MapView>
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
