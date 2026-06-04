import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sanityClient } from '@/sanity/client';
import { COVER_QUERY } from '@/sanity/queries';
import type { CoverContent, CoverResponse } from '@/sanity/types';

export default function CoverScreen() {
  const [cover, setCover] = useState<CoverContent | null>(null);

  useEffect(() => {
    let isMounted = true;

    sanityClient
      .fetch<CoverResponse | null>(COVER_QUERY)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setCover({
          backgroundAlt: data?.home?.backgroundAlt ?? data?.islands?.backgroundAlt,
          backgroundUrl: data?.home?.backgroundUrl ?? data?.islands?.backgroundUrl,
          logoAlt: data?.home?.logoAlt,
          logoUrl: data?.home?.logoUrl,
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
          accessibilityLabel={cover.backgroundAlt ?? 'TripIdeas background'}
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
            flex: 1,
            justifyContent: 'flex-end',
            padding: 24,
            paddingBottom: 44,
          }}>
          <Image
            source={
              cover?.logoUrl
                ? { uri: cover.logoUrl }
                : require('@/assets/images/icon.png')
            }
            accessibilityLabel={cover?.logoAlt ?? 'TripIdeas logo'}
            style={{
              borderRadius: 14,
              height: 72,
              marginBottom: 22,
              width: 72,
            }}
            contentFit="cover"
          />

          <Text
            style={{
              color: '#fff',
              fontSize: 42,
              fontWeight: '700',
              lineHeight: 48,
              marginBottom: 12,
            }}>
            Welcome to TripIdeas
          </Text>

          <Text
            style={{
              color: '#f2f2f2',
              fontSize: 18,
              lineHeight: 26,
              marginBottom: 28,
            }}>
            Find memorable places, regions, and trip ideas around New Zealand.
          </Text>

          <Link href="/discover" asChild>
            <Pressable
              style={{
                alignItems: 'center',
                backgroundColor: '#fff',
                borderRadius: 10,
                paddingVertical: 15,
              }}>
              <Text style={{ color: '#111', fontSize: 17, fontWeight: '700' }}>
                Start Exploring
              </Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    </View>
  );
}
