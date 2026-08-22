import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { DiaryAutosaveField } from '@/components/diary/autosave-field';
import { FinishEditAction } from '@/components/diary/finish-edit-action';
import { TripImageCollage } from '@/components/trip-image-collage';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { IconAction } from '@/components/ui/icon-action';
import { useSession } from '@/auth/provider';
import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import { formatDiaryDate, formatDiaryDateInput, parseDiaryDate, validateDiaryDateRange } from '@/diaries/dates';
import { useDiaries } from '@/diaries/provider';
import { getLastViewedDiaryDay } from '@/diaries/last-viewed';

function CoverModeTile({ icon, label, onPress }: { icon: 'map' | 'menu-book'; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Open Diary ${label}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', borderColor: Palette.border, borderRadius: Radius.card, borderWidth: 1, flex: 1, gap: Space.sm, minHeight: 132, justifyContent: 'center', opacity: pressed ? 0.6 : 1, padding: Space.lg })}><MaterialIcons color={Palette.trip} name={icon} size={58} /><AppText variant="label">{label.toUpperCase()}</AppText></Pressable>;
}

export default function DiaryCoverScreen() {
  const router = useRouter(); const { session } = useSession();
  const { diaryId } = useLocalSearchParams<{ diaryId: string }>();
  const { deleteDiary, diaries, updateDateRange, updateDiaryMetadata } = useDiaries();
  const diary = diaries.find(({ id }) => id === diaryId);
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(''); const [end, setEnd] = useState(''); const [error, setError] = useState<string | null>(null);
  const photoChoices = useMemo(() => diary?.days.flatMap((day) => day.topics.flatMap((topic) => topic.items.flatMap((item) => item.type === 'PHOTO' ? [{ alt: item.caption || diary.title, url: item.photoAssetId }] : []))) ?? [], [diary]);
  if (!diary) return <View style={{ padding: Screen.gutter }}><AppText>This Diary is not available on this device.</AppText></View>;
  const coverImages = diary.coverPhotoAssetId ? [{ alt: `${diary.title} cover`, url: diary.coverPhotoAssetId }] : photoChoices.slice(0, 4);
  const beginEdit = () => { setStart(formatDiaryDateInput(diary.startDate)); setEnd(formatDiaryDateInput(diary.endDate)); setError(null); setEditing(true); };
  const done = async (confirmRemoval = false) => {
    const startDate = start.trim() ? parseDiaryDate(start) : null; const endDate = end.trim() ? parseDiaryDate(end) : null;
    if ((start.trim() && !startDate) || (end.trim() && !endDate)) return setError('Enter valid dates as d/m/y.');
    const rangeError = validateDiaryDateRange(startDate, endDate); if (rangeError) return setError(rangeError);
    const result = await updateDateRange(diary.id, startDate, endDate, confirmRemoval);
    if (result.outsideDays.length) return Alert.alert('Diary content outside new range', `${result.outsideDays.length} stored ${result.outsideDays.length === 1 ? 'Day is' : 'Days are'} outside this range.`, [{ text: 'Keep range', style: 'cancel' }, { text: 'Remove outside Days', style: 'destructive', onPress: () => void done(true) }]);
    setEditing(false); setError(null);
  };
  const resumeDiary = async () => {
    const instantiated = [...diary.days].sort((a, b) => a.date.localeCompare(b.date));
    const saved = session?.userId ? await getLastViewedDiaryDay(session.userId, diary.id) : null;
    const date = saved && instantiated.some((day) => day.date === saved) ? saved : instantiated[0]?.date ?? diary.startDate;
    if (date) router.push({ pathname: '/diaries/[diaryId]/day', params: { diaryId: diary.id, date } });
    else router.navigate(`/diaries/${diary.id}/contents` as Href);
  };
  return <ScrollView contentContainerStyle={{ gap: Space.xxl, paddingBottom: Space.xxl }} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} />, headerRight: () => null, title: 'Diary Cover' }} />
    <TripImageCollage emptyLabel="Diary cover" images={coverImages} style={{ aspectRatio: 1.45, width: '100%' }} />
    <View style={{ gap: Space.lg, paddingHorizontal: Screen.gutter }}>
      {editing ? <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, gap: Space.md, padding: Space.lg }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><AppText style={{ flex: 1 }} variant="section">Edit Cover</AppText><FinishEditAction accessibilityLabel="Finish editing Diary Cover" size="default" onPress={() => void done()} /><IconAction accessibilityLabel="Delete Diary" destructive icon="delete-outline" onPress={() => Alert.alert('Delete Diary', `This removes “${diary.title}” from this device.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteDiary(diary.id).then(() => router.replace('/diaries')) }])} /></View>
        <DiaryAutosaveField accessibilityLabel="Diary title" autoFocus inputStyle={Type.title} placeholder="Diary title" value={diary.title} onSave={(title) => title.trim() ? updateDiaryMetadata(diary.id, { title: title.trim() }) : Promise.reject(new Error('Diary title required'))} />
        <DiaryAutosaveField accessibilityLabel="Diary introduction" multiline placeholder="Introduction (optional)" value={diary.description ?? ''} onSave={(description) => updateDiaryMetadata(diary.id, { description: description.trim() || null })} />
        <AppTextInput accessibilityLabel="Diary start date" placeholder="Start date d/m/y" value={start} onChangeText={setStart} />
        <AppTextInput accessibilityLabel="Diary end date" placeholder="End date d/m/y" value={end} onChangeText={setEnd} />
        {photoChoices.length ? <View style={{ gap: Space.sm }}><AppText variant="label">Cover photo or automatic collage</AppText><ScrollView horizontal showsHorizontalScrollIndicator={false}>{photoChoices.map((photo) => <Pressable key={photo.url} accessibilityLabel="Use photo as Diary cover" onPress={() => void updateDiaryMetadata(diary.id, { coverPhotoAssetId: photo.url })} style={{ marginRight: Space.sm, padding: Space.md, borderColor: diary.coverPhotoAssetId === photo.url ? Palette.trip : Palette.border, borderRadius: Radius.small, borderWidth: 1 }}><AppText variant="caption">Select photo</AppText></Pressable>)}</ScrollView><AppButton label="Use automatic collage" variant="secondary" onPress={() => void updateDiaryMetadata(diary.id, { coverPhotoAssetId: null })} /></View> : <AppText color={Palette.textMuted} variant="caption">Add Diary photos to make an automatic cover collage.</AppText>}
        {error ? <AppText color={Palette.danger}>{error}</AppText> : null}
      </View> : <><View style={{ gap: Space.md }}><View style={{ alignItems: 'center', flexDirection: 'row' }}><AppText style={{ flex: 1 }} variant="title">{diary.title}</AppText><IconAction accessibilityLabel="Edit Diary Cover" icon="edit" size="compact" trip onPress={beginEdit} /></View>{diary.description ? <AppText>{diary.description}</AppText> : null}<AppText color={Palette.textMuted}>{diary.startDate || diary.endDate ? [formatDiaryDate(diary.startDate), formatDiaryDate(diary.endDate)].filter(Boolean).join(' – ') : 'No date range yet'}</AppText></View><View accessibilityLabel="Diary modes" style={{ flexDirection: 'row', gap: Space.md }}><CoverModeTile icon="menu-book" label="Diary" onPress={() => void resumeDiary()} /><CoverModeTile icon="map" label="Map" onPress={() => router.push({ pathname: '/diaries/[diaryId]/map', params: { diaryId: diary.id } })} /></View></>}
    </View>
  </ScrollView>;
}
