import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SavedModule } from '@/components/saved-module';
import { AppText } from '@/components/ui/app-text';
import { Palette, Screen, Space } from '@/constants/design';
import { useNotebooks } from '@/notebooks/provider';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import { useSavedPlaces } from '@/saved/provider';
import { useMyTrips } from '@/trips/provider';

function countText(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function SavedScreen() {
  const router = useRouter();
  const { isLoading: isLoadingFavourites, savedPlaceIds } = useSavedPlaces();
  const { isLoading: isLoadingTrips, trips } = useMyTrips();
  const { cards, isLoading: isLoadingPersonalPlaces } = usePersonalPlaceCards();
  const { isLoading: isLoadingNotebooks, notebooks } = useNotebooks();

  const modules = [
    {
      accessibilityLabel: 'Open Favourites',
      icon: 'favorite-border' as const,
      onPress: () => router.push('/favourites'),
      stateText: isLoadingFavourites
        ? 'Loading…'
        : savedPlaceIds.length
          ? countText(savedPlaceIds.length, 'place')
          : 'No favourites yet',
      title: 'Favourites',
    },
    {
      accessibilityLabel: 'Open Trips',
      icon: 'folder' as const,
      onPress: () => router.push('/trips'),
      stateText: isLoadingTrips
        ? 'Loading…'
        : trips.length
          ? countText(trips.length, 'trip')
          : 'No trips yet',
      title: 'Trips',
    },
    {
      accessibilityLabel: 'Open Personal Places',
      icon: 'location-on' as const,
      onPress: () => router.push('/personal-place-cards'),
      stateText: isLoadingPersonalPlaces
        ? 'Loading…'
        : cards.length
          ? countText(cards.length, 'place')
          : 'No personal places yet',
      title: 'Personal Places',
    },
    {
      accessibilityLabel: 'Open Notebooks',
      icon: 'menu-book' as const,
      onPress: () => router.push('/notebooks'),
      stateText: isLoadingNotebooks
        ? 'Loading…'
        : notebooks.length
          ? countText(notebooks.length, 'notebook')
          : 'No notebooks yet',
      title: 'Notebooks',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: Space.md,
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}>
        <AppText style={{ marginBottom: Space.sm }} variant="display">
          Saved
        </AppText>
        {modules.map((module) => (
          <SavedModule key={module.title} {...module} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
