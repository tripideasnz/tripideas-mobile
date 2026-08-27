import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';

import { HeaderBackButton } from '@/components/ui/header-back-button';
import { SignedOutFeature } from '@/components/signed-out-feature';
import { useSession } from '@/auth/provider';

import { TripEntryCard } from '@/components/trip-entry-card';
import { PlaceSearch } from '@/components/place-search';
import { AutosaveNote } from '@/components/ui/autosave-note';
import { IconAction } from '@/components/ui/icon-action';
import { LoadingView } from '@/components/ui/loading-view';
import { TripImageCollage } from '@/components/trip-image-collage';
import { AutoExpandingTextInput } from '@/components/ui/app-text-input';
import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { getTripImages } from '@/trips/images';
import { useMyTrips } from '@/trips/provider';
import {
  buildPublicTripSnapshot,
  createPublicTripShare,
} from '@/trips/public-sharing';
import { authorizePhotoRead } from '@/notebooks/api';
import {
  buildTripShareCardData,
  buildTripShareMessage,
} from '@/trips/share';
import type { PlaceCardData } from '@/types/content';

export default function TripDetailScreen() {
  const { isLoading: isLoadingSession, session, signIn } = useSession();
  const { tripId } = useLocalSearchParams<{
    tripId?: string | string[];
  }>();
  const selectedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const router = useRouter();
  const {
    getTrip,
    addPlaceToTrip,
    isLoading: isLoadingTrips,
    refresh,
    removeTripEntry,
    renameTrip,
    updateTripEntryNote,
    updateTripNote,
  } = useMyTrips();
  const trip = getTrip(selectedTripId);
  const [name, setName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [places, setPlaces] = useState<PlaceCardData[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [personalPhotoUrls, setPersonalPhotoUrls] = useState<Record<string, string>>({});
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const entryOffsetsRef = useRef<Record<string, number>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const placeIds = useMemo(
    () => trip?.places.map((place) => place.placeId) ?? [],
    [trip?.places]
  );
  const placeIdsKey = placeIds.join('|');
  const trimmedName = name.trim();
  const isNameDirty = Boolean(
    trip && trimmedName && trimmedName !== trip.name
  );
  const tripImages = trip
    ? getTripImages(trip, places, personalPhotoUrls).slice(0, 4)
    : [];
  const orderedEntries = useMemo(
    () =>
      trip?.entries ??
      (trip?.places ?? []).map((place, order) => ({
        editorialPlace: { id: place.placeId },
        id: place.entryId ?? place.placeId,
        itineraryId: trip?.id ?? '',
        note: place.note,
        order,
        type: 'editorialPlace' as const,
      })),
    [trip?.entries, trip?.id, trip?.places]
  );
  const placesById = useMemo(
    () => new Map(places.map((place) => [place._id, place])),
    [places]
  );

  useEffect(() => {
    let mounted = true;
    const cards = orderedEntries.flatMap((entry) =>
      entry.type === 'personalPlaceCard' && 'personalPlaceCard' in entry
        ? [entry.personalPlaceCard]
        : []
    );
    void Promise.all(cards.map(async (card) => {
      const main = card.media.find((item) => item.role === 'main');
      if (!main) return null;
      try {
        const result = await authorizePhotoRead(main.photoAssetId);
        return [card.id, result.url] as const;
      } catch {
        return null;
      }
    })).then((results) => {
      if (mounted) {
        setPersonalPhotoUrls(Object.fromEntries(results.filter(Boolean) as [string, string][]));
      }
    });
    return () => { mounted = false; };
  }, [orderedEntries]);

  useEffect(() => {
    setName(trip?.name ?? '');
    setIsEditingName(false);
  }, [trip?.id, trip?.name]);

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

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  const navigateToEntry = useCallback((entryId: string) => {
    const y = entryOffsetsRef.current[entryId];
    if (typeof y !== 'number') return;
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedEntryId(entryId);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedEntryId((current) => current === entryId ? null : current);
      highlightTimerRef.current = null;
    }, 500);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, y - Space.sm),
      });
    });
  }, []);

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
    if (trip.entries?.some((entry) => entry.type === 'personalPlaceCard')) {
      Alert.alert(
        'Public sharing unavailable',
        'Public Trip snapshots do not yet have a safe Personal Place Card contract. Remove Personal Places or share an editorial-only Trip.'
      );
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

  if (isLoadingSession) return <LoadingView />;
  if (!session) {
    return (
      <SignedOutFeature
        message="Sign in to view and edit your private Trips"
        onSignIn={signIn}
      />
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        paddingBottom: Space.huge,
        paddingHorizontal: Screen.gutter,
        paddingTop: Screen.top,
      }}>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => (
            <HeaderBackButton color={Palette.trip} fallbackHref="/trips" />
          ),
          headerRight: () => trip ? <IconAction
            accessibilityLabel="Share Trip"
            icon="share"
            onPress={() => Alert.alert('Share trip', undefined, [
              { style: 'cancel', text: 'Cancel' },
              { onPress: () => router.push({ pathname: '/trips/[tripId]/shared', params: { tripId: trip.id } }), text: 'Preview' },
              { onPress: () => void createPublicShare(), text: 'Share' },
            ])}
            trip
          /> : null,
          title: '',
        }}
      />

      {isLoadingTrips ? (
        <LoadingView />
      ) : !trip || !selectedTripId ? (
        <Text style={{ color: '#717171', fontSize: 16 }}>
          This trip could not be found.
        </Text>
      ) : (
        <>
          {isEditingName ? (
            <View style={{ marginBottom: Space.xxl }}>
              <AutoExpandingTextInput
                accessibilityLabel="Trip name"
                autoFocus
                onChangeText={setName}
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

          <View style={{ marginBottom: Space.xxl }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: Space.sm }}>
              <Text style={{ flex: 1, ...Type.cardTitle }}>Trip note</Text>
              <View style={{ flexDirection: 'row', gap: Space.sm }}>
                <IconAction
                  accessibilityLabel="Show Trip on map"
                  icon="map"
                  onPress={() =>
                    router.push({
                      pathname: '/trips/[tripId]/map',
                      params: { tripId: trip.id },
                    })
                  }
                />
              </View>
            </View>
            <AutosaveNote
              accessibilityLabel="Trip note"
              onSave={(note) => updateTripNote(trip.id, note)}
              placeholder="Add plans, reminders, or ideas for this trip"
              value={trip.note}
            />
          </View>

          <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: Space.lg }}>
            <Text style={{ flex: 1, ...Type.section }}>Places</Text>
            <IconAction
              accessibilityLabel={isSearchingPlaces ? 'Close Place search' : 'Search and add Place'}
              icon={isSearchingPlaces ? 'close' : 'add'}
              onPress={() => setIsSearchingPlaces((value) => !value)}
            />
          </View>

          {isSearchingPlaces ? <View style={{ marginBottom: Space.xxl }}>
            <PlaceSearch
              onPlacePress={(place) => {
                if (!place._id || isAddingPlace) return;
                setIsAddingPlace(true);
                void addPlaceToTrip(trip.id, place._id)
                  .then(() => setIsSearchingPlaces(false))
                  .catch(() => Alert.alert('Unable to add Place', 'Check your connection and try again.'))
                  .finally(() => setIsAddingPlace(false));
              }}
              placeholder={isAddingPlace ? 'Adding Place…' : 'Search TripIdeas Places'}
            />
          </View> : null}

          {isLoadingPlaces ? (
            <LoadingView />
          ) : errorMessage && orderedEntries.every(
            (entry) => entry.type === 'editorialPlace'
          ) ? (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              {errorMessage}
            </Text>
          ) : orderedEntries.length > 0 ? (
            orderedEntries.map((entry, index) => (
              <View
                key={entry.id}
                onLayout={(event) => {
                  entryOffsetsRef.current[entry.id] = event.nativeEvent.layout.y;
                }}>
                <TripEntryCard
                  canMoveDown={index < orderedEntries.length - 1}
                  canMoveUp={index > 0}
                  entry={entry}
                  editorialPlace={
                    entry.type === 'editorialPlace'
                      ? placesById.get(entry.editorialPlace.id)
                      : undefined
                  }
                  highlighted={highlightedEntryId === entry.id}
                  onNavigateDown={() => {
                    const target = orderedEntries[index + 1];
                    if (target) navigateToEntry(target.id);
                  }}
                  onNavigateUp={() => {
                    const target = orderedEntries[index - 1];
                    if (target) navigateToEntry(target.id);
                  }}
                  onRemove={() => removeTripEntry(trip.id, entry.id)}
                  onSaveNote={(note) =>
                    updateTripEntryNote(trip.id, entry.id, note)
                  }
                />
              </View>
            ))
          ) : (
            <Text style={{ color: '#717171', fontSize: 16 }}>
              No places in this trip yet. Add one from Favourites.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}
