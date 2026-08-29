import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/provider';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { LoadingView } from '@/components/ui/loading-view';
import { TripImageCollage } from '@/components/trip-image-collage';
import { useOrderedDiaryPhotoImages } from '@/components/diary/photo-assets';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { useDiaries } from '@/diaries/provider';
import { diaryCoverAssetIds } from '@/diaries/model';
import { formatDiaryDate } from '@/diaries/dates';
import type { Diary } from '@/diaries/types';

function DiaryIndexRow({ diary, onOpen }: { diary: Diary; onOpen: () => void }) {
  const { images, refresh } = useOrderedDiaryPhotoImages(diaryCoverAssetIds(diary), `${diary.title} cover`);
  return <View style={{ position: 'relative' }}><Pressable accessibilityLabel={`Open ${diary.title}`} accessibilityRole="button" onPress={onOpen}
    style={({ pressed }) => ({ borderColor: Palette.border, borderRadius: Radius.card, borderWidth: 1, flexDirection: 'row', overflow: 'hidden', opacity: pressed ? 0.65 : 1 })}>
    <TripImageCollage emptyLabel="Diary" images={images} onImageError={refresh} style={{ height: 92, width: 112 }} />
    <View style={{ flex: 1, justifyContent: 'center', padding: Space.lg, paddingRight: 64 }}><AppText numberOfLines={2} variant="cardTitle">{diary.title}</AppText><AppText color={Palette.textMuted} variant="label">{diary.startDate || diary.endDate ? [formatDiaryDate(diary.startDate), formatDiaryDate(diary.endDate)].filter(Boolean).join(' – ') : `${diary.days.length} ${diary.days.length === 1 ? 'day' : 'days'}`}</AppText></View>
  </Pressable></View>;
}

export default function DiaryLibraryScreen() {
  const router = useRouter();
  const { session, signIn, isLoading: sessionLoading } = useSession();
  const { capability, diaries, isLoading, loadDiary, loadError } = useDiaries();
  const [error, setError] = useState<string | null>(null);
  const openDiary = async (diary: (typeof diaries)[number]) => {
    setError(null);
    try {
      await loadDiary(diary.id);
      router.push({ pathname: '/diaries/[diaryId]', params: { diaryId: diary.id } });
    } catch {
      setError('This Diary could not be opened. Check your connection and try again.');
    }
  };
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: Palette.background }}>
    <Stack.Screen options={{
      headerLeft: () => <HeaderBackButton color={Palette.trip} fallbackHref="/saved" />,
      headerRight: () => null,
    }} />
    {sessionLoading || isLoading ? <LoadingView /> : !session ?
      <View style={{ gap: Space.lg, padding: Screen.gutter }}><AppText color={Palette.textBody}>Sign in to view your private travel Diaries.</AppText><AppButton label="Sign in" onPress={signIn} /></View> :
      <ScrollView contentContainerStyle={{ gap: Space.lg, padding: Screen.gutter }} keyboardShouldPersistTaps="handled">
        {loadError || error ? <AppText color={capability === 'unsupported' ? Palette.danger : Palette.textMuted}>{error ?? loadError}</AppText> : null}
        {diaries.length === 0 && capability === 'supported' ? <AppText color={Palette.textMuted}>No server Diaries yet.</AppText> : null}
        {diaries.map((diary) => <DiaryIndexRow diary={diary} key={diary.id} onOpen={() => void openDiary(diary)} />)}
        <AppText color={Palette.textMuted} variant="caption">Diary viewing is synced with your account. Editing will be enabled in the next update.</AppText>
      </ScrollView>}
  </SafeAreaView>;
}
