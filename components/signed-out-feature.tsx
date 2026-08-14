import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Palette, Screen, Space } from '@/constants/design';

export function SignedOutFeature({
  message,
  onSignIn,
}: {
  message: string;
  onSignIn: () => Promise<boolean>;
}) {
  return (
    <View style={{ backgroundColor: Palette.background, flex: 1, gap: Space.lg, padding: Screen.gutter }}>
      <AppText>{message}</AppText>
      <AppButton label="Sign in" onPress={() => void onSignIn()} />
    </View>
  );
}
