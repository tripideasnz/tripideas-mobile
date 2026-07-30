import { Stack, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import { StatusText } from '@/components/ui/status-text';
import { PersonalPlaceCardView } from '@/components/personal-place-card-view';
import { Palette, Screen, Space } from '@/constants/design';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';

export default function PersonalPlaceCardsScreen() {
  const router = useRouter();
  const { cards, create, isLoading } = usePersonalPlaceCards();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Palette.background }}
      contentContainerStyle={{ padding: Screen.gutter, paddingBottom: Screen.bottom }}>
      <Stack.Screen options={{ title: 'Personal Places' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Space.xl }}>
        <AppText style={{ flex: 1 }} variant="title">Personal Places</AppText>
        <AppButton
          label="Create"
          size="compact"
          onPress={async () => {
            const card = await create();
            router.push({
              pathname: '/personal-place-cards/[cardId]',
              params: { cardId: card.id },
            });
          }}
        />
      </View>
      {isLoading && cards.length === 0 ? <LoadingView /> : cards.length === 0 ? (
        <StatusText>No Personal Places yet.</StatusText>
      ) : cards.map((card) => <PersonalPlaceCardView card={card} key={card.id} />)}
    </ScrollView>
  );
}
