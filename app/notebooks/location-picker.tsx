import * as Crypto from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { SavedLocationPicker } from '@/components/map/saved-location-picker';
import { backOrFallback, HeaderBackButton } from '@/components/ui/header-back-button';
import { Palette } from '@/constants/design';
import { useNotebooks } from '@/notebooks/provider';

export default function NotebookLocationPicker() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    notebookId: string; pageId?: string; blockId?: string; latitude?: string; longitude?: string;
  }>();
  const { mutate } = useNotebooks();
  const initialLatitude = Number(params.latitude);
  const initialLongitude = Number(params.longitude);
  const initial = Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude)
    ? { latitude: initialLatitude, longitude: initialLongitude }
    : null;
  const notebookFallback = {
    pathname: '/notebooks/[notebookId]', params: { notebookId: params.notebookId },
  } as const;
  const backToNotebook = () => backOrFallback(router, notebookFallback);

  return <>
    <Stack.Screen options={{ title: 'Choose Pin location', headerLeft: () => <HeaderBackButton color={Palette.trip} fallbackHref={notebookFallback} /> }} />
    <SavedLocationPicker initial={initial} onCancel={backToNotebook} saveLabel="Save Pin" onSave={async (selected) => {
      if (params.blockId) {
        await mutate.updateRichBlock(params.notebookId, params.blockId, {
          location: { ...selected, source: 'MAP_SELECTED', accuracyMeters: null },
        });
      } else if (params.pageId) {
        await mutate.addPinBlock({ id: params.notebookId, pageId: params.pageId,
          clientRequestId: Crypto.randomUUID(), title: null,
          location: { ...selected, source: 'MAP_SELECTED', accuracyMeters: null } });
      } else {
        throw new Error('missing_notebook_pin_target');
      }
      backToNotebook();
    }} />
  </>;
}
