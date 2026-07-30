import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { CardSurface } from '@/components/ui/card-surface';
import { Palette, Space, Type } from '@/constants/design';
import type { MyTrip } from '@/trips/types';

type AddToTripModalProps = {
  onClose: () => void;
  onCreateTrip: (name: string) => Promise<void>;
  onSelectTrip: (tripId: string) => void;
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

  const resetCreate = () => {
    setIsCreating(false);
    setNewTripName('');
  };

  useEffect(() => {
    if (!placeId) {
      setIsCreating(false);
      setNewTripName('');
    }
  }, [placeId]);

  const handleClose = () => {
    resetCreate();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = newTripName.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateTrip(trimmed);
      resetCreate();
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
          <AppText variant="title">Add to My Trip</AppText>
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

        {showCreateForm ? (
          <View style={{ gap: Space.md }}>
            <AppTextInput
              autoCapitalize="words"
              autoFocus
              onChangeText={setNewTripName}
              onSubmitEditing={handleSubmit}
              placeholder="Trip name"
              returnKeyType="done"
              value={newTripName}
            />
            <AppButton
              disabled={!newTripName.trim() || isSubmitting}
              label={isSubmitting ? 'Creating...' : 'Create & add place'}
              onPress={handleSubmit}
            />
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
                  onPress={() => onSelectTrip(trip.id)}
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
      </View>
    </Modal>
  );
}
