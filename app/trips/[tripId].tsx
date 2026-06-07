import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HeaderBackButton } from '@react-navigation/elements';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';

import { PlaceCard } from '@/components/place-card';
import { TripImageCollage } from '@/components/trip-image-collage';
import { AppTextInput } from '@/components/ui/app-text-input';
import { CardSurface } from '@/components/ui/card-surface';
import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { getTripImages } from '@/trips/images';
import { useMyTrips } from '@/trips/provider';
import {
  buildPublicTripSnapshot,
  createPublicTripShare,
} from '@/trips/public-sharing';
import {
  buildTripShareCardData,
  buildTripShareMessage,
} from '@/trips/share';
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
    removePlaceFromTrip,
    renameTrip,
    updatePlaceNote,
    updateTripNote,
  } = useMyTrips();
  const trip = getTrip(selectedTripId);
  const [name, setName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
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
  const trimmedName = name.trim();
  const isNameDirty = Boolean(
    trip && trimmedName && trimmedName !== trip.name
  );
  const isTripNoteDirty = Boolean(trip && tripNote !== trip.note);
  const tripImages = trip ? getTripImages(trip, places).slice(0, 4) : [];

  useEffect(() => {
    setName(trip?.name ?? '');
    setIsEditingName(false);
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

  const saveName = async () => {
    if (!trip || !isNameDirty) {
      return;
    }

    await renameTrip(trip.id, trimmedName);
    setIsEditingName(false);
  };

  const cancelNameEdit = () => {
    setName(trip?.name ?? '');
    setIsEditingName(false);
  };

  const saveTripNote = async () => {
    if (!trip || !isTripNoteDirty) {
      return;
    }

    await updateTripNote(trip.id, tripNote);
    Alert.alert('Saved');
  };

  const openShareSheet = async () => {
    if (!trip) {
      return;
    }

    try {
      await Share.share({
        message: buildTripShareMessage({ places, trip }),
        title: trip.name,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Unable to share this trip right now.');
    }
  };

  const createPublicShare = async () => {
    if (!trip) {
      return;
    }

    const cardData = buildTripShareCardData({ places, trip });
    const snapshot = buildPublicTripSnapshot({
      coverImageUrl: cardData.coverImageUrl,
      places,
      trip,
    });
    const result = await createPublicTripShare(snapshot);

    if (result.status === 'created') {
      try {
        await Share.share({
          message: buildTripShareMessage({
            places,
            shareUrl: result.url,
            trip,
          }),
          title: trip.name,
          url: result.url,
        });
      } catch (error) {
        console.error(error);
        Alert.alert('Unable to share this trip right now.');
      }
      return;
    }

    Alert.alert(
      'Unable to create public link',
      result.reason === 'backend-unavailable'
        ? 'Public Trip sharing is not available on the server yet.'
        : 'The public Trip could not be uploaded. Check your connection and try again.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void openShareSheet(),
          text: 'Share text instead',
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        paddingBottom: Space.huge,
        paddingHorizontal: Screen.gutter,
        paddingTop: Screen.top,
      }}>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: (props) => (
            <HeaderBackButton
              {...props}
              accessibilityLabel="Back to Saved"
              onPress={() => router.replace('/saved')}
            />
          ),
          title: '',
        }}
      />

      {isLoadingTrips ? (
        <Text style={{ color: '#717171', fontSize: 16 }}>Loading trip...</Text>
      ) : !trip || !selectedTripId ? (
        <Text style={{ color: '#717171', fontSize: 16 }}>
          This trip could not be found.
        </Text>
      ) : (
        <>
          {isEditingName ? (
            <View style={{ marginBottom: Space.xxl }}>
              <AppTextInput
                accessibilityLabel="Trip name"
                autoFocus
                onChangeText={setName}
                onSubmitEditing={() => void saveName()}
                returnKeyType="done"
                style={{
                  ...Type.title,
                  minHeight: 58,
                  paddingHorizontal: Space.md,
                  paddingVertical: Space.sm,
                }}
                value={name}
              />
              <View
                style={{
                  flexDirection: 'row',
                  gap: Space.sm,
                  marginTop: Space.sm,
                }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isNameDirty}
                  onPress={() => void saveName()}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    backgroundColor: isNameDirty
                      ? Palette.primary
                      : Palette.border,
                    borderRadius: Radius.control,
                    flex: 1,
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: Space.md,
                  })}>
                  <Text
                    style={{
                      color: isNameDirty
                        ? Palette.textOnPrimary
                        : Palette.textMuted,
                      ...Type.label,
                    }}>
                    Save
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={cancelNameEdit}
                  style={({ pressed }) => ({
                    alignItems: 'center',
                    borderColor: Palette.border,
                    borderRadius: Radius.control,
                    borderWidth: 1,
                    flex: 1,
                    opacity: pressed ? 0.55 : 1,
                    paddingVertical: Space.md,
                  })}>
                  <Text style={Type.label}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: Space.sm,
                marginBottom: Space.xxl,
              }}>
              <Text style={{ flex: 1, ...Type.title }}>{trip.name}</Text>
              <Pressable
                accessibilityLabel="Edit trip name"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsEditingName(true)}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  height: 40,
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                  width: 40,
                })}>
                <MaterialIcons color={Palette.text} name="edit" size={22} />
              </Pressable>
            </View>
          )}

          {tripImages.length > 0 ? (
            <TripImageCollage
              images={tripImages}
              style={{
                aspectRatio: 16 / 9,
                borderRadius: Radius.card,
                marginBottom: Space.xxl,
                width: '100%',
              }}
            />
          ) : null}

          <Text style={{ ...Type.label, marginBottom: Space.sm }}>
            Trip note
          </Text>
          <AppTextInput
            accessibilityLabel="Trip note"
            multiline
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
          <Pressable
            accessibilityRole="button"
            disabled={!isTripNoteDirty}
            onPress={() => void saveTripNote()}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: isTripNoteDirty ? '#111' : '#d8d8d8',
              borderRadius: 10,
              marginBottom: 22,
              marginTop: 10,
              opacity: pressed ? 0.7 : 1,
              paddingVertical: 12,
            })}>
            <Text
              style={{
                color: isTripNoteDirty ? '#fff' : '#717171',
                fontSize: 16,
                fontWeight: '700',
              }}>
              Save Note
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/trips/[tripId]/map',
                  params: { tripId: trip.id },
                })
              }
              style={({ pressed }) => ({
                alignItems: 'center',
                borderColor: '#d8d8d8',
                borderRadius: 10,
                borderWidth: 1,
                flex: 1,
                opacity: pressed ? 0.55 : 1,
                paddingVertical: 12,
              })}>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>
                Show on Map
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Alert.alert('Share trip', undefined, [
                  { style: 'cancel', text: 'Cancel' },
                  {
                    onPress: () =>
                      router.push({
                        pathname: '/trips/[tripId]/shared',
                        params: { tripId: trip.id },
                      }),
                    text: 'Preview',
                  },
                  {
                    onPress: () => void createPublicShare(),
                    text: 'Share',
                  },
                ]);
              }}
              style={({ pressed }) => ({
                alignItems: 'center',
                borderColor: '#d8d8d8',
                borderRadius: 10,
                borderWidth: 1,
                flex: 1,
                opacity: pressed ? 0.55 : 1,
                paddingVertical: 12,
              })}>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>Share</Text>
            </Pressable>
          </View>

          <Text style={{ ...Type.section, marginBottom: Space.lg }}>
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
              const savedPlaceNote =
                trip.places.find((tripPlace) => tripPlace.placeId === placeId)
                  ?.note ?? '';
              const draftPlaceNote = placeId
                ? placeNotes[placeId] ?? ''
                : '';
              const isPlaceNoteDirty =
                Boolean(placeId) && draftPlaceNote !== savedPlaceNote;

              return (
                <CardSurface
                  key={placeId ?? place.slug?.current ?? index}
                  style={{ marginBottom: Space.xxl }}>
                  <PlaceCard embedded place={place} />
                  {placeId ? (
                    <View
                      style={{
                        borderTopColor: Palette.border,
                        borderTopWidth: 1,
                        padding: Space.lg,
                      }}>
                      <Text style={{ ...Type.label, marginBottom: Space.sm }}>
                        Note for {place.title ?? 'this place'}
                      </Text>
                      <AppTextInput
                        accessibilityLabel={`Note for ${
                          place.title ?? 'place'
                        }`}
                        multiline
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
                        value={draftPlaceNote}
                      />
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          marginTop: 10,
                        }}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={!isPlaceNoteDirty}
                          onPress={async () => {
                            if (!isPlaceNoteDirty) {
                              return;
                            }

                            await updatePlaceNote(
                              trip.id,
                              placeId,
                              draftPlaceNote
                            );
                            Alert.alert('Saved');
                          }}
                          style={({ pressed }) => ({
                            alignItems: 'center',
                            backgroundColor: isPlaceNoteDirty
                              ? '#111'
                              : '#d8d8d8',
                            borderRadius: 10,
                            flex: 1,
                            opacity: pressed ? 0.7 : 1,
                            paddingVertical: 11,
                          })}>
                          <Text
                            style={{
                              color: isPlaceNoteDirty ? '#fff' : '#717171',
                              fontSize: 15,
                              fontWeight: '700',
                            }}>
                            Save Note
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            Alert.alert(
                              'Remove place?',
                              `Remove "${
                                place.title ?? 'this place'
                              }" from this trip?`,
                              [
                                { style: 'cancel', text: 'Cancel' },
                                {
                                  onPress: () =>
                                    void removePlaceFromTrip(trip.id, placeId),
                                  style: 'destructive',
                                  text: 'Remove',
                                },
                              ]
                            )
                          }
                          style={({ pressed }) => ({
                            alignItems: 'center',
                            borderColor: '#c62828',
                            borderRadius: 10,
                            borderWidth: 1,
                            flex: 1,
                            opacity: pressed ? 0.55 : 1,
                            paddingVertical: 11,
                          })}>
                          <Text
                            style={{
                              color: '#c62828',
                              fontSize: 15,
                              fontWeight: '700',
                            }}>
                            Remove Place
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </CardSurface>
              );
            })
          ) : (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              No places in this trip yet. Add one from Favourites.
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
                      router.replace('/saved');
                    },
                    style: 'destructive',
                    text: 'Delete',
                  },
                ]
              );
            }}
            style={({ pressed }) => ({
              alignItems: 'center',
              borderColor: '#c62828',
              borderRadius: 10,
              borderWidth: 1,
              marginTop: 32,
              opacity: pressed ? 0.55 : 1,
              paddingVertical: 13,
            })}>
            <Text style={{ color: '#c62828', fontSize: 16, fontWeight: '700' }}>
              Delete trip
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
