import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useSession } from '@/auth/provider';
import { PlaceDetailContent } from '@/components/place-detail-content';
import { PlaceMapPreview } from '@/components/place-map-preview';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { AutosaveStatus } from '@/components/ui/autosave-status';
import { IconAction } from '@/components/ui/icon-action';
import { StatusText } from '@/components/ui/status-text';
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
import { parsePersonalPlaceCardCoordinates } from '@/personal-place-cards/location';
import {
  addPersonalPlaceCardPhoto,
  replacePersonalPlaceCardPhoto,
  resumePersonalPlaceCardPhotos,
} from '@/personal-place-cards/photos';
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

type SaveState = 'failed' | 'idle' | 'saving';

export default function PersonalPlaceCardScreen() {
  const params = useLocalSearchParams<{
    cardId?: string | string[];
    mode?: string | string[];
  }>();
  const cardId = Array.isArray(params.cardId) ? params.cardId[0] : params.cardId;
  const initialMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const router = useRouter();
  const { session } = useSession();
  const { get, load, mutate } = usePersonalPlaceCards();
  const { addPersonalCardToTrip, trips } = useMyTrips();
  const card = get(cardId);
  const cardMedia = card?.media;
  const [isEditing, setIsEditing] = useState(initialMode === 'edit');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [pendingBodyPreviews, setPendingBodyPreviews] = useState<string[]>([]);
  const [pendingMainPreview, setPendingMainPreview] = useState<string | null>(null);
  const initializedCardRef = useRef<string | null>(null);
  const titleRef = useRef('');
  const bodyRef = useRef('');
  const revisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (cardId) {
      void load(cardId).catch((error) => setMessage(personalPlaceCardError(error)));
    }
  }, [cardId, load]);

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
      setLatitude(card.location ? String(card.location.latitude) : '');
      setLongitude(card.location ? String(card.location.longitude) : '');
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
      void resumePersonalPlaceCardPhotos(
        session.userId,
        cardId,
        mutate.attachPhoto,
        load,
        mutate.removePhoto
      );
    }
  }, [cardId, load, mutate.attachPhoto, mutate.removePhoto, session?.userId]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

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
  const coordinates = parsePersonalPlaceCardCoordinates(latitude, longitude);
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
        <Stack.Screen options={{ title: card.title || 'Personal Place' }} />
        <PlaceDetailContent
          body={card.body ? <FinishedBodyText value={card.body} /> : undefined}
          galleryImages={galleryImages}
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
  const remainingBodySlots = 10 - bodyMedia.length;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        gap: Space.lg,
        padding: Screen.gutter,
        paddingBottom: Screen.bottom,
      }}>
      <Stack.Screen options={{ title: 'Edit Personal Place' }} />
      <View style={{ alignItems: 'center', flexDirection: 'row' }}>
        <AppText style={{ flex: 1 }} variant="title">Edit Personal Place</AppText>
        <AppButton label="Done" onPress={() => void finishEditing()} size="compact" />
      </View>

      <AppTextInput
        accessibilityLabel="Personal Place title"
        maxLength={200}
        onChangeText={(value) => updateDraft('title', value)}
        placeholder="Title"
        value={title}
      />
      <AppTextInput
        accessibilityLabel="Personal Place description"
        maxLength={10_000}
        multiline
        onChangeText={(value) => updateDraft('body', value)}
        placeholder="Description"
        value={body}
      />
      <AutosaveStatus
        accessibilityLabel="Personal Place text"
        onRetry={() => void queueMetadataSave(revisionRef.current)}
        state={saveState}
      />

      <AppText variant="section">Location</AppText>
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        <AppTextInput
          accessibilityLabel="Latitude"
          keyboardType="numbers-and-punctuation"
          onChangeText={setLatitude}
          placeholder="Latitude"
          style={{ flex: 1 }}
          value={latitude}
        />
        <AppTextInput
          accessibilityLabel="Longitude"
          keyboardType="numbers-and-punctuation"
          onChangeText={setLongitude}
          placeholder="Longitude"
          style={{ flex: 1 }}
          value={longitude}
        />
      </View>
      {coordinates ? (
        <PlaceMapPreview
          latitude={coordinates.latitude}
          longitude={coordinates.longitude}
          title={title || 'Personal Place'}
        />
      ) : null}
      <AppButton
        disabled={!coordinates || busy}
        label={card.location?.confirmed ? 'Update and confirm location' : 'Confirm location'}
        onPress={() => void act(() => mutate.update(card.id, {
          latitude: coordinates!.latitude,
          longitude: coordinates!.longitude,
          locationConfirmed: true,
          locationSource: 'USER_SELECTED',
        }))}
      />

      <AppText variant="section">Main photo</AppText>
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
        <Image
          accessibilityLabel="Uploading main photo"
          contentFit="cover"
          source={{ uri: pendingMainPreview }}
          style={{ aspectRatio: 16 / 9, borderRadius: Radius.card, width: '100%' }}
        />
      ) : (
        <AppButton
          disabled={busy}
          label="Add main photo"
          onPress={() => void act(async () => {
            const selected = await pickPhotoForUpload();
            if (!selected || !session?.userId) return;
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
      )}

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
            setPendingBodyPreviews(selected.map((item) => item.uri));
            try {
              for (const photo of selected) {
                await addPersonalPlaceCardPhoto(
                  session.userId,
                  card.id,
                  'body',
                  photo,
                  mutate.attachPhoto,
                  load
                );
                setPendingBodyPreviews((current) => current.slice(1));
              }
            } finally {
              setPendingBodyPreviews([]);
            }
          })}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
        {bodyMedia.map((media) => {
          const imageUrl = photoUrls[media.id];
          return imageUrl ? (
            <View key={media.id} style={{ width: '48%' }}>
              <PhotoEditorTile
                accessibilityLabel={`Body photo ${(media.position ?? 0) + 1}`}
                imageUrl={imageUrl}
                onRemove={() => void removePhoto(media)}
              />
            </View>
          ) : null;
        })}
        {pendingBodyPreviews.map((uri) => (
          <View key={uri} style={{ opacity: 0.65, width: '48%' }}>
            <Image
              accessibilityLabel="Uploading body photo"
              contentFit="cover"
              source={{ uri }}
              style={{ aspectRatio: 1, borderRadius: Radius.card, width: '100%' }}
            />
          </View>
        ))}
      </View>
      <AppText color={Palette.textMuted} variant="caption">
        {bodyMedia.length} of 10 body photos
      </AppText>

      <AppText variant="section">Trip readiness</AppText>
      <StatusText>
        {card.readiness.isTripIdeaReady
          ? 'Ready to add to Trips.'
          : readinessMessage(card.readiness.readinessIssues)}
      </StatusText>
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
      <Pressable
        accessibilityLabel={`Remove ${accessibilityLabel.toLowerCase()}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        style={({ pressed }) => ({
          alignItems: 'center',
          backgroundColor: Palette.surface,
          borderColor: Palette.border,
          borderRadius: Radius.pill,
          borderWidth: 1,
          bottom: Space.sm,
          height: 32,
          justifyContent: 'center',
          opacity: pressed ? 0.65 : 1,
          position: 'absolute',
          right: Space.sm,
          width: 32,
        })}>
        <MaterialIcons color={Palette.text} name="close" size={19} />
      </Pressable>
    </Pressable>
  );
}

function FinishedBodyText({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  return (
    <View style={{ gap: Space.sm }}>
      <Text
        numberOfLines={expanded ? undefined : 3}
        style={{ color: Palette.textBody, ...Type.body }}>
        {value}
      </Text>
      <View pointerEvents="none" style={{ left: 0, opacity: 0, position: 'absolute', right: 0 }}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(event) => setOverflows(event.nativeEvent.lines.length > 3)}
          style={Type.body}>
          {value}
        </Text>
      </View>
      {overflows || expanded ? (
        <Pressable
          accessibilityLabel={expanded ? 'Show less of Personal Place description' : 'Show more of Personal Place description'}
          accessibilityRole="button"
          onPress={() => setExpanded((current) => !current)}
          style={{ alignSelf: 'flex-end' }}>
          <AppText color={Palette.textMuted} style={{ fontStyle: 'italic' }} variant="caption">
            {expanded ? '... show less' : '... show more'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
