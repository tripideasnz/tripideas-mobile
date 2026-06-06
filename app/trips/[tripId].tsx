import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { useMyTrips } from '@/trips/provider';
import type { PlaceCardData } from '@/types/content';

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{
    tripId?: string | string[];
  }>();
  const selectedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const router = useRouter();
  const {
    deleteTrip,
    getTrip,
    isLoading: isLoadingTrips,
    renameTrip,
    updatePlaceNote,
    updateTripNote,
  } = useMyTrips();
  const trip = getTrip(selectedTripId);
  const [name, setName] = useState('');
  const [tripNote, setTripNote] = useState('');
  const [placeNotes, setPlaceNotes] = useState<Record<string, string>>({});
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const placeIds = useMemo(
    () => trip?.places.map((place) => place.placeId) ?? [],
    [trip?.places]
  );
  const placeIdsKey = placeIds.join('|');

  useEffect(() => {
    setName(trip?.name ?? '');
    setTripNote(trip?.note ?? '');
    setPlaceNotes(
      Object.fromEntries(
        (trip?.places ?? []).map((place) => [place.placeId, place.note])
      )
    );
  }, [trip]);

  useEffect(() => {
    if (!trip || placeIds.length === 0) {
      setPlaces([]);
      setErrorMessage(null);
      setIsLoadingPlaces(false);
      return;
    }

    let isMounted = true;

    setIsLoadingPlaces(true);
    setErrorMessage(null);

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
    // A stable string prevents refetches when note edits replace the trip object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeIdsKey, selectedTripId]);

  const title = trip?.name ?? 'My Trip';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#fff' }}
      contentContainerStyle={{
        paddingBottom: 40,
        paddingHorizontal: 24,
        paddingTop: 20,
      }}>
      <Stack.Screen options={{ title }} />

      {isLoadingTrips ? (
        <Text style={{ color: '#717171', fontSize: 16 }}>Loading trip...</Text>
      ) : !trip || !selectedTripId ? (
        <Text style={{ color: '#717171', fontSize: 16 }}>
          This trip could not be found.
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 7 }}>
            Trip name
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <TextInput
              accessibilityLabel="Trip name"
              onChangeText={setName}
              onSubmitEditing={() => void renameTrip(trip.id, name)}
              returnKeyType="done"
              style={{
                borderColor: '#d8d8d8',
                borderRadius: 10,
                borderWidth: 1,
                flex: 1,
                fontSize: 18,
                fontWeight: '700',
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
              value={name}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!name.trim()}
              onPress={() => void renameTrip(trip.id, name)}
              style={{
                alignItems: 'center',
                backgroundColor: '#111',
                borderRadius: 10,
                justifyContent: 'center',
                opacity: name.trim() ? 1 : 0.4,
                paddingHorizontal: 18,
              }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                Rename
              </Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 7 }}>
            Trip note
          </Text>
          <TextInput
            accessibilityLabel="Trip note"
            multiline
            onBlur={() => void updateTripNote(trip.id, tripNote)}
            onChangeText={setTripNote}
            placeholder="Add plans, reminders, or ideas for this trip"
            style={{
              borderColor: '#d8d8d8',
              borderRadius: 10,
              borderWidth: 1,
              fontSize: 16,
              minHeight: 110,
              padding: 14,
              textAlignVertical: 'top',
            }}
            value={tripNote}
          />
          <Text
            style={{
              color: '#717171',
              fontSize: 13,
              marginBottom: 22,
              marginTop: 6,
            }}>
            Notes save when you leave the field.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
            {['Map', 'Share'].map((label) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                disabled
                key={label}
                style={{
                  alignItems: 'center',
                  borderColor: '#d8d8d8',
                  borderRadius: 10,
                  borderWidth: 1,
                  flex: 1,
                  opacity: 0.6,
                  paddingVertical: 12,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>{label}</Text>
                <Text style={{ color: '#717171', fontSize: 12, marginTop: 2 }}>
                  Coming soon
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 14 }}>
            Places
          </Text>

          {isLoadingPlaces ? (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              Loading places...
            </Text>
          ) : errorMessage ? (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              {errorMessage}
            </Text>
          ) : places.length > 0 ? (
            places.map((place, index) => {
              const placeId = place._id;

              return (
                <View key={placeId ?? place.slug?.current ?? index}>
                  <PlaceCard place={place} />
                  {placeId ? (
                    <View style={{ marginBottom: 24, marginTop: -12 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '700',
                          marginBottom: 7,
                        }}>
                        Your note
                      </Text>
                      <TextInput
                        accessibilityLabel={`Note for ${
                          place.title ?? 'place'
                        }`}
                        multiline
                        onBlur={() =>
                          void updatePlaceNote(
                            trip.id,
                            placeId,
                            placeNotes[placeId] ?? ''
                          )
                        }
                        onChangeText={(note) =>
                          setPlaceNotes((currentNotes) => ({
                            ...currentNotes,
                            [placeId]: note,
                          }))
                        }
                        placeholder="Add a note about this place"
                        style={{
                          borderColor: '#d8d8d8',
                          borderRadius: 10,
                          borderWidth: 1,
                          fontSize: 16,
                          minHeight: 90,
                          padding: 14,
                          textAlignVertical: 'top',
                        }}
                        value={placeNotes[placeId] ?? ''}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              No places in this trip yet. Add one from Saved Places.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Alert.alert(
                'Delete trip?',
                `This will delete "${trip.name}" and its notes.`,
                [
                  { style: 'cancel', text: 'Cancel' },
                  {
                    onPress: async () => {
                      await deleteTrip(trip.id);
                      router.back();
                    },
                    style: 'destructive',
                    text: 'Delete',
                  },
                ]
              );
            }}
            style={{
              alignItems: 'center',
              borderColor: '#c62828',
              borderRadius: 10,
              borderWidth: 1,
              marginTop: 32,
              paddingVertical: 13,
            }}>
            <Text style={{ color: '#c62828', fontSize: 16, fontWeight: '700' }}>
              Delete trip
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
