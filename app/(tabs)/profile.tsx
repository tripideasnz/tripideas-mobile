import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/use-session';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import {
  Palette,
  Radius,
  Screen,
  Space,
} from '@/constants/design';

export default function ProfileScreen() {
  const { isLoading, user, signIn, signOut } = useSession();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}>
        <AppText style={{ marginBottom: Space.xl }} variant="display">
          Profile
        </AppText>

        {isLoading ? (
          <ActivityIndicator />
        ) : user ? (
          <SignedInView
            email={user.email}
            name={user.name}
            onSignOut={signOut}
          />
        ) : (
          <SignedOutView onSignIn={signIn} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SignedInView({
  email,
  name,
  onSignOut,
}: {
  email: string;
  name?: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <View style={{ gap: Space.lg }}>
      <View
        style={{
          backgroundColor: Palette.surfaceMuted,
          borderRadius: Radius.card,
          gap: Space.xs,
          padding: Space.lg,
        }}>
        {name ? (
          <AppText variant="bodyStrong">{name}</AppText>
        ) : null}
        <AppText color={Palette.textMuted}>{email}</AppText>
      </View>

      <AppText color={Palette.textBody}>
        Your saved places and trips are stored on this device.
      </AppText>

      <AppButton
        label="Sign out"
        onPress={onSignOut}
        variant="secondary"
      />
    </View>
  );
}

function SignedOutView({ onSignIn }: { onSignIn: () => Promise<void> }) {
  return (
    <View style={{ gap: Space.lg }}>
      <AppText color={Palette.textBody}>
        Sign in to sync your favourites and trip ideas across devices.
      </AppText>

      <AppButton label="Sign in" onPress={onSignIn} />
    </View>
  );
}
