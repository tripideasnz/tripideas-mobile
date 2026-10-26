import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { PlaceSearch } from '@/components/place-search';
import { Palette, Space } from '@/constants/design';

export default function SearchScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
      <PlaceSearch navigationOrigin="search" scrollable placeholder="Search now" header={<>
        <AppText style={{ marginBottom: Space.sm }} variant="display">
          Search
        </AppText>

        <AppText
          color={Palette.textBody}
          style={{ marginBottom: Space.xl }}>
          Search for places, beaches, walks, towns and regions across New Zealand.
        </AppText>

      </>} />
    </SafeAreaView>
  );
}
