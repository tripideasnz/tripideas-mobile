import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import {
  WELCOME_BODY_TEXT_STYLE,
  WELCOME_ICONS_GAP,
  WELCOME_LOGO_MARGIN_BOTTOM,
  WELCOME_TITLE_MARGIN_BOTTOM,
  WelcomeEntryButtons,
  welcomeButtonsBlockHeight,
  welcomeTextTop,
} from '@/components/welcome-entry-buttons';
import { openFromWelcome } from '@/components/welcome-navigation';
import { sanityClient } from '@/sanity/client';
import { COVER_QUERY } from '@/sanity/queries';
import type { CoverContent, CoverResponse } from '@/sanity/types';

type WelcomeScreenData = CoverContent & {
  fallbackSubtitle?: string;
  subtitle?: string;
  title?: string;
};

export default function CoverScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [cover, setCover] = useState<WelcomeScreenData | null>(null);

  useEffect(() => {
    let isMounted = true;

    sanityClient
      .fetch<CoverResponse | null>(COVER_QUERY)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setCover({
          backgroundAlt: data?.welcomePage?.backgroundAlt ?? data?.home?.backgroundAlt ?? data?.islands?.backgroundAlt,
          backgroundUrl: data?.welcomePage?.backgroundUrl ?? data?.home?.backgroundUrl ?? data?.islands?.backgroundUrl,
          fallbackSubtitle: data?.welcomePage?.fallbackSubtitle,
          logoAlt: data?.home?.logoAlt,
          logoUrl: data?.home?.logoUrl,
          subtitle: data?.welcomePage?.subtitle,
          title: data?.welcomePage?.title,
        });
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setCover({});
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#111' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {cover?.backgroundUrl ? (
        <Image
          source={{ uri: cover.backgroundUrl }}
          accessibilityLabel={cover.backgroundAlt ?? 'TripIdeas.nz background'}
          style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
          contentFit="cover"
        />
      ) : null}

      <View
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.42)',
          bottom: 0,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          bounces={false}
          contentContainerStyle={{ alignItems: 'center', flexGrow: 1, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}>
          <View
            style={{
              alignItems: 'center',
              marginTop: welcomeTextTop(height, insets.top),
              maxWidth: 560,
              width: '100%',
            }}>
            <BrandLogo
              tone="light"
              style={{
                height: 72,
                marginBottom: WELCOME_LOGO_MARGIN_BOTTOM,
              }}
            />

            <Text
              style={{
                color: '#fff',
                fontSize: 42,
                fontWeight: '700',
                lineHeight: 48,
                marginBottom: WELCOME_TITLE_MARGIN_BOTTOM,
                textAlign: 'center',
              }}>
              {cover?.title ?? 'Welcome to TripIdeas.nz'}
            </Text>

            <Text style={{ ...WELCOME_BODY_TEXT_STYLE, maxWidth: 420, textAlign: 'center' }}>
              {cover?.subtitle ?? cover?.fallbackSubtitle ?? 'Find memorable places, regions, and trip ideas around New Zealand.'}
            </Text>
          </View>

          {/* A fixed, short gap below the intro text, then the buttons with their labels. */}
          <View
            style={{
              alignItems: 'center',
              flex: 1,
              justifyContent: 'flex-start',
              minHeight: welcomeButtonsBlockHeight(width) + WELCOME_ICONS_GAP + 32,
              paddingTop: WELCOME_ICONS_GAP,
              width: '100%',
            }}>
            <WelcomeEntryButtons onOpen={(destination) => openFromWelcome(router, destination)} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
