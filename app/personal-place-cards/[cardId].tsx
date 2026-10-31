import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { useSession } from '@/auth/provider';
import { PlaceDetailContent } from '@/components/place-detail-content';
import { PlaceMapPreview } from '@/components/place-map-preview';
import { SignedOutFeature } from '@/components/signed-out-feature';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput, AutoExpandingTextInput } from '@/components/ui/app-text-input';
import { AutosaveStatus } from '@/components/ui/autosave-status';
import { IconAction } from '@/components/ui/icon-action';
import { FinishEditAction } from '@/components/ui/finish-edit-action';
import { ContainedRemoveButton } from '@/components/ui/contained-remove-button';
import { backOrFallback, HeaderBackButton } from '@/components/ui/header-back-button';
import { ShowMoreText } from '@/components/ui/show-more-text';
import { StatusText } from '@/components/ui/status-text';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import { ApiError } from '@/lib/api-client';
import {
  PERSONAL_PLACE_AUTOSAVE_DELAY_MS,
  shouldAdoptPersonalPlaceAutosave,
} from '@/personal-place-cards/autosave';
import {
  personalPlaceCardError,
  readinessMessage,
} from '@/personal-place-cards/errors';
import {
  addPersonalPlaceCardPhoto,
  listPersonalPlaceCardPhotoPreviews,
  replacePersonalPlaceCardPhoto,
  retirePersonalPlaceCardPhotoIntent,
  resumePersonalPlaceCardPhotos,
  retryPersonalPlaceCardPhoto,
} from '@/personal-place-cards/photos';
import { personalPlaceBodyPhotoCount } from '@/personal-place-cards/photo-reconciliation';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import { usePersonalPhotos } from '@/personal-place-cards/use-personal-photos';
import type {
  PersonalPlaceCard,
  PersonalPlaceCardMedia,
} from '@/personal-place-cards/types';
import {
  pickPhotoForUpload,
  pickPhotosForUpload,
} from '@/photo-uploads/picker';
import { useMyTrips } from '@/trips/provider';
import { useLocateNow } from '@/location/use-locate-now';

type SaveState = 'failed' | 'idle' | 'saving';
type PendingPhotoPreview = {
  key: string;
  uri: string;
  state: 'uploading' | 'retryable-error';
};

// 'Added' and 'Add to Trip' are one control in two states, so they share one width (the longer label fits).
const TRIP_ACTION_WIDTH = 120;

