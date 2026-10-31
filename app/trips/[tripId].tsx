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
import { TripPlacePicker } from '@/components/trip-place-picker';
import { AutosaveNote } from '@/components/ui/autosave-note';
import { IconAction } from '@/components/ui/icon-action';
import { clearHeaderRightAction, headerShareAction } from '@/components/ui/header-actions';
import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import { TripImageCollage } from '@/components/trip-image-collage';
import { AutoExpandingTextInput } from '@/components/ui/app-text-input';
import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import { sharedTripsStore } from '@/shared-trips';
import { useSharedTripsState } from '@/shared-trips/use-shared-trips';
import {
  linkErrorMessage,
  liveShareConfirmation,
  liveShareMessage,
  SHARE_CHOICES,
  shareErrorMessage,
  stopSharingConfirmation,
} from '@/shared-trips/view-model';
import { getTripImages, type PersonalTripPhoto } from '@/trips/images';
import { useMyTrips } from '@/trips/provider';
import { tripDetailView } from '@/trips/detail-state';
import { useTripPlaceCards } from '@/trips/use-trip-place-cards';
import {
  buildPublicTripSnapshot,
  createPublicTripShare,
  isPublicTripSharingEnabled,
} from '@/trips/public-sharing';
import { usePersonalPhotos } from '@/personal-place-cards/use-personal-photos';
import {
  buildTripShareCardData,
  buildTripShareMessage,
} from '@/trips/share';

