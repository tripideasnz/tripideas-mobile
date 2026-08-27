import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { SavedLocationPicker } from '@/components/map/saved-location-picker';
import { backOrFallback, HeaderBackButton } from '@/components/ui/header-back-button';
import { Palette } from '@/constants/design';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';

export default function PersonalPlaceLocationPicker() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cardId: string; latitude?: string; longitude?: string; notebookId?: string; origin?: string; tripId?: string }>();
  const hasInitialCoordinates = Boolean(params.latitude?.trim() && params.longitude?.trim());
  const latitude = Number(params.latitude); const longitude = Number(params.longitude);
  const initial = hasInitialCoordinates && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
  const { mutate } = usePersonalPlaceCards();
  const personalPlaceFallback = {
    pathname: '/personal-place-cards/[cardId]',
    params: { cardId: params.cardId, mode: 'edit', notebookId: params.notebookId, origin: params.origin, tripId: params.tripId },
  } as const;
  const backToPersonalPlace = () => backOrFallback(router, personalPlaceFallback);
  return <>
    <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} fallbackHref={personalPlaceFallback} />, title: 'Choose location' }} />
    <SavedLocationPicker initial={initial} onCancel={backToPersonalPlace} onSave={async (selected) => {
      await mutate.update(params.cardId, { latitude: selected.latitude, longitude: selected.longitude, locationConfirmed: true, locationSource: 'USER_SELECTED' });
      backToPersonalPlace();
    }} />
  </>;
}
