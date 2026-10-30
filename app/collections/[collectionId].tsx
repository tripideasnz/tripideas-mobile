// A Shared Trip link opened in the app (/collections/<id>?user=<ownerId>&type=shared). Anyone can read
// the preview; the creator and members go straight to the live Trip. Join Trip follows the creator's
// Trip; Save a Copy makes a separate Trip of the recipient's own.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { useSession } from '@/auth/provider';
import { SharedTripPreviewView } from '@/components/shared-trip-preview-view';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Screen, Space } from '@/constants/design';
import { sharedTripsStore } from '@/shared-trips';
import {
  fetchCollectionPreview,
  fetchPublicPlaceNotes,
  fetchPublicTripNotes,
} from '@/shared-trips/api';
import { creatorNameFromPublicNotes } from '@/shared-trips/copy';
import { createPreviewActions, type PreviewActionsState } from '@/shared-trips/preview-actions';
import { useCopyDependencies } from '@/shared-trips/use-copy-dependencies';
import { useSharedTripsState } from '@/shared-trips/use-shared-trips';
import {
  ownerLabel,
  previewState,
  type PreviewLoad,
} from '@/shared-trips/view-model';
import type { CollectionPreview, PublicNote } from '@/shared-trips/types';
import { useTripPlaceCards } from '@/trips/use-trip-place-cards';

export default function SharedTripPreviewScreen() {
  const { collectionId: rawId } = useLocalSearchParams<{ collectionId?: string | string[] }>();
  const collectionId = (Array.isArray(rawId) ? rawId[0] : rawId) ?? '';
  const router = useRouter();
  const { session, signIn } = useSession();
  const userId = session?.userId ?? null;
  const store = useSharedTripsState();
  const copyDependencies = useCopyDependencies();

  const [load, setLoad] = useState<PreviewLoad>('loading');
  const [loadNonce, setLoadNonce] = useState(0);
  const [tripNotes, setTripNotes] = useState<PublicNote[]>([]);
  const [action, setAction] = useState<PreviewActionsState>({ busy: null, message: null });
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const previewRef = useRef<CollectionPreview | null>(null);
  const signInRef = useRef(signIn);
  signInRef.current = signIn;

  useEffect(() => {
    if (!collectionId) {
      setLoad({ status: 'not-found' });
      return;
    }
    let active = true;
    setLoad('loading');
    fetchCollectionPreview(collectionId)
      .then((preview) => active && setLoad({ preview, status: 'ok' }))
      .catch((error) => {
        if (active) setLoad({ status: (error as { status?: number })?.status === 404 ? 'not-found' : 'unavailable' });
      });
    // The creator's name and Trip note come from the existing public Trip notes (best effort).
    fetchPublicTripNotes(collectionId).then((notes) => active && setTripNotes(notes)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [collectionId, loadNonce]);

  // A signed-in visitor who has already joined (or created the Trip) is sent to the live Trip.
  useEffect(() => {
    if (userId && collectionId) void sharedTripsStore.loadDetail(collectionId);
  }, [collectionId, userId]);

  const access = store.details[collectionId]?.access;
  const state = previewState({ access, load, userId });
  useEffect(() => {
    if (state.kind === 'open-shared') router.replace({ pathname: '/shared-trips/[collectionId]', params: { collectionId } });
  }, [collectionId, router, state.kind]);

  const preview = typeof load === 'object' && load.status === 'ok' ? load.preview : null;
  previewRef.current = preview;
  const placeIds = useMemo(() => preview?.items.map((item) => item.placeId) ?? [], [preview]);
  const { cards, isPending: cardsPending } = useTripPlaceCards(placeIds);
  const cardsById = useMemo(
    () => new Map(cards.filter((card) => card._id).map((card) => [card._id as string, card])),
    [cards]
  );

  const actions = useMemo(
    () =>
      createPreviewActions({
        collectionId,
        copyDependencies,
        getPreview: () => previewRef.current,
        getUserId: () => userIdRef.current,
        join: (id) => sharedTripsStore.join(id),
        onChange: setAction,
        onJoined: () => router.replace({ pathname: '/shared-trips/[collectionId]', params: { collectionId } }),
        onSaved: (tripId) => router.replace({ pathname: '/trips/[tripId]', params: { tripId } }),
        readers: { fetchPlaceNotes: fetchPublicPlaceNotes, fetchTripNotes: fetchPublicTripNotes },
        signIn: () => signInRef.current(),
      }),
    [collectionId, copyDependencies, router]
  );
  // Sign-in finished while an action was waiting for it: continue that same action.
  useEffect(() => {
    actions.sessionChanged();
  }, [actions, userId]);

  const options = (
    <Stack.Screen
      options={{
        headerBackVisible: false,
        headerLeft: () => <HeaderBackButton fallbackHref="/" />,
        title: 'Shared Trip',
      }}
    />
  );
  const notice = (text: string, retry?: () => void) => (
    <View style={{ backgroundColor: Palette.background, flex: 1, gap: Space.md, paddingHorizontal: Screen.gutter, paddingTop: Screen.top }}>
      {options}
      <AppText color={Palette.textMuted}>{text}</AppText>
      {retry ? <AppButton label="Try again" onPress={retry} size="compact" variant="secondary" /> : null}
    </View>
  );

  if (state.kind === 'loading' || state.kind === 'open-shared' || !preview) {
    if (state.kind === 'not-found') {
      return notice('This shared trip could not be found. The link may be incorrect, or the trip may no longer be shared.');
    }
    if (state.kind === 'unavailable') {
      return notice('This shared trip could not be loaded right now.', () => setLoadNonce((value) => value + 1));
    }
    return <>{options}<LoadingView /></>;
  }

  return (
    <>
      {options}
      <SharedTripPreviewView
        cardsById={cardsById}
        cardsPending={cardsPending}
        creator={ownerLabel({ displayName: creatorNameFromPublicNotes(tripNotes, preview.ownerId) })}
        creatorNote={tripNotes.find((note) => note.authorId === preview.ownerId)?.text ?? null}
        isCopying={action.busy === 'copy'}
        isJoining={action.busy === 'join'}
        message={action.message}
        onJoin={() => void actions.join()}
        onOpenCopy={(tripId) => router.replace({ pathname: '/trips/[tripId]', params: { tripId } })}
        onSaveCopy={() => void actions.saveCopy()}
        placeIds={placeIds}
        signInHint={state.kind === 'preview' ? state.signInHint : null}
        title={preview.name}
      />
    </>
  );
}
