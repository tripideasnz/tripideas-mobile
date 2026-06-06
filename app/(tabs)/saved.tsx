import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddToTripModal } from '@/components/add-to-trip-modal';
import { PlaceCard } from '@/components/place-card';
import { useSavedPlaces } from '@/saved/provider';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { getTripThumbnail } from '@/trips/images';
import { useMyTrips } from '@/trips/provider';
import type { PlaceCardData } from '@/types/content';

export default function SavedScreen() {
  const router = useRouter();
  const { isLoading: isLoadingSavedIds, savedPlaceIds } = useSavedPlaces();
  const {
    addPlaceToTrip,
    createTrip,
    isLoading: isLoadingTrips,
    trips,
  } = useMyTrips();
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const [tripPlaces, setTripPlaces] = useState<PlaceCardData[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [isLoadingTripPlaces, setIsLoadingTripPlaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newTripName, setNewTripName] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const tripPlaceIds = useMemo(
    () =>
      Array.from(
        new Set(
          trips.flatMap((trip) =>
            trip.places.map((tripPlace) => tripPlace.placeId)
          )
        )
      ),
    [trips]
  );
  const tripPlaceIdsKey = tripPlaceIds.join('|');

  useEffect(() => {
    if (isLoadingSavedIds) {
      return;
    }

    if (savedPlaceIds.length === 0) {
      setPlaces([]);
      setErrorMessage(null);
      setIsLoadingPlaces(false);
      return;
    }

    let isMounted = true;

    setIsLoadingPlaces(true);
    setErrorMessage(null);

    fetchPlaceCardsByIds(savedPlaceIds)
      .then((data) => {
        if (isMounted) {
          setPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setPlaces([]);
          setErrorMessage('Unable to load favourites.');
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
  }, [isLoadingSavedIds, savedPlaceIds]);

  useEffect(() => {
    if (isLoadingTrips || tripPlaceIds.length === 0) {
      setTripPlaces([]);
      setIsLoadingTripPlaces(false);
      return;
    }

    let isMounted = true;

    setIsLoadingTripPlaces(true);

    fetchPlaceCardsByIds(tripPlaceIds)
      .then((data) => {
        if (isMounted) {
          setTripPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setTripPlaces([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingTripPlaces(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // A stable string prevents refetches when trip notes or names change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingTrips, tripPlaceIdsKey]);

  const isLoading = isLoadingSavedIds || isLoadingPlaces;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 32,
          paddingHorizontal: 24,
          paddingTop: 20,
        }}>
        <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 18 }}>
          Saved
        </Text>

        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 12 }}>
            My Trips
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <TextInput
              accessibilityLabel="New trip name"
              onChangeText={setNewTripName}
              onSubmitEditing={async () => {
                const trip = await createTrip(newTripName);

                if (trip) {
                  setNewTripName('');
                }
              }}
              placeholder="New trip name"
              returnKeyType="done"
              style={{
                borderColor: '#d8d8d8',
                borderRadius: 10,
                borderWidth: 1,
                flex: 1,
                fontSize: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
              value={newTripName}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!newTripName.trim()}
              onPress={async () => {
                const trip = await createTrip(newTripName);

                if (trip) {
                  setNewTripName('');
                }
              }}
              style={({ pressed }) => ({
                alignItems: 'center',
                backgroundColor: '#111',
                borderRadius: 10,
                justifyContent: 'center',
                opacity: !newTripName.trim() ? 0.4 : pressed ? 0.7 : 1,
                paddingHorizontal: 18,
              })}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                Create
              </Text>
            </Pressable>
          </View>

          {isLoadingTrips || isLoadingTripPlaces ? (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              Loading trips...
            </Text>
          ) : trips.length > 0 ? (
            trips.map((trip) => {
              const thumbnail = getTripThumbnail(trip, tripPlaces);

              return (
                <Pressable
                  accessibilityRole="button"
                  key={trip.id}
                  onPress={() =>
                    router.push({
                      pathname: '/trips/[tripId]',
                      params: { tripId: trip.id },
                    })
                  }
                  style={({ pressed }) => ({
                    borderColor: '#e2e2e2',
                    borderRadius: 12,
                    borderWidth: 1,
                    flexDirection: 'row',
                    marginBottom: 10,
                    opacity: pressed ? 0.65 : 1,
                    overflow: 'hidden',
                  })}>
                  {thumbnail ? (
                    <Image
                      accessibilityLabel={thumbnail.alt}
                      contentFit="cover"
                      source={{ uri: thumbnail.url }}
                      style={{ height: 92, width: 112 }}
                    />
                  ) : (
                    <View
                      style={{
                        alignItems: 'center',
                        backgroundColor: '#e8ecef',
                        height: 92,
                        justifyContent: 'center',
                        width: 112,
                      }}>
                      <Text
                        style={{
                          color: '#59636b',
                          fontSize: 13,
                          fontWeight: '700',
                        }}>
                        My Trip
                      </Text>
                    </View>
                  )}

                  <View
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      padding: 16,
                    }}>
                    <Text
                      numberOfLines={2}
                      style={{ fontSize: 18, fontWeight: '700' }}>
                      {trip.name}
                    </Text>
                    <Text
                      style={{ color: '#717171', fontSize: 14, marginTop: 5 }}>
                      {trip.places.length}{' '}
                      {trip.places.length === 1 ? 'place' : 'places'}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              No trips yet. Create one for places you want to group together.
            </Text>
          )}
        </View>

        <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 12 }}>
          Favourites
        </Text>

        {isLoading ? (
          <Text style={{ color: '#717171', fontSize: 16 }}>
            Loading favourites...
          </Text>
        ) : errorMessage ? (
          <Text style={{ color: '#717171', fontSize: 16 }}>{errorMessage}</Text>
        ) : places.length > 0 ? (
          places.map((place, index) => {
            const key = place._id ?? place.slug?.current ?? index;

            return (
              <View key={key} style={{ marginBottom: 8 }}>
                <PlaceCard place={place} />
                {place._id ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedPlaceId(place._id ?? null)}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      borderColor: '#111',
                      borderRadius: 10,
                      borderWidth: 1,
                      marginBottom: 16,
                      marginTop: -12,
                      opacity: pressed ? 0.55 : 1,
                      paddingVertical: 12,
                    })}>
                    <Text style={{ fontSize: 16, fontWeight: '700' }}>
                      Add to trip
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={{ color: '#717171', fontSize: 16 }}>
            No favourites yet.
          </Text>
        )}
      </ScrollView>

      <AddToTripModal
        onClose={() => setSelectedPlaceId(null)}
        onSelectTrip={async (tripId) => {
          if (!selectedPlaceId) {
            return;
          }

          const selectedTrip = trips.find((trip) => trip.id === tripId);
          const alreadyAdded = selectedTrip?.places.some(
            (place) => place.placeId === selectedPlaceId
          );

          if (alreadyAdded) {
            Alert.alert('This place is already in that trip');
            return;
          }

          await addPlaceToTrip(tripId, selectedPlaceId);
          setSelectedPlaceId(null);
          Alert.alert('Added to My Trip');
        }}
        placeId={selectedPlaceId}
        trips={trips}
      />
    </SafeAreaView>
  );
}
