import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  ContentBlocks,
  getBlockText,
  getPlainText,
  type ContentBlock,
} from '@/components/content-blocks';
import { sanityClient } from '@/sanity/client';

type IslandArticle = {
  imageAlt?: string;
  imageUrl?: string;
  maori?: string;
  preview?: string;
  textBlocks?: ContentBlock[];
  title?: string;
};

type IslandResponse = {
  island?: IslandArticle;
};

const ISLAND_QUERY = `
*[_type == "islands"][0]{
  "island": select(
    $slug == "north" => north{
      title,
      maori,
      "imageAlt": coalesce(article->mainImage.alt, heroImage.alt, mainImage.alt, image.alt),
      "imageUrl": coalesce(article->mainImage.asset->url, heroImage.asset->url, mainImage.asset->url, image.asset->url),
      "preview": coalesce(
        article->excerpt,
        article->seo.description,
        article->body[_type == "block" && style == "normal"][0].children[0].text,
        description[_type == "block" && style == "normal"][0].children[0].text
      ),
      "textBlocks": coalesce(article->body[_type == "block" && style in ["normal", "h3"]], description[_type == "block" && style in ["normal", "h3"]])
    },
    $slug == "south" => south{
      title,
      maori,
      "imageAlt": coalesce(article->mainImage.alt, heroImage.alt, mainImage.alt, image.alt),
      "imageUrl": coalesce(article->mainImage.asset->url, heroImage.asset->url, mainImage.asset->url, image.asset->url),
      "preview": coalesce(
        article->excerpt,
        article->seo.description,
        article->body[_type == "block" && style == "normal"][0].children[0].text,
        description[_type == "block" && style == "normal"][0].children[0].text
      ),
      "textBlocks": coalesce(article->body[_type == "block" && style in ["normal", "h3"]], description[_type == "block" && style in ["normal", "h3"]])
    }
  )
}
`;

export default function IslandScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const selectedSlug = Array.isArray(slug) ? slug[0] : slug;
  const [island, setIsland] = useState<IslandArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        if (isMounted) {
          setIsland(data?.island ?? null);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setIsland(null);
          setErrorMessage('Unable to load this island.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSlug]);

  const title = island?.title ?? 'Island';
  const hasBodyBlocks = (island?.textBlocks ?? []).some((block) => getBlockText(block));
  const fallbackText = getPlainText(island?.textBlocks) || island?.preview;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ title }} />

      {isLoading ? (
        <Text style={{ padding: 24 }}>Loading...</Text>
      ) : errorMessage ? (
        <Text style={{ padding: 24 }}>{errorMessage}</Text>
      ) : !island ? (
        <Text style={{ padding: 24 }}>Island not found.</Text>
      ) : (
        <>
          {island.imageUrl ? (
            <Image
              source={{ uri: island.imageUrl }}
              accessibilityLabel={island.imageAlt ?? island.title ?? 'Island image'}
              style={{ aspectRatio: 16 / 9, width: '100%' }}
              contentFit="cover"
            />
          ) : null}

          <View style={{ padding: 24 }}>
            <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 8 }}>
              {island.title ?? 'Untitled island'}
            </Text>

            {island.maori ? (
              <Text
                style={{
                  color: '#717171',
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: 18,
                }}>
                {island.maori}
              </Text>
            ) : null}

            {hasBodyBlocks ? (
              <View style={{ marginBottom: 8 }}>
                <ContentBlocks blocks={island.textBlocks} />
              </View>
            ) : fallbackText ? (
              <Text
                style={{
                  color: '#333',
                  fontSize: 17,
                  lineHeight: 25,
                  marginBottom: 24,
                }}>
                {fallbackText}
              </Text>
            ) : (
              <Text style={{ color: '#717171', fontSize: 16, marginBottom: 24 }}>
                Island article content is not available yet.
              </Text>
            )}

            <Link
              href={{
                pathname: '/island/[slug]/regions',
                params: { slug: selectedSlug ?? '' },
              }}
              asChild>
              <Pressable
                disabled={!selectedSlug}
                style={{
                  alignItems: 'center',
                  backgroundColor: '#111',
                  borderRadius: 8,
                  paddingVertical: 12,
                }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  Browse regions
                </Text>
              </Pressable>
            </Link>
          </View>
        </>
      )}
    </ScrollView>
  );
}
