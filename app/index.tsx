import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { sanityClient } from '@/sanity/client';
import { COVER_QUERY } from '@/sanity/queries';
import type { CoverContent, CoverResponse } from '@/sanity/types';

type WelcomeScreenData = CoverContent & {
  fallbackSubtitle?: string;
  subtitle?: string;
  title?: string;
};

export default function CoverScreen() {
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

      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            padding: 24,
          }}>
          <View
            style={{
              alignItems: 'center',
              maxWidth: 560,
              width: '100%',
            }}>
            {cover?.logoUrl ? (
              <Image
                accessibilityLabel={cover.logoAlt ?? 'TripIdeas logo'}
                contentFit="contain"
                source={{ uri: cover.logoUrl }}
                style={{ height: 72, marginBottom: 32 }}
              />
            ) : (
              <BrandLogo
                tone="light"
                style={{
                  height: 72,
                  marginBottom: 32,
                }}
              />
            )}

            <Text
              style={{
                color: '#fff',
                fontSize: 42,
                fontWeight: '700',
                lineHeight: 48,
                marginBottom: 16,
                textAlign: 'center',
              }}>
              {cover?.title ?? 'Welcome to TripIdeas.nz'}
            </Text>

            <Text
              style={{
                color: '#f2f2f2',
                fontSize: 18,
                lineHeight: 26,
                marginBottom: 32,
                maxWidth: 420,
                textAlign: 'center',
              }}>
              {cover?.subtitle ?? cover?.fallbackSubtitle ?? 'Find memorable places, regions, and trip ideas around New Zealand.'}
            </Text>

            <Link href="/discover" asChild>
              <Pressable
                style={{
                  alignItems: 'center',
                  alignSelf: 'stretch',
                  backgroundColor: '#fff',
                  borderRadius: 10,
                  paddingVertical: 15,
                }}>
                <Text
                  style={{ color: '#111', fontSize: 17, fontWeight: '700' }}>
                  Start Exploring
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
