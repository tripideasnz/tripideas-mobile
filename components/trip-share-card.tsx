import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { TripShareCardData } from '@/trips/share';

export function TripShareCard({ data }: { data: TripShareCardData }) {
  const placeLabel = `${data.placeCount} ${
    data.placeCount === 1 ? 'place' : 'places'
  }`;

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderColor: '#e2e2e2',
        borderRadius: 18,
        borderWidth: 1,
        elevation: 2,
        marginBottom: 28,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      }}>
      {data.coverImageUrl ? (
        <Image
          accessibilityLabel={data.coverImageAlt ?? 'Trip cover image'}
          contentFit="cover"
          source={{ uri: data.coverImageUrl }}
          style={{ aspectRatio: 16 / 9, width: '100%' }}
        />
      ) : (
        <View
          style={{
            alignItems: 'center',
            aspectRatio: 16 / 9,
            backgroundColor: '#e8ecef',
            justifyContent: 'center',
            padding: 24,
            width: '100%',
          }}>
          <Text
            style={{
              color: '#59636b',
              fontSize: 18,
              fontWeight: '700',
              textAlign: 'center',
            }}>
            My Trip
          </Text>
        </View>
      )}

      <View style={{ padding: 18 }}>
        {data.logoUrl ? (
          <Image
            accessibilityLabel={data.logoAlt ?? 'TripIdeas logo'}
            contentFit="contain"
            contentPosition="left"
            source={{ uri: data.logoUrl }}
            style={{ height: 36, marginBottom: 16, width: 150 }}
          />
        ) : (
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              letterSpacing: 0.3,
              marginBottom: 14,
            }}>
            TripIdeas
          </Text>
        )}

        <Text style={{ fontSize: 28, fontWeight: '700', lineHeight: 34 }}>
          {data.title}
        </Text>

        {data.note ? (
          <Text
            numberOfLines={4}
            style={{
              color: '#444',
              fontSize: 16,
              lineHeight: 23,
              marginTop: 10,
            }}>
            {data.note}
          </Text>
        ) : null}

        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#f1f1f1',
            borderRadius: 999,
            marginTop: 16,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}>
          <Text style={{ color: '#444', fontSize: 14, fontWeight: '700' }}>
            {placeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
