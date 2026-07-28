import { Stack } from 'expo-router';
import React from 'react';

import { AuthProvider } from '@/auth/provider';
import { SavedPlacesProvider } from '@/saved/provider';
import { NotebookProvider } from '@/notebooks/provider';
import { MyTripsProvider } from '@/trips/provider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SavedPlacesProvider>
        <NotebookProvider>
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
            <Stack.Screen name="notebooks/index" options={{ title: 'Notebooks' }} />
            <Stack.Screen
              name="notebooks/[notebookId]"
              options={{ title: 'Notebook' }}
            />
            <Stack.Screen
              name="photo-upload-dev"
              options={{ title: 'Photo upload verification' }}
            />
            <Stack.Screen
              name="trips/[tripId]/map"
              options={{ title: 'Trip Map' }}
            />
            <Stack.Screen
              name="trips/[tripId]/shared"
              options={{ headerShown: false, title: 'Shared Trip Preview' }}
            />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            </Stack>
          </MyTripsProvider>
        </NotebookProvider>
      </SavedPlacesProvider>
    </AuthProvider>
  );
}
