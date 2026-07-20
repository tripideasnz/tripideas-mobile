import * as Linking from 'expo-linking';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/use-session';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import {
  Palette,
  Radius,
  Screen,
  Space,
} from '@/constants/design';

export default function ProfileScreen() {
  const { authError, isLoading, user, signIn, signOut } = useSession();

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
          <LoadingView />
        ) : user ? (
          <SignedInView
            email={user.email}
            name={user.name}
            onSignOut={signOut}
          />
        ) : (
          <SignedOutView authError={authError} onSignIn={signIn} />
        )}

        <Pressable
          onPress={() =>
            Linking.openURL('https://www.tripideas.nz/privacy-policy')
          }
          style={{ marginTop: Space.xxxl }}>
          <AppText
            color={Palette.trip}
            style={{ textDecorationLine: 'underline' }}>
            Privacy Policy
          </AppText>
        </Pressable>
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

      <AppButton
        label="Sign out"
        onPress={onSignOut}
        variant="secondary"
      />
    </View>
  );
}

function SignedOutView({
  authError,
  onSignIn,
}: {
  authError: string | null;
  onSignIn: () => Promise<void>;
}) {
  return (
    <View style={{ gap: Space.lg }}>
      <AppText color={Palette.textBody}>
        Signing in allows you to create, save, and share content on
        TripIdeas.nz that is personal to you, including favourites, trip
        ideas, and related messages.
      </AppText>

      <AppButton label="Sign in" onPress={onSignIn} />
      {authError ? (
        <AppText color={Palette.danger}>{authError}</AppText>
      ) : null}
    </View>
  );
}