export default function PersonalPlaceCardScreen() {
  const params = useLocalSearchParams<{
    cardId?: string | string[];
    date?: string | string[];
    diaryId?: string | string[];
    mode?: string | string[];
    origin?: string | string[];
    notebookId?: string | string[];
    tripId?: string | string[];
  }>();
  const cardId = Array.isArray(params.cardId) ? params.cardId[0] : params.cardId;
  const originDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const originDiaryId = Array.isArray(params.diaryId) ? params.diaryId[0] : params.diaryId;
  const initialMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const origin = Array.isArray(params.origin) ? params.origin[0] : params.origin;
  const originNotebookId = Array.isArray(params.notebookId) ? params.notebookId[0] : params.notebookId;
  const originTripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const router = useRouter();
  const personalPlaceFallback = origin === 'trip-map' && originTripId
    ? { pathname: '/trips/[tripId]/map' as const, params: { tripId: originTripId } }
    : origin === 'notebook' && originNotebookId
      ? { pathname: '/notebooks/[notebookId]' as const, params: { notebookId: originNotebookId } }
      : origin === 'diary' && originDiaryId && originDate
        ? { pathname: '/diaries/[diaryId]/day' as const, params: { diaryId: originDiaryId, date: originDate } }
        : '/personal-place-cards' as const;
  const backFromPersonalPlace = () => backOrFallback(router, personalPlaceFallback);
  const { isLoading: isLoadingSession, session, signIn } = useSession();
  const { get, load, mutate } = usePersonalPlaceCards();
  const { addPersonalCardToTrip, trips } = useMyTrips();
  const card = get(cardId);
  const cardMedia = card?.media;
  const [isEditing, setIsEditing] = useState(initialMode === 'edit');
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [pendingBodyPreviews, setPendingBodyPreviews] = useState<PendingPhotoPreview[]>([]);
  const [pendingMainPreview, setPendingMainPreview] = useState<string | null>(null);
  const initializedCardRef = useRef<string | null>(null);
  const titleRef = useRef('');
  const bodyRef = useRef('');
  const revisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const scrollRef = useRef<ScrollView>(null);
  const bodyYRef = useRef(0);
  const photosYRef = useRef(0);
  const { height: viewportHeight } = useWindowDimensions();

  const revealEditorObject = (contentY: number) => {
    const keyboardHeight = Keyboard.metrics()?.height ?? 0;
    const visibleHeight = Math.max(280, viewportHeight - keyboardHeight - 120);
    setTimeout(() => scrollRef.current?.scrollTo({ animated: true, y: Math.max(0, contentY - visibleHeight * 0.38) }), 120);
  };

  const refreshPendingBodyPreviews = useCallback(async () => {
    if (!session?.userId || !cardId) return;
    const authoritative = await load(cardId);
    const pending = await listPersonalPlaceCardPhotoPreviews(
      session.userId,
      authoritative
    );
    setPendingBodyPreviews(pending
      .filter(({ role }) => role === 'body')
      .map((item) => ({
        key: item.uploadId,
        uri: item.uri,
        state: item.state === 'RETRYABLE_ERROR' ? 'retryable-error' : 'uploading',
      })));
  }, [cardId, load, session?.userId]);

  useEffect(() => {
    setIsEditing(initialMode === 'edit');
    setIsEditingBody(false);
  }, [cardId, initialMode]);

  useEffect(() => {
    if (session && cardId) {
      void load(cardId).catch((error) => setMessage(personalPlaceCardError(error)));
    }
  }, [cardId, load, session]);

  useEffect(() => {
    if (!card) return;
    const isNewCard = initializedCardRef.current !== card.id;
    if (isNewCard || revisionRef.current === 0) {
      const nextTitle = card.title ?? '';
      const nextBody = card.body ?? '';
      titleRef.current = nextTitle;
      bodyRef.current = nextBody;
      setTitle(nextTitle);
      setBody(nextBody);
    }
    if (isNewCard) {
      initializedCardRef.current = card.id;
    }
  }, [card]);

  // Locate now: a fresh fix saves as before; an approximate (cached) position
  // is only saved after the user confirms it.
  const locateNow = useLocateNow({
    describeSaveError: personalPlaceCardError,
    save: (point) => mutate.update(cardId as string, {
      latitude: point.latitude,
      longitude: point.longitude,
      locationConfirmed: true,
      locationSource: 'USER_SELECTED',
    }),
  });

  // Private photos: shared authorisation cache, stable image cache keys, and
  // one automatic retry before a visible retry control is shown.
  const photos = usePersonalPhotos(
    (cardMedia ?? []).map((item) => item.photoAssetId),
    { maxAutoRetries: 1 }
  );

  useEffect(() => {
    if (session?.userId && cardId) {
      void refreshPendingBodyPreviews();
      void resumePersonalPlaceCardPhotos(
        session.userId,
        cardId,
        mutate.attachPhoto,
        load,
        mutate.removePhoto
      ).then(refreshPendingBodyPreviews);
    }
  }, [
    card?.version,
    cardId,
    load,
    mutate.attachPhoto,
    mutate.removePhoto,
    refreshPendingBodyPreviews,
    session?.userId,
  ]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (isLoadingSession) return <LoadingView />;
  if (!session) {
    return (
      <SignedOutFeature
        message="Sign in to view and edit your private Personal Places"
        onSignIn={signIn}
      />
    );
  }
  if (!card || !cardId) {
    return <StatusText>Loading Personal Place…</StatusText>;
  }

  const attachedTripIds = trips
    .filter((trip) => trip.entries?.some(
      (entry) =>
        entry.type === 'personalPlaceCard' &&
        'personalPlaceCard' in entry &&
        entry.personalPlaceCard.id === card.id
    ))
    .map((trip) => trip.id);
  const mainMedia = card.media.find((item) => item.role === 'main');
  const bodyMedia = card.media.filter((item) => item.role === 'body');

  const act = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await operation();
    } catch (error) {
      setMessage(personalPlaceCardError(error));
    } finally {
      setBusy(false);
    }
  };

  const saveMetadata = async (revision: number) => {
    const current = get(card.id);
    if (!current) return;
    const nextTitle = titleRef.current || null;
    const nextBody = bodyRef.current || null;
    if (nextTitle === current.title && nextBody === current.body) {
      if (shouldAdoptPersonalPlaceAutosave(revisionRef.current, revision)) {
        revisionRef.current = 0;
        setSaveState('idle');
      }
      return;
    }
    setSaveState('saving');
    setMessage(null);
    try {
      let latest: PersonalPlaceCard;
      try {
        latest = await mutate.update(card.id, { body: nextBody, title: nextTitle });
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'personal_place_card_conflict') {
          throw error;
        }
        await load(card.id);
        latest = await mutate.update(card.id, { body: nextBody, title: nextTitle });
      }
      if (shouldAdoptPersonalPlaceAutosave(revisionRef.current, revision)) {
        revisionRef.current = 0;
        titleRef.current = latest.title ?? '';
        bodyRef.current = latest.body ?? '';
        setTitle(titleRef.current);
        setBody(bodyRef.current);
        setSaveState('idle');
      }
    } catch (error) {
      setSaveState('failed');
      setMessage(personalPlaceCardError(error));
    }
  };

  const queueMetadataSave = (revision: number) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveMetadata(revision));
    return saveQueueRef.current;
  };

  const scheduleMetadataSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const revision = revisionRef.current;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void queueMetadataSave(revision);
    }, PERSONAL_PLACE_AUTOSAVE_DELAY_MS);
  };

  const updateDraft = (field: 'body' | 'title', value: string) => {
    if (field === 'title') {
      titleRef.current = value;
      setTitle(value);
    } else {
      bodyRef.current = value;
      setBody(value);
    }
    revisionRef.current += 1;
    setSaveState('saving');
    scheduleMetadataSave();
  };

  const finishEditing = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (revisionRef.current > 0) {
      await queueMetadataSave(revisionRef.current);
    }
    if (revisionRef.current === 0) setIsEditing(false);
  };

  const removePhoto = (media: PersonalPlaceCardMedia) =>
    act(async () => {
      if (session?.userId) {
        await retirePersonalPlaceCardPhotoIntent(
          session.userId,
          card.id,
          media.photoAssetId
        );
      }
      await mutate.removePhoto(card.id, media.id);
    });

  const replaceMainPhoto = () => {
    if (!mainMedia || !session?.userId) return;
    if (attachedTripIds.length > 0) {
      setMessage(
        'Remove this Place Card from its active Trips before replacing its required main photo.'
      );
      return;
    }
    void act(async () => {
      const selected = await pickPhotoForUpload();
      if (!selected) return;
      setPendingMainPreview(selected.uri);
      try {
        await replacePersonalPlaceCardPhoto(
          session.userId,
          card.id,
          mainMedia.id,
          'main',
          selected,
          mutate.attachPhoto,
          load,
          mutate.removePhoto
        );
      } finally {
        setPendingMainPreview(null);
      }
    });
  };

  if (!isEditing) {
    const heroPhoto = mainMedia ? photos.get(mainMedia.photoAssetId) : null;
    const galleryImages = bodyMedia.flatMap((media) => {
      const photo = photos.get(media.photoAssetId);
      return photo?.status === 'ready'
        ? [{ _key: media.id, alt: card.title ?? 'Personal Place photo', cacheKey: photo.cacheKey, url: photo.url }]
        : [];
    });
    const failedPhotoAssetIds = card.media
      .map((item) => item.photoAssetId)
      .filter((id) => photos.get(id)?.status === 'failed');
    return (
      <ScrollView style={{ flex: 1, backgroundColor: Palette.background }}>
        <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} onPress={backFromPersonalPlace} />, title: card.title || 'Personal Place' }} />
        <PlaceDetailContent
          body={card.body ? (
            <ShowMoreText accessibilityLabel="Personal Place description" value={card.body} />
          ) : undefined}
          galleryImages={galleryImages}
          galleryPosition="before-location"
          hero={heroPhoto?.status === 'ready' && mainMedia ? {
            alt: card.title ?? 'Personal Place main photo',
            cacheKey: heroPhoto.cacheKey,
            onError: () => photos.reportError(mainMedia.photoAssetId, heroPhoto.url),
            url: heroPhoto.url,
          } : null}
          onGalleryImageError={(image) => {
            const media = bodyMedia.find((item) => item.id === image._key);
            if (media) photos.reportError(media.photoAssetId, image.url);
          }}
          location={card.location ? {
            latitude: card.location.latitude,
            longitude: card.location.longitude,
          } : null}
          mapActions={card.location ? (
            <>
              <AppButton
                label="Show on Google Maps"
                onPress={() => void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${card.location!.latitude},${card.location!.longitude}`
                  )}`
                ).catch(() => setMessage('Unable to open maps right now.'))}
                style={{ marginTop: Space.md }}
              />
              <AppButton
                label="Show on TripIdeas.nz Map"
                onPress={() => router.navigate({
                  pathname: '/map',
                  params: {
                    lat: String(card.location!.latitude),
                    lng: String(card.location!.longitude),
                    title: card.title ?? 'Personal Place',
                    cardId: card.id,
                    origin: origin ?? 'personal-place',
                    notebookId: originNotebookId,
                    diaryId: originDiaryId,
                    date: originDate,
                    tripId: originTripId,
                  },
                })}
                style={{ marginTop: Space.md }}
                variant="secondary"
              />
            </>
          ) : undefined}
          title={card.title || 'Untitled Personal Place'}
          titleActions={(
            <IconAction
              accessibilityLabel="Edit Personal Place"
              icon="edit"
              semantic="edit"
              onPress={() => setIsEditing(true)}
            />
          )}>
          <View style={{ gap: Space.lg }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.xs }}>
              <MaterialIcons color={Palette.trip} name="place" size={18} />
              <AppText color={Palette.textMuted} variant="caption">Personal Place</AppText>
            </View>
            {failedPhotoAssetIds.length > 0 ? (
              <View style={{ alignItems: 'flex-start', gap: Space.sm }}>
                <StatusText>Some photos could not be loaded.</StatusText>
                <AppButton
                  label="Retry photos"
                  onPress={() => failedPhotoAssetIds.forEach((id) => photos.retry(id))}
                  size="compact"
                  variant="secondary"
                />
              </View>
            ) : null}
            {message ? <StatusText>{message}</StatusText> : null}
          </View>
        </PlaceDetailContent>
      </ScrollView>
    );
  }

  const mainPhoto = mainMedia ? photos.get(mainMedia.photoAssetId) : null;
  const remainingBodySlots = Math.max(0, 10 - bodyMedia.length - pendingBodyPreviews.length);
  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        gap: Space.lg,
        padding: Screen.gutter,
        paddingBottom: Screen.bottom,
      }}>
      <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} onPress={() => void finishEditing()} />, title: 'Edit Personal Place' }} />
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}>
        <View style={{ flex: 1 }}>
          <AutoExpandingTextInput
            accessibilityLabel="Personal Place title"
            maxLength={200}
            onChangeText={(value) => updateDraft('title', value)}
            placeholder="Title"
            textVariant="title"
            value={title}
          />
        </View>
        <FinishEditAction accessibilityLabel="Finish editing Personal Place" size="default" onPress={() => void finishEditing()} />
      </View>
      <View onLayout={(event) => { bodyYRef.current = event.nativeEvent.layout.y; }}>
      {isEditingBody ? (
        <AppTextInput
          accessibilityLabel="Personal Place description"
          autoFocus
          maxLength={10_000}
          multiline
          onBlur={() => setIsEditingBody(false)}
          onChangeText={(value) => updateDraft('body', value)}
          placeholder="Description"
          style={{ minHeight: 120, textAlignVertical: 'top' }}
          value={body}
        />
      ) : body ? (
        <Pressable
          accessibilityHint="Enters text editing mode."
          accessibilityLabel="Edit Personal Place description"
          accessibilityRole="button"
          onPress={() => { setIsEditingBody(true); revealEditorObject(bodyYRef.current); }}
          style={{ borderColor: Palette.border, borderRadius: Radius.control, borderWidth: 1, padding: Space.md }}>
          <ShowMoreText accessibilityLabel="Personal Place description" value={body} />
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel="Add Personal Place description"
          accessibilityRole="button"
          onPress={() => { setIsEditingBody(true); revealEditorObject(bodyYRef.current); }}
          style={{ borderColor: Palette.border, borderRadius: Radius.control, borderWidth: 1, padding: Space.md }}>
          <AppText color={Palette.textMuted}>Description</AppText>
        </Pressable>
      )}
      </View>
      <AutosaveStatus
        accessibilityLabel="Personal Place text"
        onRetry={() => void queueMetadataSave(revisionRef.current)}
        state={saveState}
      />

      <AppText variant="section">Location</AppText>
      {/* In these two button rows the primary button carries a 1 pt border in its own colour, like the outlined one beside it, so the two share the row exactly (a border-less button is 2 pt narrower under flex). */}
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <AppButton
          disabled={locateNow.isBusy}
          label={locateNow.state.kind === 'saving' ? 'Saving…' : locateNow.isBusy ? 'Locating…' : 'Locate now'}
          onPress={() => void locateNow.locate()}
          style={{ borderColor: Palette.primary, borderWidth: 1, flex: 1 }}
        />
        <AppButton label="Locate on map" onPress={() => router.push({ pathname: '/personal-place-cards/location-picker', params: {
          cardId: card.id,
          latitude: card.location ? String(card.location.latitude) : undefined,
          longitude: card.location ? String(card.location.longitude) : undefined,
          origin,
          notebookId: originNotebookId,
          tripId: originTripId,
        } })} style={{ flex: 1 }} variant="secondary" />
      </View>
      {locateNow.status ? (
        <View style={{ gap: Space.sm }}>
          <AppText
            accessibilityLiveRegion="polite"
            color={locateNow.status.tone === 'danger' ? Palette.danger : locateNow.status.tone === 'success' ? Palette.success : Palette.textMuted}
            variant="caption">
            {locateNow.status.text}
          </AppText>
          {locateNow.state.kind === 'confirm-approximate' ? (
            <View style={{ flexDirection: 'row', gap: Space.sm }}>
              <AppButton label="Save this location" onPress={() => void locateNow.confirmApproximate()} size="compact" />
              <AppButton label="Not now" onPress={locateNow.dismiss} size="compact" variant="secondary" />
            </View>
          ) : null}
          {locateNow.status.needsSettings ? (
            <View style={{ alignItems: 'flex-start' }}>
              <AppButton label="Open Settings" onPress={() => void Linking.openSettings()} size="compact" variant="secondary" />
            </View>
          ) : null}
        </View>
      ) : null}
      {card.location ? (
        <PlaceMapPreview
          latitude={card.location.latitude}
          longitude={card.location.longitude}
          title={title || 'Personal Place'}
        />
      ) : null}

      <View
        onLayout={(event) => { photosYRef.current = event.nativeEvent.layout.y; }}
        style={{ gap: Space.md }}>
        <AppText variant="section">Photos</AppText>
        {/* Both photo actions share one row, built exactly like the Location row above: the same button size, equal widths, primary on the left, outlined on the right. */}
        <View style={{ flexDirection: 'row', gap: Space.sm }}>
          <AppButton
            disabled={busy}
            label={mainMedia ? 'Change main photo' : 'Add main photo'}
            style={{ borderColor: Palette.primary, borderWidth: 1, flex: 1 }}
            onPress={mainMedia ? replaceMainPhoto : () => void act(async () => {
              const selected = await pickPhotoForUpload();
              if (!selected || !session?.userId) return;
              revealEditorObject(photosYRef.current);
              setPendingMainPreview(selected.uri);
              try {
                await addPersonalPlaceCardPhoto(
                  session.userId,
                  card.id,
                  'main',
                  selected,
                  mutate.attachPhoto,
                  load
                );
              } finally {
                setPendingMainPreview(null);
              }
            })}
          />
          <AppButton
            disabled={busy || remainingBodySlots === 0}
            label="Add body photos"
            style={{ flex: 1 }}
            variant="secondary"
            onPress={() => void act(async () => {
              if (!session?.userId) return;
              const selected = await pickPhotosForUpload(remainingBodySlots);
              if (selected.length) revealEditorObject(photosYRef.current);
              const selectedSlots = selected.map((photo, index) => ({
                key: `selection:${Date.now()}:${index}`,
                uri: photo.uri,
                state: 'uploading' as const,
              }));
              setPendingBodyPreviews((current) => [...current, ...selectedSlots]);
              for (const [index, photo] of selected.entries()) {
                const slot = selectedSlots[index];
                try {
                  const uploaded = await addPersonalPlaceCardPhoto(
                    session.userId,
                    card.id,
                    'body',
                    photo,
                    mutate.attachPhoto,
                    load
                  );
                  if (!uploaded) throw new Error('Photo upload remains incomplete.');
                  setPendingBodyPreviews((current) => current.filter(
                    ({ key }) => key !== slot.key
                  ));
                } catch {
                  await refreshPendingBodyPreviews();
                }
              }
            })}
          />
        </View>
        {mainMedia ? (
        pendingMainPreview || mainPhoto?.status === 'ready' ? (
          <PhotoEditorTile
            accessibilityLabel="Replace main photo"
            cacheKey={pendingMainPreview ? undefined : mainPhoto?.cacheKey}
            imageUrl={pendingMainPreview ?? (mainPhoto?.url as string)}
            onError={pendingMainPreview ? undefined : () => photos.reportError(mainMedia.photoAssetId, mainPhoto?.url)}
            onPress={replaceMainPhoto}
            onRemove={() => void removePhoto(mainMedia)}
            wide
          />
        ) : mainPhoto?.status === 'failed' ? (
          <PhotoFailedTile
            label="Main photo could not be loaded."
            onRemove={() => void removePhoto(mainMedia)}
            onRetry={() => photos.retry(mainMedia.photoAssetId)}
            removeLabel="Remove main photo"
            wide
          />
        ) : (
          <StatusText>Loading main photo…</StatusText>
        )
      ) : pendingMainPreview ? (
        <View style={{ gap: Space.sm }}>
          <Image
            accessibilityLabel="Uploading main photo"
            contentFit="cover"
            source={{ uri: pendingMainPreview }}
            style={{ aspectRatio: 16 / 9, borderRadius: Radius.card, width: '100%' }}
          />
          <StatusText>Uploading main photo…</StatusText>
        </View>
      ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {bodyMedia.map((media, index) => (
          <View
            key={media.id}
            style={{
              aspectRatio: 1,
              backgroundColor: Palette.surfaceMuted,
              borderRadius: Radius.card,
              overflow: 'hidden',
              width: '48%',
            }}>
            {(() => {
              const photo = photos.get(media.photoAssetId);
              if (photo?.status === 'ready') {
                return (
                  <Image
                    accessibilityLabel={`Body photo ${index + 1}`}
                    contentFit="cover"
                    onError={() => photos.reportError(media.photoAssetId, photo.url)}
                    source={{ cacheKey: photo.cacheKey, uri: photo.url }}
                    style={{ height: '100%', width: '100%' }}
                  />
                );
              }
              if (photo?.status === 'failed') {
                return (
                  <View style={{ alignItems: 'center', flex: 1, gap: Space.sm, justifyContent: 'center', padding: Space.sm }}>
                    <AppText color={Palette.danger} variant="caption">Photo could not be loaded</AppText>
                    <AppButton
                      label="Try again"
                      onPress={() => photos.retry(media.photoAssetId)}
                      size="compact"
                      variant="secondary"
                    />
                  </View>
                );
              }
              return (
                <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', padding: Space.sm }}>
                  <StatusText>Loading photo…</StatusText>
                </View>
              );
            })()}
            <View style={{ position: 'absolute', right: Space.sm, top: Space.sm }}>
              <ContainedRemoveButton
                label={`Remove body photo ${index + 1}`}
                onPress={() => void removePhoto(media)}
              />
            </View>
          </View>
        ))}
        {pendingBodyPreviews.map((preview, index) => (
          <View
            key={preview.key}
            style={{
              aspectRatio: 1,
              backgroundColor: Palette.surfaceMuted,
              borderRadius: Radius.card,
              overflow: 'hidden',
              width: '48%',
            }}>
            <Image
              accessibilityLabel={`Pending body photo ${bodyMedia.length + index + 1}`}
              contentFit="cover"
              source={{ uri: preview.uri }}
              style={{ height: '100%', opacity: 0.62, width: '100%' }}
            />
            <View style={{
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.72)',
              bottom: 0,
              justifyContent: 'center',
              left: 0,
              padding: Space.sm,
              position: 'absolute',
              right: 0,
              top: 0,
            }}>
              <AppText
                color={preview.state === 'retryable-error' ? Palette.danger : Palette.textMuted}
                variant="caption">
                {preview.state === 'retryable-error' ? 'Photo failed to upload' : 'Uploading…'}
              </AppText>
              {preview.state === 'retryable-error' ? (
                <AppButton
                  label="Try again"
                  size="compact"
                  variant="secondary"
                  onPress={() => {
                    if (!session?.userId) return;
                    void act(async () => {
                      await retryPersonalPlaceCardPhoto(
                        session.userId!,
                        card.id,
                        preview.key,
                        mutate.attachPhoto,
                        load,
                        mutate.removePhoto
                      );
                      await refreshPendingBodyPreviews();
                    });
                  }}
                />
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <AppText color={Palette.textMuted} variant="caption">
        {personalPlaceBodyPhotoCount(bodyMedia.length, pendingBodyPreviews.length)} of 10 body photos
      </AppText>

      <AppText color={Palette.textMuted}>
        {card.readiness.isTripIdeaReady
          ? 'Ready to add to Trips.'
          : readinessMessage(card.readiness.readinessIssues)}
      </AppText>
      {card.readiness.isTripIdeaReady ? trips.map((trip) => {
        const attached = attachedTripIds.includes(trip.id);
        return (
          <View
            key={trip.id}
            style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}>
            <Text style={{ flex: 1, ...Type.body }}>{trip.name}</Text>
            <AppButton
              disabled={attached || busy}
              label={attached ? 'Added' : 'Add to Trip'}
              size="compact"
              onPress={() => void act(() => addPersonalCardToTrip(trip.id, card.id))}
              style={{ width: TRIP_ACTION_WIDTH }}
              variant="secondary"
            />
          </View>
        );
      }) : null}
      {message ? <StatusText>{message}</StatusText> : null}
    </ScrollView>
  );
}

function PhotoFailedTile({
  label,
  onRemove,
  onRetry,
  removeLabel,
  wide = false,
}: {
  label: string;
  onRemove: () => void;
  onRetry: () => void;
  removeLabel: string;
  wide?: boolean;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        aspectRatio: wide ? 16 / 9 : 1,
        backgroundColor: Palette.surfaceMuted,
        borderRadius: Radius.card,
        gap: Space.sm,
        justifyContent: 'center',
        padding: Space.md,
        position: 'relative',
        width: '100%',
      }}>
      <AppText color={Palette.danger} variant="caption">{label}</AppText>
      <AppButton label="Try again" onPress={onRetry} size="compact" variant="secondary" />
      <View style={{ bottom: Space.sm, position: 'absolute', right: Space.sm }}>
        <ContainedRemoveButton label={removeLabel} onPress={onRemove} />
      </View>
    </View>
  );
}

function PhotoEditorTile({
  accessibilityLabel,
  cacheKey,
  imageUrl,
  onError,
  onPress,
  onRemove,
  wide = false,
}: {
  accessibilityLabel: string;
  cacheKey?: string;
  imageUrl: string;
  onError?: () => void;
  onPress?: () => void;
  onRemove: () => void;
  wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={onPress ? 'button' : 'image'}
      disabled={!onPress}
      onPress={onPress}
      style={{ position: 'relative' }}>
      <Image
        contentFit="cover"
        onError={onError}
        source={cacheKey ? { cacheKey, uri: imageUrl } : { uri: imageUrl }}
        style={{
          aspectRatio: wide ? 16 / 9 : 1,
          borderRadius: Radius.card,
          width: '100%',
        }}
        transition={150}
      />
      <View style={{ bottom: Space.sm, position: 'absolute', right: Space.sm }}>
        <ContainedRemoveButton label={`Remove ${accessibilityLabel.toLowerCase()}`} onPress={onRemove} />
      </View>
    </Pressable>
  );
}
