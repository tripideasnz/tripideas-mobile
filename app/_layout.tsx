import { Stack } from 'expo-router';
import React from 'react';

import { SavedPlacesProvider } from '@/saved/provider';

export default function RootLayout() {
  return (
    <SavedPlacesProvider>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerBackTitle: '',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false, title: '' }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </SavedPlacesProvider>
  );
}
