import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { PersonalPlaceCardView } from '@/components/personal-place-card-view';
import { SignedOutFeature } from '@/components/signed-out-feature';
import { useSession } from '@/auth/provider';
import { AppText } from '@/components/ui/app-text';
import { IconAction } from '@/components/ui/icon-action';
import { headerAddAction } from '@/components/ui/header-actions';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { personalPlaceCardError } from '@/personal-place-cards/errors';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import { useMyTrips } from '@/trips/provider';

export default function PersonalPlaceCardsScreen() {
  const { isLoading: isLoadingSession, session, signIn } = useSession();
  const userId = session?.userId ?? null;
  const router = useRouter();
  const { cards, create, deleteCard, isLoading, refresh } = usePersonalPlaceCards();
  const { trips } = useMyTrips();
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    setRefreshMessage(null);
    void refresh().catch(() => {
      setRefreshMessage('Showing saved Personal Places. Could not refresh right now.');
    });
  }, [refresh, userId]));

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

  if (isLoadingSession) return <LoadingView />;
  if (!session) {
    return (
      <SignedOutFeature
        message="Sign in to view and edit your private Personal Places"
        onSignIn={signIn}
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{
        paddingBottom: Screen.bottom,
        paddingHorizontal: Screen.gutter,
        paddingTop: Screen.top,
      }}>
      <Stack.Screen
        options={{
          ...headerAddAction({ accessibilityLabel: 'Add Personal Place', disabled: isCreating, onPress: () => void createPlace() }),
        }}
      />
      {message ? <AppText color={Palette.danger} style={{ marginBottom: Space.lg }}>{message}</AppText> : null}
      {refreshMessage ? <AppText color={Palette.textMuted} style={{ marginBottom: Space.lg }}>{refreshMessage}</AppText> : null}
      {isLoading && cards.length === 0 ? <LoadingView /> : cards.length === 0 ? (
        <AppText color={Palette.textMuted}>No Personal Places yet.</AppText>
      ) : cards.map((card) => {
        const activeAttachmentCount = trips.filter((trip) => trip.entries?.some(
          (entry) => entry.type === 'personalPlaceCard' &&
            'personalPlaceCard' in entry && entry.personalPlaceCard.id === card.id
        )).length;
        return (
          <View key={card.id}>
            <PersonalPlaceCardView card={card} editorialIndex />
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.94)',
              borderRadius: Radius.pill,
              position: 'absolute',
              right: Space.md,
              top: Space.md,
            }}>
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
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
