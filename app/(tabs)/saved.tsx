import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SavedModule } from '@/components/saved-module';
import { AppText } from '@/components/ui/app-text';
import { SavedObjectIcons } from '@/components/ui/saved-object-icons';
import { Palette, Screen, Space } from '@/constants/design';
import { useNotebooks } from '@/notebooks/provider';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import { useSavedPlaces } from '@/saved/provider';
import { useMyTrips } from '@/trips/provider';
import { useSession } from '@/auth/provider';
import { useDiaries } from '@/diaries/provider';

function countText(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function SavedScreen() {
  const router = useRouter();
  const { session, signIn } = useSession();
  const { isLoading: isLoadingFavourites, savedPlaceIds } = useSavedPlaces();
  const { isLoading: isLoadingTrips, trips } = useMyTrips();
  const { cards, isLoading: isLoadingPersonalPlaces } = usePersonalPlaceCards();
  const { isLoading: isLoadingNotebooks, notebooks } = useNotebooks();
  const { diaries, isLoading: isLoadingDiaries } = useDiaries();

  const openPrivateFeature = async (
    destination: '/favourites' | '/trips' | '/personal-place-cards' | '/notebooks' | '/diaries'
  ) => {
    if (!session && !(await signIn())) return;
    router.navigate(destination);
  };

  const modules = [
    {
      accessibilityLabel: 'Open Favourites',
      icon: 'favorite-border' as const,
      onPress: () => void openPrivateFeature('/favourites'),
      stateText: !session
        ? 'Sign in to save Favourites'
        : isLoadingFavourites
        ? 'Loading…'
        : savedPlaceIds.length
          ? countText(savedPlaceIds.length, 'place')
          : 'No favourites yet',
      title: 'Favourites',
    },
    {
      accessibilityLabel: 'Open Trips',
      icon: 'folder' as const,
      onPress: () => void openPrivateFeature('/trips'),
      stateText: !session
        ? 'Sign in to view private Trips'
        : isLoadingTrips
        ? 'Loading…'
        : trips.length
          ? countText(trips.length, 'trip')
          : 'No trips yet',
      title: 'Trips',
    },
    {
      accessibilityLabel: 'Open Personal Places',
      icon: SavedObjectIcons.personalPlace,
      onPress: () => void openPrivateFeature('/personal-place-cards'),
      stateText: !session
        ? 'Sign in to view Personal Places'
        : isLoadingPersonalPlaces
        ? 'Loading…'
        : cards.length
          ? countText(cards.length, 'place')
          : 'No personal places yet',
      title: 'Personal Places',
    },
    {
      accessibilityLabel: 'Open Notebooks',
      icon: 'menu-book' as const,
      onPress: () => void openPrivateFeature('/notebooks'),
      stateText: !session
        ? 'Sign in to view Notebooks'
        : isLoadingNotebooks
        ? 'Loading…'
        : notebooks.length
          ? countText(notebooks.length, 'notebook')
          : 'No notebooks yet',
      title: 'Notebooks',
    },
    {
      accessibilityLabel: 'Open Diaries',
      icon: 'auto-stories' as const,
      onPress: () => void openPrivateFeature('/diaries'),
      stateText: !session
        ? 'Sign in to view private Diaries'
        : isLoadingDiaries
        ? 'Loading…'
        : diaries.length
          ? countText(diaries.length, 'diary', 'diaries')
          : 'No diaries yet',
      title: 'Diaries',
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
