import { Stack } from 'expo-router';
import React from 'react';

import { AuthProvider } from '@/auth/provider';
import { SavedPlacesProvider } from '@/saved/provider';
import { NotebookProvider } from '@/notebooks/provider';
import { MyTripsProvider } from '@/trips/provider';
import { PersonalPlaceCardProvider } from '@/personal-place-cards/provider';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { Palette } from '@/constants/design';
import { ApiCompatibilityNotice } from '@/components/api-compatibility-notice';

export default function RootLayout() {
  return (
    <AuthProvider>
      <SavedPlacesProvider>
        <NotebookProvider>
          <PersonalPlaceCardProvider>
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
                <Stack.Screen
                  name="personal-place-cards/index"
                  options={{
                    headerLeft: () => <HeaderBackButton color={Palette.trip} />,
                    title: 'Personal Places',
                  }}
                />
                <Stack.Screen
                  name="personal-place-cards/[cardId]"
                  options={{
                    headerLeft: () => <HeaderBackButton color={Palette.trip} />,
                    title: 'Personal Place',
                  }}
                />
                <Stack.Screen
                  name="favourites/index"
                  options={{
                    headerLeft: () => <HeaderBackButton color={Palette.trip} />,
                    title: 'Favourites',
                  }}
                />
                <Stack.Screen
                  name="trips/index"
                  options={{
                    headerLeft: () => <HeaderBackButton color={Palette.trip} />,
                    title: 'Trips',
                  }}
                />
                <Stack.Screen name="trips/[tripId]" options={{ title: 'My Trip' }} />
                <Stack.Screen name="notebooks/index" options={{ title: 'Notebooks' }} />
                <Stack.Screen
                  name="notebooks/[notebookId]"
                  options={{ title: 'Notebook' }}
                />
                <Stack.Screen
                  name="notebooks/[notebookId]/sharing"
                  options={{
                    contentStyle: { backgroundColor: 'transparent' },
                    headerShown: false,
                    presentation: 'formSheet',
                    sheetAllowedDetents: [0.58, 0.9],
                    sheetGrabberVisible: true,
                    sheetInitialDetentIndex: 1,
                  }}
                />
                <Stack.Screen
                  name="photo-upload-dev"
                  options={{
                    headerLeft: () => <HeaderBackButton />,
                    title: 'Photo upload verification',
                  }}
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
            <ApiCompatibilityNotice />
            </MyTripsProvider>
          </PersonalPlaceCardProvider>
        </NotebookProvider>
      </SavedPlacesProvider>
    </AuthProvider>
  );
}
