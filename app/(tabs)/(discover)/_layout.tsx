import { Stack } from 'expo-router';
import React from 'react';

export default function DiscoverLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: '',
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