export default function TripDetailScreen() {
  const { isLoading: isLoadingSession, session, signIn } = useSession();
  const { tripId } = useLocalSearchParams<{
    tripId?: string | string[];
  }>();
  const selectedTripId = Array.isArray(tripId) ? tripId[0] : tripId;
  const router = useRouter();
  const {
    getTrip,
    isLoading: isLoadingTrips,
    isRefreshing,
    refresh,
    removeTripEntry,
    renameTrip,
    updateTripEntryNote,
    updateTripNote,
  } = useMyTrips();
  const trip = getTrip(selectedTripId);
  const view = tripDetailView({ hasTrip: Boolean(trip), isLoading: isLoadingTrips, isRefreshing });
  const [name, setName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const entryOffsetsRef = useRef<Record<string, number>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );
  // Separate from the Trip's own refresh above: learns whether this Trip is shared live.
  useFocusEffect(
    useCallback(() => {
      void sharedTripsStore.loadMyTrips({ force: true });
    }, [])
  );
  // Whether this Trip is already shared live (its linked collection), and a guard against taps
  // while the share request is running.
  const sharedState = useSharedTripsState();
  const sharedSummary = sharedState.myTrips.data?.find((summary) => summary.id === selectedTripId);
  const sharedCollectionId = sharedSummary?.sharedCollectionId ?? null;
  // The link is on right now. A Trip whose owner stopped sharing keeps its collection (and members)
  // but is no longer "shared live".
  const sharingActive = Boolean(sharedCollectionId && sharedSummary?.sharingActive);
  const isSharingLive = Boolean(selectedTripId && sharedState.sharing[selectedTripId]?.pending);

  const placeIds = useMemo(
    () => trip?.places.map((place) => place.placeId) ?? [],
    [trip?.places]
  );
  // Editorial cards arrive from Sanity after the Trip is already on screen: entries render
  // from the provider's data straight away and fill in as cards land.
  const { cards: places, didFail: placesFailed, isPending: placesPending } = useTripPlaceCards(placeIds);
  const trimmedName = name.trim();
  const isNameDirty = Boolean(
    trip && trimmedName && trimmedName !== trip.name
  );
  // Personal Place main photos come from the provider's shared authorisation
  // cache, so a normal refresh of this Trip does not re-request them.
  const personalMainPhotos = useMemo(
    () => (trip?.entries ?? []).flatMap((entry) => {
      if (entry.type !== 'personalPlaceCard' || !('personalPlaceCard' in entry)) return [];
      const main = entry.personalPlaceCard.media.find((item) => item.role === 'main');
      return main ? [{ cardId: entry.personalPlaceCard.id, photoAssetId: main.photoAssetId }] : [];
    }),
    [trip?.entries]
  );
  const personalPhotos = usePersonalPhotos(
    personalMainPhotos.map((photo) => photo.photoAssetId)
  );
  const personalPhotoUrls: Record<string, PersonalTripPhoto> = {};
  for (const { cardId, photoAssetId } of personalMainPhotos) {
    const photo = personalPhotos.get(photoAssetId);
    if (!photo || photo.status === 'loading') continue;
    personalPhotoUrls[cardId] = {
      cacheKey: photo.cacheKey,
      failed: photo.status === 'failed',
      photoAssetId,
      url: photo.url,
    };
  }
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
    setName(trip?.name ?? '');
    setIsEditingName(false);
  }, [trip?.id, trip?.name]);

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

  // Live sharing: creates the Trip's linked collection, or returns the one it already has (sharing
  // again never makes a second). Others who open the link can Join the live Trip or Save a Copy.
  const shareLive = async () => {
    if (!trip || isSharingLive) return;
    const result = await sharedTripsStore.share(trip.id);
    if (!result.ok) {
      Alert.alert('Could not share this Trip', shareErrorMessage(result.error));
      return;
    }
    const { url } = result.value;
    const confirmation = liveShareConfirmation(result.value.created, url);
    Alert.alert(
      confirmation.title,
      confirmation.message,
      [
        { style: 'cancel', text: 'Done' },
        {
          onPress: () => {
            Share.share({ message: liveShareMessage(trip.name, url), title: trip.name, url }).catch(() => {
              Alert.alert('Unable to share this trip right now.');
            });
          },
          text: 'Share link',
        },
      ]
    );
  };

  // Stop sharing live: the old link stops working for new people; members, notes and Places stay.
  const stopSharingLive = () => {
    if (!trip || !sharedCollectionId || isSharingLive) return;
    const dialog = stopSharingConfirmation(trip.name);
    Alert.alert(dialog.title, dialog.message, [
      { style: 'cancel', text: dialog.cancelLabel },
      {
        onPress: () => {
          void sharedTripsStore.stopSharing(sharedCollectionId).then((result) => {
            if (!result.ok) Alert.alert('Could not stop sharing', linkErrorMessage(result.error, 'stop'));
          });
        },
        style: 'destructive',
        text: dialog.confirmLabel,
      },
    ]);
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
          ...(trip ? headerShareAction({ accessibilityLabel: 'Share Trip', onPress: () => Alert.alert('Share trip', undefined, [
              { style: 'cancel', text: 'Cancel' },
              { onPress: () => router.push({ pathname: '/trips/[tripId]/shared', params: { tripId: trip.id } }), text: 'Preview' },
              {
                // Two different things: a live Trip others join, or a copy they keep for themselves.
                onPress: () => Alert.alert('Share this Trip', undefined, [
                  { style: 'cancel', text: 'Cancel' },
                  { onPress: () => void (isPublicTripSharingEnabled() ? createPublicShare() : openShareSheet()), text: SHARE_CHOICES.copy.label },
                  { onPress: () => void shareLive(), text: SHARE_CHOICES.live(sharingActive).label },
                  ...(sharingActive ? [{ onPress: stopSharingLive, style: 'destructive' as const, text: SHARE_CHOICES.stop.label }] : []),
                ]),
                text: 'Share',
              },
            ]) }) : clearHeaderRightAction()),
          title: '',
        }}
      />

      {/* One full-screen indicator, and only when there is nothing to show: no Trips data yet,
          or this Trip is not known yet while a refresh might still find it. A known Trip
          renders at once and stays interactive while the focus refresh and the editorial
          cards load behind it. */}
      {view === 'loading' ? (
        <LoadingView />
      ) : view === 'notFound' || !trip || !selectedTripId ? (
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

          {sharingActive ? (
            <AppText accessibilityLabel="This Trip is shared live" color={Palette.textMuted} style={{ marginBottom: Space.xl, marginTop: -Space.lg }} variant="caption">
              Shared live: people with the link can join and add notes. They cannot change your Places.
            </AppText>
          ) : null}

          {tripImages.length > 0 ? (
            <TripImageCollage
              images={tripImages}
              onImageError={(image) => image.photoAssetId && personalPhotos.reportError(image.photoAssetId, image.url)}
              onImageRetry={(image) => image.photoAssetId && personalPhotos.retry(image.photoAssetId)}
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
              accessibilityLabel={isSearchingPlaces ? 'Close Place search' : 'Add places from Favourites or Search'}
              icon={isSearchingPlaces ? 'close' : 'add'}
              onPress={() => setIsSearchingPlaces((value) => !value)}
            />
          </View>

          {isSearchingPlaces ? <TripPlacePicker
            key={trip.id}
            tripId={trip.id}
            onClose={() => setIsSearchingPlaces(false)}
          /> : null}

          {placesFailed && orderedEntries.some((entry) => entry.type === 'editorialPlace') ? (
            <Text style={{ color: '#717171', fontSize: 16, marginBottom: Space.lg }}>
              Unable to load place details for this trip. Your entries and notes are still here.
            </Text>
          ) : null}
          {orderedEntries.length > 0 ? (
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
                  editorialPending={
                    placesPending &&
                    entry.type === 'editorialPlace' &&
                    !placesById.has(entry.editorialPlace.id)
                  }
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
              No places yet. Tap + to add from Favourites or search TripIdeas.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}
