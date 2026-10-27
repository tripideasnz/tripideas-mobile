// B2: a shared Trip opened in the app. Readable without signing in; Save to My Trips signs in
// if needed and saves a new, independent Trip through the B1 import endpoint.
import * as Crypto from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { SharedTripView } from '@/components/shared-trip-view';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Screen, Space } from '@/constants/design';
import { useSession } from '@/auth/provider';
import { checkApiCapability } from '@/lib/api-compatibility';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { importSharedTripRequest, listTripSummaries } from '@/trips/api';
import { useMyTrips } from '@/trips/provider';
import { createAsyncStorageAttemptStore } from '@/trips/shared-trip-attempts';
import { describeSaveFeedback, type SaveFeedback } from '@/trips/shared-trip-messages';
import {
  IMPORT_CAPABILITY,
  saveSharedTrip,
  type SaveDependencies,
} from '@/trips/shared-trip-save';
import {
  fetchSharedTrip,
  normalizeShareId,
  type SharedTripLoad,
} from '@/trips/shared-trip';
import type { PlaceCardData } from '@/types/content';

const attemptStore = createAsyncStorageAttemptStore();

export default function SharedTripScreen() {
  const { shareId: rawShareId } = useLocalSearchParams<{ shareId?: string | string[] }>();
  const shareId = normalizeShareId(rawShareId);
  const router = useRouter();
  const { session, signIn } = useSession();
  const { refreshAfterServerChange } = useMyTrips();

  const [load, setLoad] = useState<SharedTripLoad | 'loading'>(
    shareId ? 'loading' : { status: 'not-found' }
  );
  const [loadNonce, setLoadNonce] = useState(0);
  const [placeCards, setPlaceCards] = useState<PlaceCardData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null);

  const userIdRef = useRef<string | null>(null);
  userIdRef.current = session?.userId ?? null;
  const refreshRef = useRef(refreshAfterServerChange);
  refreshRef.current = refreshAfterServerChange;
  // Set while the WorkOS sign-in is open for a Save; the session arriving continues it.
  const awaitingSignInRef = useRef(false);

  useEffect(() => {
    if (!shareId) return;
    let active = true;
    setLoad('loading');
    void fetchSharedTrip(shareId).then((result) => {
      if (active) setLoad(result);
    });
    return () => {
      active = false;
    };
  }, [shareId, loadNonce]);

  const trip = typeof load === 'object' && load.status === 'ok' ? load.trip : null;
  const placeIdsKey = trip?.places.map((place) => place.placeId).join('|') ?? '';

  useEffect(() => {
    if (!trip || trip.places.length === 0) {
      setPlaceCards([]);
      return;
    }
    let active = true;
    fetchPlaceCardsByIds(trip.places.map((place) => place.placeId))
      .then((cards) => active && setPlaceCards(cards))
      // The snapshot still shows each Place by its own title if the cards cannot load.
      .catch(() => active && setPlaceCards([]));
    return () => {
      active = false;
    };
    // The Place list is stable for a loaded snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeIdsKey]);

  const dependencies = useMemo<SaveDependencies>(
    () => ({
      checkCapability: () => checkApiCapability(IMPORT_CAPABILITY),
      importTrip: importSharedTripRequest,
      listOwnTripIds: async () => (await listTripSummaries()).map((summary) => summary.id),
      newId: () => Crypto.randomUUID(),
      now: () => Date.now(),
      refreshTrips: () => refreshRef.current(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      store: attemptStore,
    }),
    []
  );

  const openTrip = useCallback(
    (tripId: string) => {
      router.replace({ pathname: '/trips/[tripId]', params: { tripId } });
    },
    [router]
  );

  const run = useCallback(
    async (mode: 'resume' | 'tap') => {
      if (!shareId || !trip) return;
      if (mode === 'tap') {
        setIsSaving(true);
        setFeedback(null);
      }
      const outcome = await saveSharedTrip(dependencies, {
        mode,
        shareId,
        trip,
        userId: userIdRef.current,
      });
      if (outcome.kind === 'nothing-pending') {
        setIsSaving(false);
        return;
      }
      if (outcome.kind === 'saved') {
        setIsSaving(false);
        openTrip(outcome.tripId);
        return;
      }
      if (outcome.kind === 'needs-sign-in') {
        awaitingSignInRef.current = true;
        setIsSaving(true);
        const signedIn = await signIn();
        if (!signedIn) {
          awaitingSignInRef.current = false;
          setIsSaving(false);
          setFeedback({ kind: 'sign-in-cancelled' });
        }
        return;
      }
      setIsSaving(false);
      setFeedback(outcome);
    },
    [dependencies, openTrip, shareId, signIn, trip]
  );

  // Sign-in finished while this screen was waiting: continue the same Save (same attempt ID).
  useEffect(() => {
    if (awaitingSignInRef.current && session?.userId) {
      awaitingSignInRef.current = false;
      void run('tap');
    }
  }, [run, session?.userId]);

  // After a remount (sign-in round trip, app restart) pick up an unfinished attempt.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !trip || !session?.userId) return;
    resumedRef.current = true;
    void run('resume');
  }, [run, session?.userId, trip]);

  const message = feedback ? describeSaveFeedback(feedback) : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Shared Trip' }} />
      {load === 'loading' ? (
        <LoadingView />
      ) : trip ? (
        <SharedTripView
          isSaving={isSaving}
          message={message}
          onOpenSavedTrip={(tripId) => {
            void refreshAfterServerChange().finally(() => openTrip(tripId));
          }}
          onSave={() => void run('tap')}
          placeCards={placeCards}
          trip={trip}
        />
      ) : (
        <View
          style={{
            backgroundColor: Palette.background,
            flex: 1,
            gap: Space.md,
            paddingHorizontal: Screen.gutter,
            paddingTop: Screen.top,
          }}>
          <AppText color={Palette.textMuted}>
            {load.status === 'not-found'
              ? 'This shared trip could not be found. The link may be incorrect, or the trip may no longer be shared.'
              : 'This shared trip could not be loaded right now.'}
          </AppText>
          {load.status === 'unavailable' ? (
            <AppButton
              label="Try again"
              onPress={() => setLoadNonce((value) => value + 1)}
              size="compact"
              variant="secondary"
            />
          ) : null}
        </View>
      )}
    </>
  );
}
