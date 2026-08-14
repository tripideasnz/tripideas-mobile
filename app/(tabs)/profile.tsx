import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
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
  const router = useRouter();
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

        <HelpSection />

        <Pressable
          onPress={() => router.push('/privacy-policy')}
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
  const initials = (name || email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <View style={{ gap: Space.lg }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: Palette.surfaceMuted,
          borderRadius: Radius.card,
          gap: Space.xs,
          padding: Space.lg,
        }}>
        <View
          accessibilityLabel="Profile image placeholder"
          style={{
            alignItems: 'center',
            backgroundColor: Palette.trip,
            borderRadius: 32,
            height: 64,
            justifyContent: 'center',
            marginBottom: Space.sm,
            width: 64,
          }}>
          <AppText color={Palette.background} variant="title">{initials || 'TI'}</AppText>
        </View>
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

function HelpSection() {
  return (
    <View style={{ gap: Space.md, marginTop: Space.xxxl }}>
      <AppText variant="section">Help</AppText>
      <HelpTopic title="How TripIdeas works">
          Discover places, select your Favourites, create your own trip ideas, save them and share with family and friends.
        </HelpTopic>
        <HelpTopic title="Saved">
          Saved is the home for your private Favourites, Trips, Personal Places, and Notebooks.
        </HelpTopic>
        <HelpTopic title="Favourites">
          Tap the heart on a Place to keep it in your private Favourites.
        </HelpTopic>
        <HelpTopic title="Trips">
          Add Places to Trips to build and reorder an itinerary with personal notes.
        </HelpTopic>
        <HelpTopic title="Personal Places">
          Create private Place Cards for places that are not yet in TripIdeas.
        </HelpTopic>
        <HelpTopic title="Notebooks">
          Keep longer notes, plans, pages, and photos together in a private Notebook.
        </HelpTopic>
        <HelpTopic title="Sharing and privacy">
          Creating and saving private content requires sign-in.
        </HelpTopic>
      <HelpTopic title="Account help">
        Your WorkOS sign-in identifies your account. Use the account controls above to sign in, sign out, or change accounts.
      </HelpTopic>
      <Pressable
        accessibilityRole="link"
        onPress={() => void openFeedbackEmail()}>
        <AppText color={Palette.trip} style={{ textDecorationLine: 'underline' }}>
          Send feedback or ask for help
        </AppText>
      </Pressable>
    </View>
  );
}

async function openFeedbackEmail() {
  const email = 'hello@tripideas.nz';
  const url = `mailto:${email}?subject=TripIdeas%20app%20feedback`;
  try {
    if (!(await Linking.canOpenURL(url))) throw new Error('Mail is unavailable');
    await Linking.openURL(url);
  } catch {
    await Clipboard.setStringAsync(email);
    Alert.alert('Email address copied', `${email} has been copied so you can use your preferred mail app.`);
  }
}

function HelpTopic({ children, title }: { children: string; title: string }) {
  return (
    <View style={{ gap: Space.xs }}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText color={Palette.textBody}>{children}</AppText>
    </View>
  );
}

function SignedOutView({
  authError,
  onSignIn,
}: {
  authError: string | null;
  onSignIn: () => Promise<boolean>;
}) {
  return (
    <View style={{ gap: Space.lg }}>
      <AppText color={Palette.textBody}>
        Signing in allows you to create, save, and share content on
        TripIdeas.nz that is personal to you, including favourites, trip
        ideas, and related messages.
      </AppText>

      <AppButton label="Sign in" onPress={() => void onSignIn()} />
      {authError ? (
        <AppText color={Palette.danger}>{authError}</AppText>
      ) : null}
    </View>
  );
}
