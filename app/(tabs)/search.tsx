import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { PlaceSearch } from '@/components/place-search';
import { Palette, Screen, Space } from '@/constants/design';

export default function SearchScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}>
        <AppText style={{ marginBottom: Space.sm }} variant="display">
          Search
        </AppText>

        <AppText
          color={Palette.textBody}
          style={{ marginBottom: Space.xl }}>
          Search for places, beaches, walks, towns and regions across New Zealand.
        </AppText>

        <PlaceSearch placeholder="Search now" />
      </ScrollView>
    </SafeAreaView>
  );
}
