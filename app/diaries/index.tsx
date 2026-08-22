import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/provider';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { IconAction } from '@/components/ui/icon-action';
import { LoadingView } from '@/components/ui/loading-view';
import { TripImageCollage } from '@/components/trip-image-collage';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { useDiaries } from '@/diaries/provider';
import { validateDiaryDates } from '@/diaries/model';
import { formatDiaryDate, parseDiaryDate } from '@/diaries/dates';

export default function DiaryLibraryScreen() {
  const router = useRouter();
  const { session, signIn, isLoading: sessionLoading } = useSession();
  const { diaries, createDiary, deleteDiary, isLoading } = useDiaries();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!title.trim()) return setError('Add a title for your Diary.');
    const normalizedStart = startDate.trim() ? parseDiaryDate(startDate) : null;
    const normalizedEnd = endDate.trim() ? parseDiaryDate(endDate) : null;
    if ((startDate.trim() && !normalizedStart) || (endDate.trim() && !normalizedEnd)) return setError('Enter valid dates as d/m/y.');
    const dateError = validateDiaryDates(normalizedStart ?? '', normalizedEnd ?? '');
    if (dateError) return setError(dateError);
    const diary = await createDiary({ title, startDate: normalizedStart, endDate: normalizedEnd });
    setCreating(false); setTitle(''); setStartDate(''); setEndDate(''); setError(null);
    router.push({ pathname: '/diaries/[diaryId]', params: { diaryId: diary.id } });
  };
  const openDiary = (diary: (typeof diaries)[number]) => {
    router.push({ pathname: '/diaries/[diaryId]', params: { diaryId: diary.id } });
  };
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: Palette.background }}>
    <Stack.Screen options={{
      headerLeft: () => <HeaderBackButton color={Palette.trip} />,
      headerRight: () => session ? <Pressable accessibilityLabel="Add Diary" accessibilityRole="button"
        hitSlop={12} onPress={() => setCreating(true)} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
        <MaterialIcons color={Palette.trip} name="add" size={30} />
      </Pressable> : null,
    }} />
    {sessionLoading || isLoading ? <LoadingView /> : !session ?
      <View style={{ gap: Space.lg, padding: Screen.gutter }}><AppText color={Palette.textBody}>Sign in to create and edit private travel Diaries.</AppText><AppButton label="Sign in" onPress={signIn} /></View> :
      <ScrollView contentContainerStyle={{ gap: Space.lg, padding: Screen.gutter }} keyboardShouldPersistTaps="handled">
        {creating ? <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, gap: Space.md, padding: Space.lg }}>
          <AppText variant="section">New Diary</AppText>
          <AppTextInput accessibilityLabel="Diary title" autoFocus maxLength={200} placeholder="e.g. South Island journey" value={title} onChangeText={(value) => { setTitle(value); setError(null); }} />
          <AppTextInput accessibilityLabel="Diary start date" autoCapitalize="none" placeholder="Start date d/m/y (optional)" value={startDate} onChangeText={setStartDate} />
          <AppTextInput accessibilityLabel="Diary end date" autoCapitalize="none" placeholder="End date d/m/y (optional)" value={endDate} onChangeText={setEndDate} />
          {error ? <AppText color={Palette.danger}>{error}</AppText> : null}
          <View style={{ flexDirection: 'row', gap: Space.md }}><View style={{ flex: 1 }}><AppButton label="Create Diary" onPress={() => void submit()} /></View><View style={{ flex: 1 }}><AppButton label="Cancel" onPress={() => { setCreating(false); setError(null); }} variant="secondary" /></View></View>
        </View> : null}
        {!creating && diaries.length === 0 ? <AppText color={Palette.textMuted}>No Diaries yet. Add one to compose your travel story.</AppText> : null}
        {diaries.map((diary) => <View key={diary.id} style={{ position: 'relative' }}>
          <Pressable accessibilityLabel={`Open ${diary.title}`} accessibilityRole="button" onPress={() => openDiary(diary)}
            style={({ pressed }) => ({ borderColor: Palette.border, borderRadius: Radius.card, borderWidth: 1, flexDirection: 'row', overflow: 'hidden', opacity: pressed ? 0.65 : 1 })}>
            <TripImageCollage emptyLabel="Diary" images={[]} style={{ height: 92, width: 112 }} />
            <View style={{ flex: 1, justifyContent: 'center', padding: Space.lg, paddingRight: 64 }}><AppText numberOfLines={2} variant="cardTitle">{diary.title}</AppText><AppText color={Palette.textMuted} variant="label">{diary.startDate || diary.endDate ? [formatDiaryDate(diary.startDate), formatDiaryDate(diary.endDate)].filter(Boolean).join(' – ') : `${diary.days.length} ${diary.days.length === 1 ? 'day' : 'days'}`}</AppText></View>
          </Pressable>
          <View style={{ position: 'absolute', right: Space.md, top: 24 }}><IconAction accessibilityLabel={`Delete ${diary.title}`} destructive icon="delete-outline" onPress={() => Alert.alert('Delete Diary', `This removes “${diary.title}” from this device.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteDiary(diary.id) }])} /></View>
        </View>)}
        <AppText color={Palette.textMuted} variant="caption">Diary drafts in this preview are stored only on this device for the signed-in account.</AppText>
      </ScrollView>}
  </SafeAreaView>;
}
