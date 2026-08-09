import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { PersonalPlaceCardView } from '@/components/personal-place-card-view';
import { AppText } from '@/components/ui/app-text';
import { IconAction } from '@/components/ui/icon-action';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Screen, Space } from '@/constants/design';
import { personalPlaceCardError } from '@/personal-place-cards/errors';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import { useMyTrips } from '@/trips/provider';

export default function PersonalPlaceCardsScreen() {
  const router = useRouter();
  const { cards, create, deleteCard, isLoading } = usePersonalPlaceCards();
  const { trips } = useMyTrips();
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const createPlace = async () => {
    if (isCreating) return;
    setIsCreating(true);
    setMessage(null);
    try {
      const card = await create();
      router.push({
        pathname: '/personal-place-cards/[cardId]',
        params: { cardId: card.id, mode: 'edit' },
      });
    } catch (error) {
      setMessage(personalPlaceCardError(error));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        gap: Space.lg,
        paddingBottom: Screen.bottom,
        paddingHorizontal: Screen.gutter,
        paddingTop: Screen.top,
      }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityLabel="Add Personal Place"
              accessibilityRole="button"
              disabled={isCreating}
              hitSlop={12}
              onPress={() => void createPlace()}
              style={({ pressed }) => ({ opacity: isCreating ? 0.35 : pressed ? 0.55 : 1 })}>
              <MaterialIcons color={Palette.trip} name="add" size={30} />
            </Pressable>
          ),
        }}
      />
      {message ? <AppText color={Palette.danger}>{message}</AppText> : null}
      {isLoading && cards.length === 0 ? <LoadingView /> : cards.length === 0 ? (
        <AppText color={Palette.textMuted}>No Personal Places yet.</AppText>
      ) : cards.map((card) => {
        const activeAttachmentCount = trips.filter((trip) => trip.entries?.some(
          (entry) => entry.type === 'personalPlaceCard' &&
            'personalPlaceCard' in entry && entry.personalPlaceCard.id === card.id
        )).length;
        return (
          <View key={card.id}>
            <PersonalPlaceCardView card={card} compact />
            <View style={{ position: 'absolute', right: Space.md, top: 28 }}>
              <IconAction
                accessibilityLabel={`Delete ${card.title || 'Personal Place'}`}
                destructive
                icon="delete-outline"
                onPress={() => {
                  if (activeAttachmentCount > 0) {
                    setMessage(
                      `Remove this Place Card from ${activeAttachmentCount} active ${
                        activeAttachmentCount === 1 ? 'Trip' : 'Trips'
                      } before deleting it.`
                    );
                    return;
                  }
                  Alert.alert(
                    'Delete Personal Place?',
                    `This removes "${card.title || 'Untitled Personal Place'}".`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void deleteCard(card.id).catch((error) =>
                          setMessage(personalPlaceCardError(error))
                        ),
                      },
                    ]
                  );
                }}
                size="compact"
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
