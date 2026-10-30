// A joined Shared Trip: the creator's live Trip with everyone's notes. The creator controls the
// Places; a participant reads them, adds their own notes and can leave.
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, Share, View } from 'react-native';

import { useSession } from '@/auth/provider';
import { SharedTripDetailView } from '@/components/shared-trip-detail-view';
import { SignedOutFeature } from '@/components/signed-out-feature';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Screen, Space } from '@/constants/design';
import { sharedTripsStore } from '@/shared-trips';
import { saveCopyOfSharedTrip } from '@/shared-trips/copy';
import { useCopyDependencies } from '@/shared-trips/use-copy-dependencies';
import { useSharedTripsState } from '@/shared-trips/use-shared-trips';
import {
  detailViewState,
  errorMessage,
  freshness,
  linkErrorMessage,
  membershipErrorMessage,
  reshareMessage,
  noteErrorMessage,
} from '@/shared-trips/view-model';
import { describeSaveFeedback, type SaveFeedback, type SaveMessage } from '@/trips/shared-trip-messages';
import { useTripPlaceCards } from '@/trips/use-trip-place-cards';

export default function SharedTripScreen() {
  const { collectionId: rawId } = useLocalSearchParams<{ collectionId?: string | string[] }>();
  const collectionId = (Array.isArray(rawId) ? rawId[0] : rawId) ?? '';
  const router = useRouter();
  const { isLoading: isLoadingSession, session, signIn } = useSession();
  const state = useSharedTripsState();
  const entry = state.details[collectionId];
  const view = detailViewState(entry);
  const detail = entry?.data ?? null;
  const copyDependencies = useCopyDependencies();
  const [copyMessage, setCopyMessage] = useState<SaveMessage | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharingBusy, setIsSharingBusy] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const copyingRef = useRef(false);
  const userId = session?.userId ?? null;

  // Opening, or coming back to, the Trip refreshes it so the creator's latest changes appear.
  useFocusEffect(
    useCallback(() => {
      if (userId && collectionId) void sharedTripsStore.loadDetail(collectionId, { force: true });
    }, [collectionId, userId])
  );
  const placeIds = useMemo(() => detail?.places.map((place) => place.placeId) ?? [], [detail?.places]);
  const { cards, isPending: cardsPending } = useTripPlaceCards(placeIds);
  const cardsById = useMemo(
    () => new Map(cards.filter((card) => card._id).map((card) => [card._id as string, card])),
    [cards]
  );

  const refresh = async () => {
    setIsRefreshing(true);
    await sharedTripsStore.loadDetail(collectionId, { force: true });
    setIsRefreshing(false);
  };

  const saveNote = (run: () => Promise<{ error?: never; ok: true } | { error: Parameters<typeof noteErrorMessage>[0]; ok: false }>) =>
    async () => {
      const result = await run();
      if (!result.ok) throw new Error(noteErrorMessage(result.error));
    };

  const leave = async () => {
    const result = await sharedTripsStore.leave(collectionId);
    if (result.ok) {
      router.replace('/trips');
      return;
    }
    Alert.alert('Could not leave this Trip', membershipErrorMessage('leaving', result.error));
  };

  // Passing the link on: the EXISTING link only (the server never turns sharing on for a member), and the
  // creator stays the owner. The link is requested on tap, so a stopped Trip shows its state, not a stale link.
  const reshare = async () => {
    if (!detail || isSharingBusy) return;
    setIsSharingBusy(true);
    setLinkMessage(null);
    try {
      const result = await sharedTripsStore.reshare(collectionId);
      if (!result.ok) {
        setLinkMessage(linkErrorMessage(result.error, 'reshare'));
        return;
      }
      await Share.share({ message: reshareMessage(detail.collection.title, result.value.url) });
    } catch {
      setLinkMessage('Could not open the share sheet. Please try again.');
    } finally {
      setIsSharingBusy(false);
    }
  };

  const stopSharing = async () => {
    if (isSharingBusy) return;
    setIsSharingBusy(true);
    setLinkMessage(null);
    try {
      const result = await sharedTripsStore.stopSharing(collectionId);
      if (!result.ok) setLinkMessage(linkErrorMessage(result.error, 'stop'));
    } finally {
      setIsSharingBusy(false);
    }
  };

  const saveCopy = async () => {
    if (!detail || copyingRef.current) return;
    copyingRef.current = true;
    setIsCopying(true);
    setCopyMessage(null);
    try {
      const outcome = await saveCopyOfSharedTrip(copyDependencies, { detail, mode: 'tap', userId });
      if (outcome.kind === 'saved') {
        router.push({ pathname: '/trips/[tripId]', params: { tripId: outcome.tripId } });
        return;
      }
      if (outcome.kind === 'needs-sign-in') {
        await signIn();
        return;
      }
      setCopyMessage(describeSaveFeedback(outcome as SaveFeedback));
    } finally {
      copyingRef.current = false;
      setIsCopying(false);
    }
  };

  const options = (
    <Stack.Screen
      options={{
        headerBackVisible: false,
        headerLeft: () => <HeaderBackButton color={Palette.trip} fallbackHref="/trips" />,
        title: '',
      }}
    />
  );

  if (isLoadingSession) return <LoadingView />;
  if (!session) {
    return (
      <>
        {options}
        <SignedOutFeature message="Sign in to open this Shared Trip" onSignIn={signIn} />
      </>
    );
  }

  const notice = (text: string, action?: { label: string; onPress: () => void }) => (
    <View style={{ backgroundColor: Palette.background, flex: 1, gap: Space.md, paddingHorizontal: Screen.gutter, paddingTop: Screen.top }}>
      {options}
      <AppText color={Palette.textMuted}>{text}</AppText>
      {action ? <AppButton label={action.label} onPress={action.onPress} size="compact" variant="secondary" /> : null}
    </View>
  );

  switch (view.kind) {
    case 'loading':
      return <>{options}<LoadingView /></>;
    case 'not-joined':
      return notice("You're no longer part of this Trip. Open its link again to rejoin.", {
        label: 'Back to Trips',
        onPress: () => router.replace('/trips'),
      });
    case 'gone':
      return notice('This Trip is no longer available. The creator may have deleted it.', {
        label: 'Back to Trips',
        onPress: () => router.replace('/trips'),
      });
    case 'sign-in':
      return <>{options}<SignedOutFeature message={errorMessage({ kind: 'session-expired' }, '')} onSignIn={signIn} /></>;
    case 'error':
      return notice(view.message, {
        label: 'Try again',
        onPress: () => void sharedTripsStore.loadDetail(collectionId, { force: true }),
      });
    default:
      break;
  }

  return (
    <>
      {options}
      <SharedTripDetailView
        cardsById={cardsById}
        cardsPending={cardsPending}
        copyMessage={copyMessage}
        detail={detail!}
        freshness={freshness(entry!)}
        handlers={{
          onDeletePlaceNote: (itemId) => saveNote(() => sharedTripsStore.deletePlaceNote(collectionId, itemId))(),
          onDeleteTripNote: saveNote(() => sharedTripsStore.deleteCollectionNote(collectionId)),
          onSavePlaceNote: (itemId, text) => saveNote(() => sharedTripsStore.savePlaceNote(collectionId, itemId, text))(),
          onSaveTripNote: (text) => saveNote(() => sharedTripsStore.saveCollectionNote(collectionId, text))(),
        }}
        isCopying={isCopying}
        isLeaving={state.membership[collectionId]?.action === 'leaving'}
        isSharingBusy={isSharingBusy}
        linkMessage={linkMessage}
        membershipMessage={
          state.membership[collectionId]?.error
            ? membershipErrorMessage('leaving', state.membership[collectionId].error!)
            : null
        }
        onLeave={() => void leave()}
        onOpenCopy={(tripId) => router.push({ pathname: '/trips/[tripId]', params: { tripId } })}
        onReshare={() => void reshare()}
        onSaveCopy={() => void saveCopy()}
        onStopSharing={() => void stopSharing()}
        refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={isRefreshing} tintColor={Palette.trip} />}
      />
    </>
  );
}
