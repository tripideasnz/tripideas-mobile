import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PlaceTripAction } from '@/components/place-card-actions';
import { PlaceCard } from '@/components/place-card';
import { PlaceSearch } from '@/components/place-search';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { ButtonRow } from '@/components/ui/button-row';
import { IconAction } from '@/components/ui/icon-action';
import { Palette, Screen, Space } from '@/constants/design';
import { useSavedPlaces } from '@/saved/provider';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { tripRequestDiagnostic } from '@/trips/error-diagnostic';
import { useMyTrips } from '@/trips/provider';
import type { PlaceCardData } from '@/types/content';

// This picker only supplies a destination to the existing Trip mutation.
export function TripPlacePicker({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const { addPlaceToTrip, removePlaceFromTrip, getTrip } = useMyTrips();
  const { savedPlaceIds, isLoading: loadingSaved } = useSavedPlaces();
  const [source, setSource] = useState<'search' | 'favourites'>('search');
  const [favourites, setFavourites] = useState<PlaceCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (source !== 'favourites' || loadingSaved) return;
    let active = true;
    setLoading(true);
    setLoadError(null);
    void fetchPlaceCardsByIds(savedPlaceIds)
      .then((places) => { if (active) setFavourites(places); })
      .catch(() => { if (active) setLoadError('Unable to load Favourites. Try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadingSaved, savedPlaceIds, source, retry]);

  const selectPlace = (place: PlaceCardData) => {
    const placeId = place._id;
    if (!placeId || pendingRef.current) return;
    const isMember = Boolean(getTrip(tripId)?.places.some((entry) => entry.placeId === placeId));
    pendingRef.current = true;
    const mutate = async () => {
      setAdding(true);
      setPendingPlaceId(placeId);
      setMessage(null);
      Keyboard.dismiss();
      try {
        if (isMember) await removePlaceFromTrip(tripId, placeId);
        else await addPlaceToTrip(tripId, placeId);
      } catch (error) {
        setMessage(`Could not ${isMember ? 'remove' : 'add'} this place${tripRequestDiagnostic(error)}. Check your connection and tap its Trip icon to retry.`);
      } finally {
        pendingRef.current = false;
        setAdding(false);
        setPendingPlaceId(null);
      }
    };
    if (isMember) {
      Alert.alert('Remove place from Trip?', `Remove "${place.title || 'Place'}" and its Trip note?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => { pendingRef.current = false; } },
        { text: 'Remove', style: 'destructive', onPress: () => void mutate() },
      ]);
    } else {
      void mutate();
    }
  };
  const getTripAction = (place: PlaceCardData): PlaceTripAction => ({
    isInTrip: Boolean(getTrip(tripId)?.places.some((entry) => entry.placeId === place._id)),
    isPending: pendingPlaceId === place._id,
    disabled: adding || !place._id,
    onPress: () => selectPlace(place),
  });
  const close = () => { if (!pendingRef.current) onClose(); };

  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
      <View style={{ paddingHorizontal: Screen.gutter, paddingTop: Screen.top, gap: Space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
          <AppText style={{ flex: 1 }} variant="section">Add places to Trip</AppText>
          <IconAction accessibilityLabel="Close Add places" icon="close" disabled={adding} onPress={close} />
        </View>
        <ButtonRow>
          <AppButton fitLabel label="Favourites" disabled={adding} variant={source === 'favourites' ? 'primary' : 'secondary'} onPress={() => setSource('favourites')} />
          <AppButton fitLabel label="Search TripIdeas" disabled={adding} variant={source === 'search' ? 'primary' : 'secondary'} onPress={() => setSource('search')} />
        </ButtonRow>
        <AppText color={message ? Palette.danger : Palette.textMuted} accessibilityLiveRegion="polite">
          {message || 'Use the Trip icon to add places. Tap a card to explore it.'}
        </AppText>
      </View>
      {source === 'search' ? <PlaceSearch scrollable disabled={adding} getTripAction={getTripAction} onOpenPlace={onClose} /> :
        <ScrollView keyboardDismissMode="on-drag" contentContainerStyle={{ padding: Screen.gutter }}>
          {loading || loadingSaved ? <AppText>Loading Favourites…</AppText> : loadError ? <View style={{ gap: Space.md }}>
            <AppText color={Palette.danger}>{loadError}</AppText>
            <AppButton label="Retry" onPress={() => setRetry((value) => value + 1)} />
          </View> : favourites.length ? favourites.map((place) => <PlaceCard
            key={place._id}
            place={place}
            disabled={adding}
            tripAction={getTripAction(place)}
            onOpenPlace={onClose}
          />) : <AppText color={Palette.textMuted}>No Favourites yet. Search TripIdeas to find places.</AppText>}
        </ScrollView>}
    </SafeAreaView>
  </Modal>;
}
