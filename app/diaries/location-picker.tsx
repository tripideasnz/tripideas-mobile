import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SavedLocationPicker } from '@/components/map/saved-location-picker';
import { backOrFallback, HeaderBackButton } from '@/components/ui/header-back-button';
import { Palette } from '@/constants/design';
import { useDiaries } from '@/diaries/provider';

export default function DiaryLocationPicker() {
  const router = useRouter(); const params = useLocalSearchParams<{ diaryId: string; dayId: string; topicId: string; itemId?: string; latitude?: string; longitude?: string }>();
  const latitude = Number(params.latitude); const longitude = Number(params.longitude); const initial = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  const { addItem, diaries, updateItem } = useDiaries(); const sourceDate = diaries.find(({ id }) => id === params.diaryId)?.days.find(({ id }) => id === params.dayId)?.date;
  const dayFallback = sourceDate ? { pathname: '/diaries/[diaryId]/day' as const, params: { diaryId: params.diaryId, date: sourceDate } } : { pathname: '/diaries/[diaryId]' as const, params: { diaryId: params.diaryId } };
  const backToDay = () => backOrFallback(router, dayFallback);
  return <><Stack.Screen options={{ title: 'Find on map', headerLeft: () => <HeaderBackButton color={Palette.trip} fallbackHref={dayFallback} /> }} /><SavedLocationPicker initial={initial} onCancel={backToDay} onSave={async (selected) => { if (params.itemId) await updateItem(params.diaryId, params.dayId, params.topicId, params.itemId, { location: selected }); else await addItem(params.diaryId, params.dayId, params.topicId, { type: 'LOCATION', label: null, location: selected, contentOrigin: 'USER_OWNED', includeOnMap: true }); backToDay(); }} saveLabel="Save Pin" /></>;
}
