import { Stack } from 'expo-router';
import React from 'react';

import { SavedPlacesProvider } from '@/saved/provider';
import { MyTripsProvider } from '@/trips/provider';

export default function RootLayout() {
  return (
    <SavedPlacesProvider>
      <MyTripsProvider>
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
          <Stack.Screen name="trips/[tripId]" options={{ title: 'My Trip' }} />
          <Stack.Screen
            name="trips/[tripId]/map"
            options={{ title: 'Trip Map' }}
          />
          <Stack.Screen
            name="trips/[tripId]/shared"
            options={{ headerShown: false, title: 'Shared Trip Preview' }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </MyTripsProvider>
    </SavedPlacesProvider>
  );
}
