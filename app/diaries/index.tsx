import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/provider';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput, AutoExpandingTextInput } from '@/components/ui/app-text-input';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { LoadingView } from '@/components/ui/loading-view';
import { TripImageCollage } from '@/components/trip-image-collage';
import { useOrderedDiaryPhotoImages } from '@/components/diary/photo-assets';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { useDiaries } from '@/diaries/provider';
import { diaryCoverAssetIds, validateDiaryDates } from '@/diaries/model';
import { formatDiaryDate, parseDiaryDate } from '@/diaries/dates';
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
  const { canEdit, canRetryPending, capability, createDiary, diaries, isLoading, loadDiary, loadError, mutationError, retryPending } = useDiaries();
  const [creating, setCreating] = useState(false); const [title, setTitle] = useState(''); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState('');
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
  const submit = async () => { if (!title.trim()) return setError('Add a title for your Diary.'); const start = startDate.trim() ? parseDiaryDate(startDate) : null; const end = endDate.trim() ? parseDiaryDate(endDate) : null; if ((startDate.trim() && !start) || (endDate.trim() && !end)) return setError('Enter dates in DD/MM/YYYY format.'); const dateError = validateDiaryDates(start ?? '', end ?? ''); if (dateError) return setError(dateError); try { const diary = await createDiary({ title: title.trim(), startDate: start, endDate: end }); setCreating(false); setTitle(''); setStartDate(''); setEndDate(''); router.push({ pathname: '/diaries/[diaryId]', params: { diaryId: diary.id, editCover: '1' } }); } catch { setError('Could not create the Diary. Tap Create Diary to retry.'); } };
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: Palette.background }}>
    <Stack.Screen options={{
      headerLeft: () => <HeaderBackButton color={Palette.trip} fallbackHref="/saved" />,
      headerRight: () => session && canEdit ? <Pressable accessibilityLabel="Add Diary" accessibilityRole="button" hitSlop={12} onPress={() => setCreating(true)}><MaterialIcons color={Palette.trip} name="add" size={30} /></Pressable> : null,
    }} />
    {sessionLoading || isLoading ? <LoadingView /> : !session ?
      <View style={{ gap: Space.lg, padding: Screen.gutter }}><AppText color={Palette.textBody}>Sign in to view your private travel Diaries.</AppText><AppButton label="Sign in" onPress={signIn} /></View> :
      <ScrollView contentContainerStyle={{ gap: Space.lg, padding: Screen.gutter }} keyboardShouldPersistTaps="handled">
        {loadError || mutationError || error ? <AppText color={capability === 'unsupported' ? Palette.danger : Palette.textMuted}>{error ?? mutationError ?? loadError}</AppText> : null}
        {canRetryPending ? <AppButton label="Retry pending Diary changes" onPress={() => void retryPending()} variant="secondary" /> : null}
        {creating ? <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, gap: Space.md, padding: Space.lg }}><AppText variant="section">New Diary</AppText><AutoExpandingTextInput accessibilityLabel="Diary title" autoFocus maxLength={200} placeholder="e.g. South Island journey" value={title} onChangeText={setTitle} /><AppTextInput accessibilityLabel="Diary start date" placeholder="Start date DD/MM/YYYY (optional)" value={startDate} onChangeText={setStartDate} /><AppTextInput accessibilityLabel="Diary end date" placeholder="End date DD/MM/YYYY (optional)" value={endDate} onChangeText={setEndDate} /><View style={{ flexDirection: 'row', gap: Space.md }}><View style={{ flex: 1 }}><AppButton label="Create Diary" onPress={() => void submit()} /></View><View style={{ flex: 1 }}><AppButton label="Cancel" onPress={() => setCreating(false)} variant="secondary" /></View></View></View> : null}
        {diaries.length === 0 && capability === 'supported' ? <AppText color={Palette.textMuted}>No server Diaries yet.</AppText> : null}
        {diaries.map((diary) => <DiaryIndexRow diary={diary} key={diary.id} onOpen={() => void openDiary(diary)} />)}
        <AppText color={Palette.textMuted} variant="caption">Diary changes sync securely with your account. Pending changes retry automatically.</AppText>
      </ScrollView>}
  </SafeAreaView>;
}
