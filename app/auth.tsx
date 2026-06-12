import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { mobileExchange } from '@/auth/api';
import { consumeCodeVerifier } from '@/auth/provider';
import { useSession } from '@/auth/use-session';
import { Palette } from '@/constants/design';

// Handles the tripideas://auth/callback deep link.
//
// Primary path: openAuthSessionAsync in AuthProvider intercepts the redirect
// and completes the exchange inline — this screen is never shown.
//
// Backup path: app was backgrounded and the deep link arrives cold. This
// screen reads the code/state, retrieves the stored code verifier, exchanges
// with the backend, then navigates to the main tabs.
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { code, state, error } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();
  const { isLoading, user } = useSession();
  const hasExchanged = useRef(false);

  useEffect(() => {
    if (hasExchanged.current) return;

    if (error) {
      console.error('[AuthCallback] WorkOS returned error:', error);
      router.replace('/');
      return;
    }

    if (!code || !state) {
      // No code params — probably landed here directly. Redirect.
      if (!isLoading) router.replace(user ? '/profile' : '/');
      return;
    }

    hasExchanged.current = true;
    console.log('[AuthCallback] Deep link received. code present:', !!code, '| state present:', !!state);

    (async () => {
      const pkce = await consumeCodeVerifier();
      if (!pkce) {
        console.error('[AuthCallback] No PKCE data in SecureStore — cannot exchange');
        router.replace('/');
        return;
      }

      if (state !== pkce.expectedState) {
        console.error('[AuthCallback] State mismatch — possible CSRF. Aborting.');
        router.replace('/');
        return;
      }

      try {
        await mobileExchange(code, pkce.verifier);
        console.log('[AuthCallback] Exchange successful');
      } catch (err) {
        console.error('[AuthCallback] Exchange failed:', err);
        router.replace('/');
        return;
      }

      router.replace('/profile');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, state, error]);

  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: Palette.background,
        flex: 1,
        justifyContent: 'center',
      }}>
      <ActivityIndicator />
    </View>
  );
}
