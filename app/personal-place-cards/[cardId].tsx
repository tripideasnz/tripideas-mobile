import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { useSession } from '@/auth/provider';
import { PlaceDetailContent } from '@/components/place-detail-content';
import { PlaceMapPreview } from '@/components/place-map-preview';
import { PlacePhotoGrid } from '@/components/place-photo-grid';
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
import { authorizePhotoRead } from '@/notebooks/api';
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
  resumePersonalPlaceCardPhotos,
} from '@/personal-place-cards/photos';
import { failedPhotoUploadMessage } from '@/personal-place-cards/photo-status';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import type {
  PersonalPlaceCard,
  PersonalPlaceCardMedia,
} from '@/personal-place-cards/types';
import {
  pickPhotoForUpload,
  pickPhotosForUpload,
} from '@/photo-uploads/picker';
import { useMyTrips } from '@/trips/provider';
import { getOneForegroundLocation } from '@/location/foreground';

type SaveState = 'failed' | 'idle' | 'saving';
type PendingPhotoPreview = {
  key: string;
  uri: string | null;
  state: 'uploading' | 'retryable-error' | 'error';
};

const pendingPhotoPreviewState = (state: string): PendingPhotoPreview['state'] =>
  state === 'RETRYABLE_ERROR'
    ? 'retryable-error'
    : state === 'PERMANENT_ERROR'
      ? 'error'
      : 'uploading';

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
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (!cardMedia) return;
    let mounted = true;
    void Promise.all(cardMedia.map(async (item) => {
      try {
        const authorization = await authorizePhotoRead(item.photoAssetId);
        return [item.id, authorization.url] as const;
      } catch {
        return null;
      }
    })).then((results) => {
      if (mounted) {
        setPhotoUrls(Object.fromEntries(
          results.filter(Boolean) as [string, string][]
        ));
      }
    });
    return () => { mounted = false; };
  }, [cardMedia]);

  useEffect(() => {
    if (session?.userId && cardId) {
      const loadPendingPreviews = () => listPersonalPlaceCardPhotoPreviews(
        session.userId,
        cardId
      ).then((pending) => setPendingBodyPreviews(
        pending
          .filter(({ role }) => role === 'body')
          .map((item) => ({
            key: item.uploadId,
            uri: item.uri,
            state: pendingPhotoPreviewState(item.state),
          }))
      ));
      void loadPendingPreviews();
      void resumePersonalPlaceCardPhotos(
        session.userId,
        cardId,
        mutate.attachPhoto,
        load,
        mutate.removePhoto
      ).then(loadPendingPreviews);
    }
  }, [cardId, load, mutate.attachPhoto, mutate.removePhoto, session?.userId]);

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
    act(() => mutate.removePhoto(card.id, media.id));

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
    const heroUrl = mainMedia ? photoUrls[mainMedia.id] : null;
    const galleryImages = bodyMedia.flatMap((media) => {
      const url = photoUrls[media.id];
      return url ? [{ _key: media.id, alt: card.title ?? 'Personal Place photo', url }] : [];
    });
    return (
      <ScrollView style={{ flex: 1, backgroundColor: Palette.background }}>
        <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} onPress={backFromPersonalPlace} />, title: card.title || 'Personal Place' }} />
        <PlaceDetailContent
          body={card.body ? (
            <ShowMoreText accessibilityLabel="Personal Place description" value={card.body} />
          ) : undefined}
          galleryImages={galleryImages}
          galleryPosition="before-location"
          hero={heroUrl ? {
            alt: card.title ?? 'Personal Place main photo',
            url: heroUrl,
          } : null}
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
            {message ? <StatusText>{message}</StatusText> : null}
          </View>
        </PlaceDetailContent>
      </ScrollView>
    );
  }

  const mainPreviewUrl = pendingMainPreview ?? (mainMedia ? photoUrls[mainMedia.id] : null);
  const failedBodyPhotoCount = pendingBodyPreviews.filter(
    ({ state }) => state !== 'uploading'
  ).length;
  const hasRetryableBodyPhotos = pendingBodyPreviews.some(
    ({ state }) => state === 'retryable-error'
  );
  const bodyPhotoFailureMessage = failedPhotoUploadMessage(failedBodyPhotoCount);
  const remainingBodySlots = Math.max(
    0,
    10 - bodyMedia.length - pendingBodyPreviews.length
  );
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
      <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} onPress={backFromPersonalPlace} />, title: 'Edit Personal Place' }} />
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        <AppText style={{ flex: 1 }} variant="title">Edit Personal Place</AppText>
        <FinishEditAction accessibilityLabel="Finish editing Personal Place" size="default" onPress={() => void finishEditing()} />
      </View>

      <AutoExpandingTextInput
        accessibilityLabel="Personal Place title"
        maxLength={200}
        onChangeText={(value) => updateDraft('title', value)}
        placeholder="Title"
        textVariant="title"
        value={title}
      />
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
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <AppButton label="Locate now" onPress={() => void getOneForegroundLocation().then((result) => {
          if (result.status !== 'granted') {
            setMessage('Location is unavailable. You can still locate this Place on the map.');
            return;
          }
          void act(() => mutate.update(card.id, {
            latitude: result.point.latitude,
            longitude: result.point.longitude,
            locationConfirmed: true,
            locationSource: 'USER_SELECTED',
          }));
        })} style={{ flex: 1 }} />
        <AppButton label="Locate on map" onPress={() => router.push({ pathname: '/personal-place-cards/location-picker', params: {
          cardId: card.id,
          latitude: card.location ? String(card.location.latitude) : undefined,
          longitude: card.location ? String(card.location.longitude) : undefined,
          origin,
          notebookId: originNotebookId,
          tripId: originTripId,
        } })} style={{ flex: 1 }} variant="secondary" />
      </View>
      {card.location ? (
        <PlaceMapPreview
          latitude={card.location.latitude}
          longitude={card.location.longitude}
          title={title || 'Personal Place'}
        />
      ) : null}

      <View onLayout={(event) => { photosYRef.current = event.nativeEvent.layout.y; }}><AppText variant="section">Main photo</AppText>
      {mainMedia ? (
        mainPreviewUrl ? (
          <PhotoEditorTile
            accessibilityLabel="Replace main photo"
            imageUrl={mainPreviewUrl}
            onPress={replaceMainPhoto}
            onRemove={() => void removePhoto(mainMedia)}
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
      ) : (
        <AppButton
          disabled={busy}
          label="Add main photo"
          onPress={() => void act(async () => {
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
      )}</View>

      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        <AppText style={{ flex: 1 }} variant="section">Body photos</AppText>
        <AppButton
          disabled={busy || remainingBodySlots === 0}
          label="Add photos"
          size="compact"
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
                setPendingBodyPreviews((current) => current.map((item) => (
                  item.key === slot.key ? { ...item, state: 'retryable-error' } : item
                )));
              }
            }
          })}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {pendingBodyPreviews.map((preview) => (
          <View key={preview.key} style={{ opacity: 0.65, width: '48%' }}>
            {preview.uri ? (
              <Image
                accessibilityLabel="Pending body photo"
                contentFit="cover"
                source={{ uri: preview.uri }}
                style={{ aspectRatio: 1, borderRadius: Radius.card, width: '100%' }}
              />
            ) : null}
            {preview.state === 'uploading' ? <StatusText>Uploading…</StatusText> : null}
          </View>
        ))}
      </View>
      <PlacePhotoGrid
        bottomMargin={0}
        images={bodyMedia.flatMap((media) => photoUrls[media.id] ? [{
          _key: media.id,
          alt: `Body photo ${(media.position ?? 0) + 1}`,
          url: photoUrls[media.id],
        }] : [])}
        onRemoveImage={(image) => {
          const media = bodyMedia.find((item) => item.id === image._key);
          if (media) void removePhoto(media);
        }}
        placeTitle={title || 'Personal Place'}
      />
      <AppText color={Palette.textMuted} variant="caption">
        {bodyMedia.length} of 10 body photos
      </AppText>
      {bodyPhotoFailureMessage ? (
        <View style={{ gap: Space.sm }}>
          <AppText color={Palette.danger}>{bodyPhotoFailureMessage}</AppText>
          {hasRetryableBodyPhotos ? <AppButton
            label="Try again"
            size="compact"
            variant="secondary"
            onPress={() => {
              if (!session?.userId) return;
              void resumePersonalPlaceCardPhotos(
                session.userId,
                card.id,
                mutate.attachPhoto,
                load,
                mutate.removePhoto
              ).then(() => listPersonalPlaceCardPhotoPreviews(session.userId!, card.id))
                .then((pending) => setPendingBodyPreviews(
                  pending.filter(({ role }) => role === 'body').map((item) => ({
                    key: item.uploadId,
                    uri: item.uri,
                    state: pendingPhotoPreviewState(item.state),
                  }))
                ));
            }}
          /> : null}
        </View>
      ) : null}

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
              variant="secondary"
            />
          </View>
        );
      }) : null}
      {message ? <StatusText>{message}</StatusText> : null}
    </ScrollView>
  );
}

function PhotoEditorTile({
  accessibilityLabel,
  imageUrl,
  onPress,
  onRemove,
  wide = false,
}: {
  accessibilityLabel: string;
  imageUrl: string;
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
        source={{ uri: imageUrl }}
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
