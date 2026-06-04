import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { sanityClient } from '@/sanity/client';

type Slug = {
  current?: string;
};

type Coordinates = {
  lat?: number;
  lng?: number;
};

type RegionContext = {
  name?: string;
  maori?: string;
  slug?: Slug;
};

type SubRegionContext = {
  name?: string;
  slug?: Slug;
  region?: RegionContext;
};

type TextBlock = {
  children?: {
    text?: string;
  }[];
  style?: string;
};

type PlacePage = {
  _id?: string;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  h3?: string;
  imageAlt?: string;
  imageUrl?: string;
  preview?: string;
  seoDescription?: string;
  textBlocks?: TextBlock[];
  coordinates?: Coordinates;
  subRegion?: SubRegionContext;
  slug?: Slug;
};

const PLACE_QUERY = `
*[_type == "page" && slug.current == $slug][0]{
  _id,
  title,
  subtitle,
  excerpt,
  "h3": body[_type == "block" && style == "h3"][0].children[0].text,
  "imageAlt": mainImage.alt,
  "imageUrl": mainImage.asset->url,
  "preview": body[_type == "block" && style == "normal"][0].children[0].text,
  "textBlocks": body[_type == "block" && style in ["normal", "h3"]],
  "seoDescription": seo.description,
  coordinates,
  subRegion->{
    name,
    slug,
    region->{
      name,
      maori,
      slug
    }
  },
  slug
}
`;

function getPlaceHeading(place: PlacePage) {
  return place.subtitle?.trim() || place.h3?.trim();
}

function getPlacePreview(place: PlacePage) {
  const preview = place.excerpt?.trim() || place.preview?.trim();

  if (preview && preview.length > 24) {
    return preview;
  }

  return place.seoDescription?.trim() || preview;
}

function getBlockText(block: TextBlock) {
  return (block.children ?? [])
    .map((child) => child.text)
    .filter(Boolean)
    .join('');
}

function getBodyText(place: PlacePage) {
  return (place.textBlocks ?? [])
    .map(getBlockText)
    .filter(Boolean)
    .join('\n\n');
}

function ContentBlocks({ blocks }: { blocks?: TextBlock[] }) {
  const safeBlocks = (blocks ?? []).filter((block) => getBlockText(block));

  if (safeBlocks.length === 0) {
    return null;
  }

  return (
    <>
      {safeBlocks.map((block, index) => {
        const text = getBlockText(block);

        if (block.style === 'h3') {
          return (
            <Text
              key={`${block.style}-${index}`}
              style={{
                color: '#111',
                fontSize: 22,
                fontWeight: '700',
                lineHeight: 28,
                marginBottom: 10,
                marginTop: index === 0 ? 0 : 18,
              }}>
              {text}
            </Text>
          );
        }

        return (
          <Text
            key={`${block.style ?? 'normal'}-${index}`}
            style={{
              color: '#333',
              fontSize: 17,
              lineHeight: 25,
              marginBottom: 16,
            }}>
            {text}
          </Text>
        );
      })}
    </>
  );
}

function getContextText(place: PlacePage) {
  const regionName = place.subRegion?.region?.name?.trim();
  const subRegionName = place.subRegion?.name?.trim();

  if (regionName && subRegionName) {
    return `${regionName} / ${subRegionName}`;
  }

  return regionName || subRegionName;
}

function getMarkerText(place: PlacePage) {
  const lat = place.coordinates?.lat;
  const lng = place.coordinates?.lng;

  if (typeof lat === 'number' && typeof lng === 'number') {
    return `Location marker: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  return 'Location marker: not available';
}

export default function PlaceScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const selectedSlug = Array.isArray(slug) ? slug[0] : slug;
  const [place, setPlace] = useState<PlacePage | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSlug) {
      setPlace(null);
      setErrorMessage('Missing place slug.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    setErrorMessage(null);
    setIsExpanded(false);

    sanityClient
      .fetch<PlacePage | null>(PLACE_QUERY, { slug: selectedSlug })
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setPlace(data);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        console.error(error);
        setPlace(null);
        setErrorMessage('Unable to load this place.');
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

  const title = place?.title ?? 'Place';
  const heading = place ? getPlaceHeading(place) : undefined;
  const fullText = place ? getBodyText(place) : undefined;
  const preview = place ? getPlacePreview(place) : undefined;
  const displayText = preview || fullText;
  const hasBodyBlocks = (place?.textBlocks ?? []).some((block) => getBlockText(block));
  const canExpand = Boolean(fullText && preview && fullText !== preview);
  const contextText = place ? getContextText(place) : undefined;
  const markerText = place ? getMarkerText(place) : undefined;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ title }} />

      {isLoading ? (
        <Text style={{ padding: 24 }}>Loading...</Text>
      ) : errorMessage ? (
        <Text style={{ padding: 24 }}>{errorMessage}</Text>
      ) : !place ? (
        <Text style={{ padding: 24 }}>Place not found.</Text>
      ) : (
        <>
          {place.imageUrl ? (
            <Image
              source={{ uri: place.imageUrl }}
              accessibilityLabel={place.imageAlt ?? place.title ?? 'Place image'}
              style={{ aspectRatio: 16 / 9, width: '100%' }}
              contentFit="cover"
            />
          ) : null}

          <View style={{ padding: 24 }}>
            {contextText ? (
              <Text
                style={{
                  color: '#717171',
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 10,
                }}>
                {contextText}
              </Text>
            ) : null}

            <Text style={{ fontSize: 34, fontWeight: '700', marginBottom: 8 }}>
              {place.title ?? 'Untitled place'}
            </Text>

            {heading ? (
              <Text
                style={{
                  color: '#717171',
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: 18,
                }}>
                {heading}
              </Text>
            ) : null}

            {isExpanded && hasBodyBlocks ? (
              <View style={{ marginBottom: 8 }}>
                <ContentBlocks blocks={place.textBlocks} />
              </View>
            ) : displayText ? (
              <Text
                style={{
                  color: '#333',
                  fontSize: 17,
                  lineHeight: 25,
                  marginBottom: 24,
                }}>
                {displayText}
              </Text>
            ) : null}

            {canExpand ? (
              <Pressable
                onPress={() => setIsExpanded((expanded) => !expanded)}
                style={{
                  alignSelf: 'flex-start',
                  marginBottom: 24,
                }}>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>
                  {isExpanded ? 'Show less' : 'Read more'}
                </Text>
              </Pressable>
            ) : null}

            <View
              style={{
                borderColor: '#ddd',
                borderRadius: 8,
                borderWidth: 1,
                padding: 14,
              }}>
              <Text style={{ fontSize: 15, fontWeight: '700', marginBottom: 6 }}>
                Map diagnostics
              </Text>
              <Text style={{ color: '#4a4a4a', fontSize: 14 }}>
                {markerText}
              </Text>
              <Text style={{ color: '#4a4a4a', fontSize: 14, marginTop: 4 }}>
                Slug: {place.slug?.current ?? selectedSlug ?? 'Unknown'}
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
