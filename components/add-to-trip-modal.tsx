import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { CardSurface } from '@/components/ui/card-surface';
import { TripIndexCard } from '@/components/trip-index-card';
import { Palette, Space, Type } from '@/constants/design';
import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import { tripRequestDiagnostic } from '@/trips/error-diagnostic';
import { getTripImages } from '@/trips/images';
import type { MyTrip } from '@/trips/types';
import type { PlaceCardData } from '@/types/content';
import { CreateTripWithPlaceError } from '@/trips/workflow-errors';

type AddToTripModalProps = {
  onClose: () => void;
  onCreateTrip: (name: string) => Promise<MyTrip | null>;
  onSelectTrip: (tripId: string) => Promise<void>;
  placeId: string | null;
  trips: MyTrip[];
};

export function AddToTripModal({
  onClose,
  onCreateTrip,
  onSelectTrip,
  placeId,
  trips,
}: AddToTripModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdTrip, setCreatedTrip] = useState<MyTrip | null>(null);
  const [createdTripPlaces, setCreatedTripPlaces] = useState<PlaceCardData[]>([]);

  const resetCreate = () => {
    setIsCreating(false);
    setNewTripName('');
    setActionError(null);
    setCreatedTrip(null);
    setCreatedTripPlaces([]);
  };

  useEffect(() => {
    if (!placeId) {
      setIsCreating(false);
      setNewTripName('');
      setActionError(null);
    }
  }, [placeId]);

  useEffect(() => {
    if (!createdTrip || !placeId) return;
    let isMounted = true;
    fetchPlaceCardsByIds([placeId])
      .then((places) => {
        if (isMounted) setCreatedTripPlaces(places);
      })
      .catch(() => {
        if (isMounted) setCreatedTripPlaces([]);
      });
    return () => {
      isMounted = false;
    };
  }, [createdTrip, placeId]);

  const handleClose = () => {
    resetCreate();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = newTripName.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const trip = await onCreateTrip(trimmed);
      if (trip) {
        setCreatedTrip(trip);
        setIsCreating(false);
        setNewTripName('');
      }
    } catch (error) {
      if (error instanceof CreateTripWithPlaceError && error.stage === 'attach') {
        setIsCreating(false);
        setNewTripName('');
        setActionError(
          `The Trip was created, but the place could not be added${tripRequestDiagnostic(error)}. Select the Trip to try adding it again.`
        );
      } else {
        setActionError(
          `Could not create the Trip${tripRequestDiagnostic(error)}. Check your connection and try again.`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTrip = async (tripId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onSelectTrip(tripId);
    } catch (error) {
      setActionError(
        `Could not add this place to the Trip${tripRequestDiagnostic(error)}. Check your connection and try again.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const showCreateForm = isCreating || trips.length === 0;

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="pageSheet"
      visible={Boolean(placeId)}>
      <View
        style={{
          backgroundColor: Palette.background,
          flex: 1,
          padding: Space.xxl,
        }}>
        <View
          style={{
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: Space.xxl,
          }}>
          <AppText variant="title">{createdTrip ? 'Trip created' : 'Add to My Trip'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={handleClose}
            style={({ pressed }) => ({
              opacity: pressed ? 0.45 : 1,
              paddingHorizontal: 4,
              paddingVertical: 8,
            })}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </View>

        {createdTrip ? (
          <View style={{ gap: Space.lg }}>
            <AppText color={Palette.textMuted}>The place was added successfully.</AppText>
            <TripIndexCard
              images={getTripImages(createdTrip, createdTripPlaces)}
              trip={createdTrip}
            />
          </View>
        ) : showCreateForm ? (
          <View style={{ gap: Space.md }}>
            <AppTextInput
              autoCapitalize="words"
              autoFocus
              onChangeText={(value) => {
                setNewTripName(value);
                setActionError(null);
              }}
              onSubmitEditing={() => void handleSubmit()}
              placeholder="Trip name"
              returnKeyType="done"
              value={newTripName}
            />
            <AppButton
              disabled={!newTripName.trim() || isSubmitting}
              label={isSubmitting ? 'Creating...' : 'Create & add place'}
              onPress={() => void handleSubmit()}
            />
            {actionError ? <AppText color={Palette.danger}>{actionError}</AppText> : null}
            {trips.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={resetCreate}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  marginTop: Space.sm,
                  opacity: pressed ? 0.55 : 1,
                })}>
                <Text style={{ color: Palette.textMuted, ...Type.label }}>
                  Back to trips
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {trips.map((trip) => {
              const alreadyAdded = trip.places.some(
                (place) => place.placeId === placeId
              );

              return (
                <Pressable
                  accessibilityRole="button"
                  key={trip.id}
                  disabled={isSubmitting}
                  onPress={() => void handleSelectTrip(trip.id)}
                  style={({ pressed }) => ({
                    marginBottom: Space.md,
                    opacity: pressed ? 0.55 : alreadyAdded ? 0.75 : 1,
                  })}>
                  <CardSurface style={{ padding: Space.lg }}>
                    <Text style={Type.cardTitle}>{trip.name}</Text>
                    <Text
                      style={{
                        color: Palette.textMuted,
                        ...Type.label,
                        marginTop: Space.xs,
                      }}>
                      {alreadyAdded
                        ? 'Already in this trip'
                        : `${trip.entries?.length ?? trip.places.length} ${
                            (trip.entries?.length ?? trip.places.length) === 1
                              ? 'place'
                              : 'places'
                          }`}
                    </Text>
                  </CardSurface>
                </Pressable>
              );
            })}

            <Pressable
              accessibilityRole="button"
              onPress={() => setIsCreating(true)}
              style={({ pressed }) => ({
                marginBottom: Space.md,
                opacity: pressed ? 0.55 : 1,
              })}>
              <CardSurface
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: Space.md,
                  padding: Space.lg,
                }}>
                <Text style={{ color: Palette.textMuted, fontSize: 22, lineHeight: 26 }}>
                  +
                </Text>
                <Text style={Type.cardTitle}>Create new trip</Text>
              </CardSurface>
            </Pressable>
          </ScrollView>
        )}
        {!showCreateForm && actionError ? (
          <AppText color={Palette.danger}>{actionError}</AppText>
        ) : null}
      </View>
    </Modal>
  );
}
