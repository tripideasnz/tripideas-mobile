import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { DiaryViewMenu } from '@/components/diary/view-menu';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { Palette, Screen, Space } from '@/constants/design';
import { formatDiaryDate, instantiatedDiaryIndex } from '@/diaries/dates';
import { useDiaries } from '@/diaries/provider';

export default function DiaryIndexScreen() {
  const router = useRouter(); const { diaryId } = useLocalSearchParams<{ diaryId: string }>(); const { diaries } = useDiaries();
  const diary = diaries.find(({ id }) => id === diaryId); const days = useMemo(() => diary ? instantiatedDiaryIndex(diary.days) : [], [diary]);
  if (!diary) return <View style={{ padding: Screen.gutter }}><AppText>This Diary is not available on this device.</AppText></View>;
  const openDay = (date: string) => router.push({ pathname: '/diaries/[diaryId]/day', params: { diaryId: diary.id, date } });
  const firstDate = days[0]?.date ?? diary.startDate ?? diary.endDate;
  return <ScrollView contentContainerStyle={{ gap: Space.xl, padding: Screen.gutter }}>
    <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} />, headerRight: () => <DiaryViewMenu diaryId={diary.id} />, title: 'Diary Index' }} />
    <AppText variant="title">Index</AppText>
    {days.length ? days.map((day) => <Pressable key={day.id} accessibilityLabel={`Open ${formatDiaryDate(day.date)}`} accessibilityRole="button" onPress={() => openDay(day.date)} style={({ pressed }) => ({ borderBottomColor: Palette.border, borderBottomWidth: 1, gap: Space.xs, opacity: pressed ? 0.55 : 1, paddingVertical: Space.md })}><AppText variant={day.heading ? 'bodyStrong' : 'body'}>{formatDiaryDate(day.date)}{day.heading ? ` — ${day.heading}` : ''}</AppText><AppText color={Palette.textMuted} variant="caption">{day.topics.length ? `${day.topics.length} ${day.topics.length === 1 ? 'Topic' : 'Topics'}` : 'Empty Day'}</AppText></Pressable>) : <AppText color={Palette.textMuted}>No Diary pages have been opened yet.</AppText>}
    {firstDate ? <AppButton label={days.length ? 'Open first Day' : 'Start first Day'} onPress={() => openDay(firstDate)} /> : null}
    <AppText color={Palette.textMuted} variant="caption">Only instantiated Diary Days appear here. The Cover date range does not generate index rows.</AppText>
  </ScrollView>;
}
