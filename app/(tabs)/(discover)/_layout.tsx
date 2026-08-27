import { Stack, useNavigation } from 'expo-router';
import React, { useEffect } from 'react';

import { HeaderBackButton } from '@/components/ui/header-back-button';

export default function DiscoverLayout() {
  const navigation = useNavigation();

  useEffect(() => {
    // When the Discover tab is pressed (even when already focused), always pop back to
    // the discover root — Expo Router's default retap behaviour is unreliable with
    // the nested (discover) group + Stack combo.
    const unsubscribe = (navigation as any).addListener('tabPress', () => {
      (navigation as any).navigate('(discover)', { screen: 'discover' });
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: () => <HeaderBackButton fallbackHref="/discover" />,
      }}>
      <Stack.Screen
        name="discover"
        options={{
          headerShown: false,
          title: 'Discover',
        }}
      />
      <Stack.Screen
        name="island/[slug]"
        options={{
          title: 'Island',
        }}
      />
      <Stack.Screen
        name="island/[slug]/regions"
        options={{
          title: 'Regions',
        }}
      />
      <Stack.Screen
        name="region/[slug]"
        options={{
          title: 'Region',
        }}
      />
      <Stack.Screen
        name="subregion/[slug]"
        options={{
          title: 'Sub-region',
        }}
      />
      <Stack.Screen
        name="place/[slug]"
        options={{
          title: 'Place',
        }}
      />
    </Stack>
  );
}
