import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContentBlocks, getBlockText, getPlainText } from '@/components/content-blocks';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { LoadingView } from '@/components/ui/loading-view';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Screen, Space } from '@/constants/design';
import { sanityClient } from '@/sanity/client';
import { ISLAND_QUERY } from '@/sanity/queries';
import type { IslandArticle, IslandResponse } from '@/sanity/types';

export default function IslandScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const selectedSlug = Array.isArray(slug) ? slug[0] : slug;
  const [island, setIsland] = useState<IslandArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!selectedSlug) {
      setIsland(null);
      setErrorMessage('Missing island slug.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setErrorMessage(null);

    sanityClient
      .fetch<IslandResponse | null>(ISLAND_QUERY, { slug: selectedSlug })
      .then((data) => {
        if (isMounted) setIsland(data?.island ?? null);
      })
      .catch((error) => {
        console.error(error);
        if (isMounted) {
          setIsland(null);
          setErrorMessage('Unable to load this island.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSlug]);

  const title = island?.title ?? 'Island';
  const hasBodyBlocks = (island?.textBlocks ?? []).some((block) => getBlockText(block));
  const fallbackText = getPlainText(island?.textBlocks) || island?.preview;

  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: Palette.background, flex: 1 }}>
      <Stack.Screen options={{ title }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Screen.bottom }}>
        {isLoading ? (
          <LoadingView />
        ) : errorMessage ? (
          <StatusText style={{ padding: Screen.gutter }}>{errorMessage}</StatusText>
        ) : !island ? (
          <StatusText style={{ padding: Screen.gutter }}>Island not found.</StatusText>
        ) : (
          <>
            {island.imageUrl ? (
              <Image
                accessibilityLabel={island.imageAlt ?? island.title ?? 'Island image'}
                contentFit="cover"
                source={{ uri: island.imageUrl }}
                style={{ aspectRatio: 16 / 9, width: '100%' }}
              />
            ) : null}

            <View style={{ padding: Screen.gutter }}>
              <AppText style={{ marginBottom: Space.xs }} variant="display">
                {island.title}
              </AppText>

              {island.maori ? (
                <AppText
                  color={Palette.textMuted}
                  style={{ marginBottom: Space.xl }}
                  variant="cardTitle">
                  {island.maori}
                </AppText>
              ) : null}

              {hasBodyBlocks ? (
                <View style={{ marginBottom: Space.xl }}>
                  <ContentBlocks blocks={island.textBlocks} />
                </View>
              ) : fallbackText ? (
                <AppText
                  color={Palette.textBody}
                  style={{ lineHeight: 25, marginBottom: Space.xl }}>
                  {fallbackText}
                </AppText>
              ) : (
                <AppText
                  color={Palette.textMuted}
                  style={{ marginBottom: Space.xl }}>
                  Island article content is not available yet.
                </AppText>
              )}

              <AppButton
                disabled={!selectedSlug}
                label="Browse regions"
                onPress={() => {
                  if (selectedSlug) {
                    router.push({
                      pathname: '/island/[slug]/regions',
                      params: { slug: selectedSlug },
                    });
                  }
                }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
