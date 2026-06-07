import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { MapPlace } from '@/sanity/types';

type MapPeekSheetProps = {
  isLoading: boolean;
  isMinimised: boolean;
  onHandlePress: () => void;
  onMinimise: () => void;
  onQueryChange: (query: string) => void;
  places: MapPlace[];
  query: string;
  resultCount: number;
};

export function MapPeekSheet({
  isLoading,
  isMinimised,
  onHandlePress,
  onMinimise,
  onQueryChange,
  places,
  query,
  resultCount,
}: MapPeekSheetProps) {
  const router = useRouter();
  const handlePress = () => {
    Keyboard.dismiss();
    onHandlePress();
  };
  const minimiseTray = () => {
    Keyboard.dismiss();
    onMinimise();
  };

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        elevation: 12,
        paddingBottom: 12,
        paddingHorizontal: 12,
        paddingTop: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.18,
        shadowRadius: 9,
      }}>
      <Pressable
        accessibilityLabel={
          isMinimised ? 'Open map tray' : 'Open full list view'
        }
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => ({
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMinimised ? 48 : 36,
          opacity: pressed ? 0.6 : 1,
        })}>
        <View
          style={{
            backgroundColor: '#c9c9c9',
            borderRadius: 999,
            height: 4,
            width: 42,
          }}
        />
      </Pressable>

      {isMinimised ? null : (
        <>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onQueryChange}
            placeholder="Search for trip ideas"
            returnKeyType="search"
            style={{
              backgroundColor: '#f7f7f7',
              borderColor: '#dedede',
              borderRadius: 999,
              borderWidth: 1,
              fontSize: 15,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
            value={query}
          />

          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 3,
              paddingVertical: 10,
            }}>
            <Text
              style={{ color: '#4a4a4a', fontSize: 14, fontWeight: '600' }}>
              {isLoading
                ? 'Loading places...'
                : `${resultCount} ${
                    resultCount === 1 ? 'place' : 'places'
                  } in view`}
            </Text>
            <View
              style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                onPress={handlePress}
                style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
                <Text
                  style={{ color: '#111', fontSize: 14, fontWeight: '800' }}>
                  List view
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Minimise map tray"
                accessibilityRole="button"
                hitSlop={8}
                onPress={minimiseTray}
                style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
                <MaterialIcons
                  color="#111"
                  name="keyboard-arrow-down"
                  size={25}
                />
              </Pressable>
            </View>
          </View>

          {places.length > 0 ? (
            <ScrollView
              contentContainerStyle={{ gap: 10 }}
              horizontal
              showsHorizontalScrollIndicator={false}>
              {places.slice(0, 4).map((place, index) => (
                <Pressable
                  disabled={!place.slug?.current}
                  key={place._id ?? place.slug?.current ?? index}
                  onPress={() => {
                    if (!place.slug?.current) {
                      return;
                    }

                    router.push({
                      pathname: '/place/[slug]',
                      params: { slug: place.slug.current },
                    });
                  }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    width: 142,
                  })}>
                  <View
                    style={{
                      aspectRatio: 4 / 3,
                      backgroundColor: '#e8e8e5',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}>
                    {place.imageUrl ? (
                      <Image
                        accessibilityLabel={
                          place.imageAlt ?? place.title ?? 'Place image'
                        }
                        contentFit="cover"
                        source={{ uri: place.imageUrl }}
                        style={{ height: '100%', width: '100%' }}
                      />
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 13, fontWeight: '700', marginTop: 6 }}>
                    {place.title}
                  </Text>
                  {place.subRegion?.name ? (
                    <Text
                      numberOfLines={1}
                      style={{ color: '#717171', fontSize: 11, marginTop: 1 }}>
                      {place.subRegion.name}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </>
      )}
    </View>
  );
}
