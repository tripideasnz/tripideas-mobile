import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSession } from '@/auth/provider';
import { PlaceMapPreview } from '@/components/place-map-preview';
import { PersonalPlaceCardView } from '@/components/personal-place-card-view';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Screen, Space, Type } from '@/constants/design';
import {
  personalPlaceCardError,
  readinessMessage,
} from '@/personal-place-cards/errors';
import {
  addPersonalPlaceCardPhoto,
  resumePersonalPlaceCardPhotos,
} from '@/personal-place-cards/photos';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import { pickPhotoForUpload } from '@/photo-uploads/picker';
import { useMyTrips } from '@/trips/provider';

export default function PersonalPlaceCardEditor() {
  const params = useLocalSearchParams<{ cardId?: string | string[] }>();
  const cardId = Array.isArray(params.cardId) ? params.cardId[0] : params.cardId;
  const router = useRouter();
  const { session } = useSession();
  const { deleteCard, get, load, mutate } = usePersonalPlaceCards();
  const { addPersonalCardToTrip, trips } = useMyTrips();
  const card = get(cardId);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cardId) void load(cardId).catch((error) => setMessage(personalPlaceCardError(error)));
  }, [cardId, load]);
  useEffect(() => {
    setTitle(card?.title ?? '');
    setBody(card?.body ?? '');
    setLatitude(card?.location ? String(card.location.latitude) : '');
    setLongitude(card?.location ? String(card.location.longitude) : '');
  }, [card?.body, card?.id, card?.location, card?.title, card?.version]);
  useEffect(() => {
    if (session?.userId && cardId) {
      void resumePersonalPlaceCardPhotos(
        session.userId,
        cardId,
        mutate.attachPhoto,
        load
      );
    }
  }, [cardId, load, mutate.attachPhoto, session?.userId]);

  if (!card || !cardId) {
    return <StatusText>Loading Personal Place…</StatusText>;
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  const validCoordinates =
    Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180;
  const attachedTripIds = trips
    .filter((trip) => trip.entries?.some(
      (entry) =>
        entry.type === 'personalPlaceCard' &&
        'personalPlaceCard' in entry &&
        entry.personalPlaceCard.id === card.id
    ))
    .map((trip) => trip.id);

  const act = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try { await operation(); } catch (error) {
      setMessage(personalPlaceCardError(error));
    } finally { setBusy(false); }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        padding: Screen.gutter,
        paddingBottom: Screen.bottom,
        gap: Space.lg,
      }}>
      <Stack.Screen options={{ title: card.title || 'Personal Place' }} />
      <PersonalPlaceCardView card={card} embedded onPress={() => {}} />
      <AppTextInput
        accessibilityLabel="Personal Place title"
        onChangeText={setTitle}
        placeholder="Title"
        value={title}
      />
      <AppTextInput
        accessibilityLabel="Personal Place description"
        multiline
        onChangeText={setBody}
        placeholder="Description"
        value={body}
      />
      <AppButton
        disabled={busy}
        label="Save text"
        onPress={() => void act(() => mutate.update(card.id, {
          body: body || null,
          title: title || null,
        }))}
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
      {validCoordinates ? (
        <PlaceMapPreview latitude={lat} longitude={lng} />
      ) : null}
      <AppButton
        disabled={!validCoordinates || busy}
        label={card.location?.confirmed ? 'Update and confirm location' : 'Confirm location'}
        onPress={() => void act(() => mutate.update(card.id, {
          latitude: lat,
          longitude: lng,
          locationConfirmed: true,
          locationSource: 'USER_SELECTED',
        }))}
      />

      <AppText variant="section">Photos</AppText>
      <View style={{ flexDirection: 'row', gap: Space.sm }}>
        {!card.media.some((item) => item.role === 'main') ? (
          <AppButton
            disabled={busy}
            label="Add main photo"
            onPress={() => void act(async () => {
              const selected = await pickPhotoForUpload();
              if (selected && session?.userId) {
                await addPersonalPlaceCardPhoto(
                  session.userId,
                  card.id,
                  'main',
                  selected,
                  mutate.attachPhoto,
                  load
                );
              }
            })}
          />
        ) : null}
        <AppButton
          disabled={busy || card.media.filter((item) => item.role === 'body').length >= 10}
          label="Add body photo"
          variant="secondary"
          onPress={() => void act(async () => {
            const selected = await pickPhotoForUpload();
            if (selected && session?.userId) {
              await addPersonalPlaceCardPhoto(
                session.userId,
                card.id,
                'body',
                selected,
                mutate.attachPhoto,
                load
              );
            }
          })}
        />
      </View>
      {card.media.map((media) => (
        <View
          key={media.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <Text style={{ flex: 1, ...Type.body }}>
            {media.role === 'main' ? 'Main photo' : `Body photo ${(media.position ?? 0) + 1}`}
          </Text>
          {media.role === 'body' ? (
            <>
              <AppButton
                disabled={busy || media.position === 0}
                label="↑"
                size="compact"
                variant="secondary"
                onPress={() => void act(() => {
                  const ids = card.media
                    .filter((item) => item.role === 'body')
                    .map((item) => item.id);
                  const index = ids.indexOf(media.id);
                  [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                  return mutate.reorderPhotos(card.id, ids);
                })}
              />
              <AppButton
                disabled={
                  busy ||
                  media.position ===
                    card.media.filter((item) => item.role === 'body').length - 1
                }
                label="↓"
                size="compact"
                variant="secondary"
                onPress={() => void act(() => {
                  const ids = card.media
                    .filter((item) => item.role === 'body')
                    .map((item) => item.id);
                  const index = ids.indexOf(media.id);
                  [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
                  return mutate.reorderPhotos(card.id, ids);
                })}
              />
            </>
          ) : null}
          <AppButton
            label="Remove"
            size="compact"
            variant="danger"
            onPress={() => void act(() => mutate.removePhoto(card.id, media.id))}
          />
        </View>
      ))}

      <AppText variant="section">Trip readiness</AppText>
      <StatusText>
        {card.readiness.isTripIdeaReady
          ? 'Ready to add to Trips.'
          : readinessMessage(card.readiness.readinessIssues)}
      </StatusText>
      {card.readiness.isTripIdeaReady ? trips.map((trip) => {
        const attached = attachedTripIds.includes(trip.id);
        return (
          <View key={trip.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
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
      <AppButton
        label="Delete Personal Place"
        variant="danger"
        onPress={() => Alert.alert(
          'Delete Personal Place?',
          'This cannot be deleted while it belongs to an active Trip.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => void act(async () => {
                await deleteCard(card.id);
                router.replace('/personal-place-cards');
              }),
            },
          ]
        )}
      />
    </ScrollView>
  );
}
