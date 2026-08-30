import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiaryAutosaveField } from '@/components/diary/autosave-field';
import { FinishEditAction } from '@/components/diary/finish-edit-action';
import { DiaryPhotoGrid } from '@/components/diary/photo-grid';
import { useOrderedDiaryPhotoImages } from '@/components/diary/photo-assets';
import { TripImageCollage } from '@/components/trip-image-collage';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { IconAction } from '@/components/ui/icon-action';
import { LoadingView } from '@/components/ui/loading-view';
import { SignedOutFeature } from '@/components/signed-out-feature';
import { SavedAutosaveScope } from '@/components/ui/saved-autosave-field';
import { useSession } from '@/auth/provider';
import { Palette, Radius, Screen, Space, Type } from '@/constants/design';
import { formatDiaryDate, formatDiaryDateInput, parseDiaryDate, validateDiaryDateRange } from '@/diaries/dates';
import { useDiaries } from '@/diaries/provider';
import { getLastViewedDiaryDay } from '@/diaries/last-viewed';
import { diaryCoverAssetIds } from '@/diaries/model';
import { uploadDiaryPhotos } from '@/diaries/photos';
import { pickPhotosForUpload } from '@/photo-uploads/picker';

function CoverModeTile({ icon, label, onPress }: { icon: 'map' | 'menu-book'; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={`Open Diary ${label}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', borderColor: Palette.border, borderRadius: Radius.card, borderWidth: 1, flex: 1, gap: Space.sm, minHeight: 132, justifyContent: 'center', opacity: pressed ? 0.6 : 1, padding: Space.lg })}><MaterialIcons color={Palette.trip} name={icon} size={58} /><AppText variant="label">{label.toUpperCase()}</AppText></Pressable>;
}

export default function DiaryCoverScreen() {
  const router = useRouter(); const { isLoading: sessionLoading, session, signIn } = useSession();
  const { diaryId, editCover } = useLocalSearchParams<{ diaryId: string; editCover?: string }>();
  const { canEdit, canEditMedia, canRetryPending, deleteDiary, diaries, isDetailLoaded, loadDiary, loadError, mutationError, retryPending, updateDateRange, updateDiaryMetadata } = useDiaries();
  const diary = diaries.find(({ id }) => id === diaryId);
  const opensInEditMode = editCover === '1';
  const [editing, setEditing] = useState<boolean>(opensInEditMode && canEdit);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [start, setStart] = useState(() => formatDiaryDateInput(diary?.startDate ?? null));
  const [end, setEnd] = useState(() => formatDiaryDateInput(diary?.endDate ?? null));
  const [error, setError] = useState<string | null>(null);
  const selectedCoverIds = diary ? diaryCoverAssetIds(diary) : [];
  const { images: coverImages } = useOrderedDiaryPhotoImages(selectedCoverIds, diary?.title || 'Diary cover');
  const [coverBusy, setCoverBusy] = useState(false);
  useEffect(() => {
    if (!diaryId || isDetailLoaded(diaryId)) return;
    void loadDiary(diaryId).catch(() => setDetailError('This Diary could not be loaded. Check your connection and try again.'));
  }, [diaryId, isDetailLoaded, loadDiary]);
  if (sessionLoading) return <LoadingView />;
  if (!session) return <SignedOutFeature message="Sign in to view and edit your private Diaries" onSignIn={signIn} />;
  if (!diary) return <View style={{ padding: Screen.gutter }}><AppText>This Diary is not available on this device.</AppText></View>;
  if (!isDetailLoaded(diary.id)) return detailError ? <View style={{ padding: Screen.gutter }}><AppText color={Palette.danger}>{detailError}</AppText></View> : <LoadingView />;
  const setCoverIds = (assetIds: string[]) => updateDiaryMetadata(diary.id, { coverPhotoAssetId: assetIds[0] ?? null, coverPhotoAssetIds: assetIds });
  const chooseCoverPhotos = async () => {
    if (!session?.userId || coverBusy) return;
    setCoverBusy(true); setError(null);
    try {
      const availableSlots = Math.max(0, 4 - selectedCoverIds.length);
      const selected = await pickPhotosForUpload(availableSlots || 4);
      if (!selected.length) return;
      const result = await uploadDiaryPhotos(session.userId, selected);
      if (result.assetIds.length) {
        const nextIds = availableSlots
          ? [...selectedCoverIds, ...result.assetIds].slice(0, 4)
          : result.assetIds.slice(0, 4);
        await setCoverIds(nextIds);
      }
      if (result.errors.length) setError(`${result.errors.length} ${result.errors.length === 1 ? 'photo' : 'photos'} could not be uploaded. Try again.`);
    } catch { setError('Cover photos could not be uploaded. Check your connection and try again.'); }
    finally { setCoverBusy(false); }
  };
  const beginEdit = () => { setStart(formatDiaryDateInput(diary.startDate)); setEnd(formatDiaryDateInput(diary.endDate)); setError(null); setEditing(true); };
  const done = async (flush: () => Promise<void>, confirmRemoval = false) => {
    const startDate = start.trim() ? parseDiaryDate(start) : null; const endDate = end.trim() ? parseDiaryDate(end) : null;
    if ((start.trim() && !startDate) || (end.trim() && !endDate)) return setError('Enter dates in DD/MM/YYYY format, for example 05/09/2026.');
    const rangeError = validateDiaryDateRange(startDate, endDate); if (rangeError) return setError(rangeError);
    setError(null);
    try {
      await flush();
      const result = await updateDateRange(diary.id, startDate, endDate, confirmRemoval);
      if (result.outsideDays.length) return Alert.alert('Diary content outside new range', `${result.outsideDays.length} stored ${result.outsideDays.length === 1 ? 'Day is' : 'Days are'} outside this range.`, [{ text: 'Keep range', style: 'cancel' }, { text: 'Remove outside Days', style: 'destructive', onPress: () => void done(flush, true) }]);
      setEditing(false); setError(null);
    } catch { setError('Could not save. Use the field retry status, then finish editing again.'); }
  };
  const resumeDiary = async () => {
    const instantiated = [...diary.days].sort((a, b) => a.date.localeCompare(b.date));
    const saved = session?.userId ? await getLastViewedDiaryDay(session.userId, diary.id) : null;
    const date = saved && instantiated.some((day) => day.date === saved) ? saved : instantiated[0]?.date ?? (canEdit ? diary.startDate : null);
    if (date) router.push({ pathname: '/diaries/[diaryId]/day', params: { diaryId: diary.id, date } });
    else router.navigate(`/diaries/${diary.id}/contents` as Href);
  };
  return <SafeAreaView edges={['bottom']} style={{ backgroundColor: Palette.background, flex: 1 }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView contentContainerStyle={{ gap: editing ? Space.sm : Space.xxl, paddingBottom: Screen.bottom }} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} fallbackHref="/diaries" />, headerRight: () => null, title: 'Diary Cover' }} />
    {editing && canEditMedia && selectedCoverIds.length ? <View style={{ position: 'relative', paddingHorizontal: Screen.gutter }}><DiaryPhotoGrid assetIds={selectedCoverIds} bottomMargin={0} label={`${diary.title} cover`} onRemoveAsset={(assetId) => void setCoverIds(selectedCoverIds.filter((id) => id !== assetId))} /><Pressable accessibilityLabel={selectedCoverIds.length < 4 ? 'Add Diary cover photos' : 'Replace Diary cover photos'} accessibilityRole="button" disabled={coverBusy} onPress={() => void chooseCoverPhotos()} style={({ pressed }) => ({ alignItems: 'center', backgroundColor: Palette.surface, borderColor: Palette.trip, borderRadius: Radius.pill, borderWidth: 1, height: 44, justifyContent: 'center', opacity: coverBusy ? 0.55 : pressed ? 0.65 : 1, position: 'absolute', right: Screen.gutter + Space.sm, top: Space.sm, width: 44 })}><MaterialIcons color={Palette.trip} name={selectedCoverIds.length < 4 ? 'add-photo-alternate' : 'photo-library'} size={24} /></Pressable></View> : <Pressable accessibilityLabel={coverImages.length ? 'Diary cover photos' : 'Diary has no cover photos'} accessibilityRole="image" disabled={!canEditMedia || coverBusy} onPress={() => coverImages.length ? beginEdit() : void chooseCoverPhotos()} style={({ pressed }) => ({ opacity: canEditMedia && pressed ? 0.75 : 1 })}>
      {coverImages.length ? <TripImageCollage emptyLabel="Diary cover" images={coverImages} style={{ aspectRatio: 1.45, width: '100%' }} /> : <View style={{ alignItems: 'center', aspectRatio: 1.45, backgroundColor: Palette.surfaceMuted, gap: Space.sm, justifyContent: 'center', width: '100%' }}><MaterialIcons color={Palette.textMuted} name="photo-library" size={38} /><AppText color={Palette.textMuted} variant="bodyStrong">No cover photos</AppText></View>}
    </Pressable>}
    <View style={{ gap: Space.lg, paddingHorizontal: Screen.gutter }}>
      {editing ? <SavedAutosaveScope>{(flush) => <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, gap: Space.sm, padding: Space.lg }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><AppText style={{ flex: 1 }} variant="section">Edit Cover</AppText><FinishEditAction accessibilityLabel="Finish editing Diary Cover" size="default" onPress={() => void done(flush)} /><IconAction accessibilityLabel="Delete Diary" destructive icon="delete-outline" onPress={() => Alert.alert('Delete Diary', `This removes “${diary.title}” from this device.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteDiary(diary.id).then(() => router.replace('/diaries')) }])} /></View>
        <DiaryAutosaveField accessibilityLabel="Diary title" autoExpand autoFocus={!opensInEditMode} inputStyle={Type.title} maxLength={200} placeholder="Diary title" value={diary.title} onSave={(title) => title.trim() ? updateDiaryMetadata(diary.id, { title: title.trim() }) : Promise.reject(new Error('Diary title required'))} />
        <DiaryAutosaveField accessibilityLabel="Diary introduction" multiline placeholder="Introduction (optional)" value={diary.description ?? ''} onSave={(description) => updateDiaryMetadata(diary.id, { description: description.trim() || null })} />
        <AppTextInput accessibilityLabel="Diary start date" placeholder="Start date DD/MM/YYYY" value={start} onChangeText={setStart} />
        <AppTextInput accessibilityLabel="Diary end date" placeholder="End date DD/MM/YYYY" value={end} onChangeText={setEnd} />
        {error ? <AppText color={Palette.danger}>{error}</AppText> : null}
      </View>}</SavedAutosaveScope> : <><View style={{ gap: Space.md }}><View style={{ alignItems: 'center', flexDirection: 'row' }}><AppText style={{ flex: 1 }} variant="title">{diary.title}</AppText>{canEdit ? <IconAction accessibilityLabel="Edit Diary Cover" icon="edit" size="compact" trip onPress={beginEdit} /> : null}</View>{diary.description ? <AppText>{diary.description}</AppText> : null}<AppText color={Palette.textMuted}>{diary.startDate || diary.endDate ? [formatDiaryDate(diary.startDate), formatDiaryDate(diary.endDate)].filter(Boolean).join(' – ') : 'No date range yet'}</AppText>{mutationError || loadError ? <AppText color={mutationError ? Palette.danger : Palette.textMuted} variant="caption">{mutationError ?? loadError}</AppText> : null}{canRetryPending ? <AppButton label="Retry pending Diary changes" onPress={() => void retryPending()} variant="secondary" /> : null}{canEdit && !canEditMedia ? <AppText color={Palette.textMuted} variant="caption">Diary photo editing will be enabled in the photo integration stage.</AppText> : null}</View><View accessibilityLabel="Diary modes" style={{ flexDirection: 'row', gap: Space.md }}><CoverModeTile icon="menu-book" label="Diary" onPress={() => void resumeDiary()} /><CoverModeTile icon="map" label="Map" onPress={() => router.push({ pathname: '/diaries/[diaryId]/map', params: { diaryId: diary.id } })} /></View></>}
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
