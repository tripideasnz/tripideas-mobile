import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Linking, Modal, PanResponder, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiaryAutosaveField } from '@/components/diary/autosave-field';
import { FinishEditAction } from '@/components/diary/finish-edit-action';
import { DiaryObjectEditorShell, type DiaryObjectLabel } from '@/components/diary/object-editor-shell';
import { DiaryObjectToolbar, type DiaryObjectAction } from '@/components/diary/object-toolbar';
import { DiaryPhotoGrid } from '@/components/diary/photo-grid';
import { DiaryViewMenu } from '@/components/diary/view-menu';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { IconAction } from '@/components/ui/icon-action';
import { PlainIconAction } from '@/components/ui/plain-icon-action';
import { LoadingView } from '@/components/ui/loading-view';
import { SignedOutFeature } from '@/components/signed-out-feature';
import { useSession } from '@/auth/provider';
import { Palette, Radius, Screen, Shadow, Space, Type } from '@/constants/design';
import { adjacentDiaryDate, diaryDateRange, formatDiaryDate, offsetDiaryDate } from '@/diaries/dates';
import { diaryMapFeatures } from '@/diaries/model';
import { setLastViewedDiaryDay } from '@/diaries/last-viewed';
import { useDiaries } from '@/diaries/provider';
import { formatDiaryTopicTime, parseDiaryTopicTime } from '@/diaries/times';
import { uploadDiaryPhotos } from '@/diaries/photos';
import type { DiaryItem, DiaryTopic } from '@/diaries/types';
import { getOneForegroundLocation } from '@/location/foreground';
import { pickPhotosForUpload } from '@/photo-uploads/picker';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import { sanityClient } from '@/sanity/client';
import { SEARCH_QUERY } from '@/sanity/queries';
import type { PlaceCardData } from '@/types/content';

type Capture = { action: Exclude<DiaryObjectAction, 'Narrative' | 'Photo'>; topicId: string } | null;
const httpUrl = (value: string) => /^https?:\/\/[^\s]+$/i.test(value.trim());
const objectLabel = (item: DiaryItem): DiaryObjectLabel => item.type === 'LOCATION' ? 'PIN' : item.type === 'EDITORIAL_PLACE' || item.type === 'PERSONAL_PLACE' ? 'PLACE' : item.type;
const domain = (url: string) => new URL(url).hostname.replace(/^www\./, '');

function CompletedItem({ item }: { item: DiaryItem }) {
  if (item.type === 'NARRATIVE') return item.title || item.text.trim() ? <View style={{ gap: Space.xs }}>{item.title ? <AppText variant="bodyStrong">{item.title}</AppText> : null}{item.text.trim() ? <AppText>{item.text}</AppText> : null}</View> : null;
  if (item.type === 'LINK') return <View style={{ gap: Space.xs }}><Pressable accessibilityLabel={`Open ${item.title || item.url}`} accessibilityRole="link" onPress={() => void Linking.openURL(item.url)} style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.55 : 1 })}><AppText color={Palette.trip} style={{ textDecorationLine: 'underline' }} variant="bodyStrong">{item.title || domain(item.url)}</AppText></Pressable>{item.note ? <AppText>{item.note}</AppText> : null}</View>;
  if (item.type === 'LOCATION') return <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><MaterialIcons color={Palette.trip} name="location-on" size={20} /><AppText variant="bodyStrong">{item.label || 'Saved location'}</AppText></View>;
  if (item.type === 'EDITORIAL_PLACE' || item.type === 'PERSONAL_PLACE') return <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><MaterialIcons color={Palette.trip} name="place" size={20} /><AppText variant="bodyStrong">{item.presentationTitle}</AppText></View>;
  return null;
}

function CompletedTopic({ onEdit, topic }: { onEdit: () => void; topic: DiaryTopic }) {
  const ordered = [...topic.items].sort((a, b) => a.position - b.position);
  const content: ReactNode[] = [];
  for (let index = 0; index < ordered.length;) {
    const item = ordered[index];
    if (item.type !== 'PHOTO') { content.push(<CompletedItem item={item} key={item.id} />); index += 1; continue; }
    const photos: Extract<DiaryItem, { type: 'PHOTO' }>[] = [];
    while (ordered[index]?.type === 'PHOTO') { photos.push(ordered[index] as Extract<DiaryItem, { type: 'PHOTO' }>); index += 1; }
    content.push(<DiaryPhotoGrid assetIds={photos.map(({ photoAssetId }) => photoAssetId)} key={`photos:${photos.map(({ id }) => id).join('|')}`} label={`${topic.title || 'Diary Topic'} photos`} />);
  }
  return <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, gap: Space.md, padding: Space.md }}><View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: Space.md }}><View style={{ flex: 1, gap: Space.xs }}><AppText color={topic.title ? Palette.text : Palette.textMuted} variant="section">{topic.title || 'Untitled Topic'}</AppText>{topic.startTime ? <AppText color={Palette.textMuted} variant="caption">{formatDiaryTopicTime(topic.startTime)}</AppText> : null}</View><IconAction accessibilityLabel={`Edit ${topic.title || 'Topic'}`} icon="edit" size="compact" trip onPress={onEdit} /></View>{content}</View>;
}

function CollapsedItem({ item }: { item: DiaryItem }) {
  if (item.type === 'NARRATIVE') return <View style={{ gap: Space.xs }}>{item.title ? <AppText numberOfLines={1} variant="bodyStrong">{item.title}</AppText> : null}<AppText color={Palette.textBody} numberOfLines={2}>{item.text || 'Empty narrative'}</AppText></View>;
  if (item.type === 'LINK') return <View style={{ gap: Space.xs }}><AppText numberOfLines={1} variant="bodyStrong">{item.title || domain(item.url)}</AppText><AppText color={Palette.textMuted} numberOfLines={1} variant="caption">{domain(item.url)}</AppText></View>;
  if (item.type === 'LOCATION') return <AppText numberOfLines={1} variant="bodyStrong">{item.label || 'Saved location'}</AppText>;
  if (item.type === 'EDITORIAL_PLACE' || item.type === 'PERSONAL_PLACE') return <AppText numberOfLines={1} variant="bodyStrong">{item.presentationTitle}</AppText>;
  return <AppText color={Palette.textMuted}>Photo</AppText>;
}

function TopicPhotoManagement({ onRemove, topic }: { onRemove: (itemId: string) => void; topic: DiaryTopic }) {
  const photos = [...topic.items]
    .sort((a, b) => a.position - b.position)
    .filter((item): item is Extract<DiaryItem, { type: 'PHOTO' }> => item.type === 'PHOTO');
  if (!photos.length) return null;
  return <DiaryPhotoGrid
    assetIds={photos.map(({ photoAssetId }) => photoAssetId)}
    label={`${topic.title || 'Diary Topic'} selected photos`}
    onRemoveAsset={(assetId) => {
      const item = photos.find(({ photoAssetId }) => photoAssetId === assetId);
      if (item) onRemove(item.id);
    }}
  />;
}

export default function DiaryDayScreen() {
  const router = useRouter(); const params = useLocalSearchParams<{ diaryId: string; date: string }>();
  const insets = useSafeAreaInsets(); const { height: viewportHeight } = useWindowDimensions(); const scrollRef = useRef<ScrollView>(null);
  const pendingRevealTopicId = useRef<string | null>(null); const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isLoading: sessionLoading, session, signIn } = useSession();
  const actions = useDiaries(); const { cards } = usePersonalPlaceCards();
  const diary = actions.diaries.find(({ id }) => id === params.diaryId); const date = params.date; const day = diary?.days.find((value) => value.date === date);
  const ensuredDate = useRef<string | null>(null); const actionsRef = useRef(actions); actionsRef.current = actions;
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null); const [expandedItemId, setExpandedItemId] = useState<string | null>(null); const [focusTopicId, setFocusTopicId] = useState<string | null>(null); const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [pendingMapPin, setPendingMapPin] = useState<{ itemIds: string[]; topicId: string } | null>(null);
  const [editingDay, setEditingDay] = useState(false); const [capture, setCapture] = useState<Capture>(null); const [linkQuery, setLinkQuery] = useState('');
  const [placeQuery, setPlaceQuery] = useState(''); const [editorialPlaces, setEditorialPlaces] = useState<PlaceCardData[]>([]); const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [photoBusyTopicId, setPhotoBusyTopicId] = useState<string | null>(null);
  useEffect(() => { setActiveTopicId(null); setExpandedItemId(null); setCapture(null); if (diary?.id && date && ensuredDate.current !== date) { ensuredDate.current = date; void actionsRef.current.ensureDay(diary.id, date); } }, [date, diary?.id]);
  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);
  useEffect(() => { if (session?.userId && diary?.id && date && day?.id) void setLastViewedDiaryDay(session.userId, diary.id, date); }, [date, day?.id, diary?.id, session?.userId]);
  useEffect(() => { if (!pendingMapPin || !day) return; const topic = day.topics.find(({ id }) => id === pendingMapPin.topicId); const created = topic?.items.find(({ id }) => !pendingMapPin.itemIds.includes(id)); if (created) { setActiveTopicId(pendingMapPin.topicId); setExpandedItemId(created.id); setPendingMapPin(null); } }, [day, pendingMapPin]);
  useEffect(() => {
    if (capture?.action !== 'Place' || !placeQuery.trim()) { setEditorialPlaces([]); setSearchingPlaces(false); return; }
    let active = true; const timer = setTimeout(() => { setSearchingPlaces(true); void sanityClient.fetch<PlaceCardData[]>(SEARCH_QUERY, { term: `*${placeQuery.trim()}*` }).then((result) => { if (active) setEditorialPlaces((result ?? []).filter((place) => place?._id)); }).catch(() => { if (active) setEditorialPlaces([]); }).finally(() => { if (active) setSearchingPlaces(false); }); }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [capture?.action, placeQuery]);
  const dates = useMemo(() => diary ? (diaryDateRange(diary.startDate, diary.endDate).length ? diaryDateRange(diary.startDate, diary.endDate) : diary.days.map((value) => value.date).sort()) : [], [diary]);
  const hasBoundedRange = Boolean(diary?.endDate);
  const previous = adjacentDiaryDate(dates, date, -1);
  const next = adjacentDiaryDate(dates, date, 1) ?? (!hasBoundedRange ? offsetDiaryDate(date, 1) : null);
  const navigate = useCallback((offset: -1 | 1) => { setActiveTopicId(null); setExpandedItemId(null); const target = offset < 0 ? previous : next; if (!target || !diary) return; void actions.ensureDay(diary.id, target).then(() => router.replace({ pathname: '/diaries/[diaryId]/day', params: { diaryId: params.diaryId, date: target } })); }, [actions, diary, next, params.diaryId, previous, router]);
  const dayMapFeatures = diary ? diaryMapFeatures(diary).filter((feature) => feature.dayId === day?.id) : [];
  const swipe = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => activeTopicId === null && Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5, onPanResponderRelease: (_, gesture) => { if (gesture.dx > 60 && previous) navigate(-1); if (gesture.dx < -60 && next) navigate(1); } }), [activeTopicId, navigate, next, previous]);
  if (sessionLoading) return <LoadingView />;
  if (!session) return <SignedOutFeature message="Sign in to view and edit your private Diaries" onSignIn={signIn} />;
  if (!diary) return <View style={{ padding: Screen.gutter }}><AppText>This Diary is not available.</AppText></View>;
  const requireDay = () => day ? Promise.resolve(day) : actions.ensureDay(diary.id, date);
  const createTopic = () => void requireDay().then((target) => actions.addTopic(diary.id, target.id, '')).then((topic) => { pendingRevealTopicId.current = topic.id; setExpandedItemId(null); setFocusTopicId(topic.id); setActiveTopicId(topic.id); });
  const revealNewTopic = (topicId: string, y: number) => {
    if (pendingRevealTopicId.current !== topicId) return;
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      if (pendingRevealTopicId.current !== topicId) return;
      const keyboardHeight = Keyboard.metrics()?.height ?? 0; const visibleHeight = Math.max(280, viewportHeight - keyboardHeight - 120);
      scrollRef.current?.scrollTo({ animated: true, y: Math.max(0, y - visibleHeight * 0.42) });
      pendingRevealTopicId.current = null; revealTimer.current = null;
    }, 320);
  };
  const openCapture = (topicId: string, action: DiaryObjectAction) => {
    setPendingMapPin(null);
    if (action === 'Photo') {
      if (!session?.userId || !day || photoBusyTopicId) return;
      setPhotoBusyTopicId(topicId);
      void pickPhotosForUpload().then(async (selected) => {
        if (!selected.length) return;
        const result = await uploadDiaryPhotos(session.userId, selected);
        for (const photoAssetId of result.assetIds) {
          await actions.addItem(diary.id, day.id, topicId, { type: 'PHOTO', photoAssetId, caption: null, contentOrigin: 'USER_OWNED', includeOnMap: false });
        }
        if (result.errors.length) Alert.alert('Some photos were not added', `${result.errors.length} ${result.errors.length === 1 ? 'photo' : 'photos'} could not be uploaded. You can try again.`);
      }).catch(() => Alert.alert('Could not add photos', 'Please check your connection and try again.')).finally(() => setPhotoBusyTopicId(null));
      return;
    }
    if (action === 'Narrative') { if (!day) return; void actions.addItem(diary.id, day.id, topicId, { type: 'NARRATIVE', title: null, text: '', contentOrigin: 'USER_OWNED', includeOnMap: false }).then((item) => { setExpandedItemId(item.id); setFocusItemId(item.id); }); return; }
    setLinkQuery(''); setPlaceQuery(''); setEditorialPlaces([]); setCapture({ topicId, action });
  };
  const pinNow = async (topicId: string, itemId?: string) => {
    if (!day) return; const result = await getOneForegroundLocation();
    if (result.status !== 'granted') return Alert.alert('Location unavailable', result.status === 'denied' ? 'Permission was not granted. You can still use Locate on map.' : 'Try Locate on map instead.');
    if (itemId) await actions.updateItem(diary.id, day.id, topicId, itemId, { location: result.point });
    else { const item = await actions.addItem(diary.id, day.id, topicId, { type: 'LOCATION', label: null, location: result.point, contentOrigin: 'USER_OWNED', includeOnMap: true }); setExpandedItemId(item.id); }
    setCapture(null);
  };
  const selectPersonalPlace = async (topicId: string, card: (typeof cards)[number]) => { if (!day) return; await actions.addItem(diary.id, day.id, topicId, { type: 'PERSONAL_PLACE', personalPlaceCardId: card.id, presentationTitle: card.title || 'Personal Place', presentationBody: card.body, location: card.location ? { latitude: card.location.latitude, longitude: card.location.longitude } : null, contentOrigin: 'USER_OWNED', includeOnMap: Boolean(card.location) }); setExpandedItemId(null); setCapture(null); };
  const selectEditorialPlace = async (topicId: string, place: PlaceCardData) => { if (!day || !place._id) return; const latitude = place.coordinates?.lat; const longitude = place.coordinates?.lng; await actions.addItem(diary.id, day.id, topicId, { type: 'EDITORIAL_PLACE', editorialPlaceId: place._id, presentationTitle: place.title || 'TripIdeas Place', location: typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null, contentOrigin: 'TRIPIDEAS_SUPPLIED', includeOnMap: typeof latitude === 'number' && typeof longitude === 'number' }); setExpandedItemId(null); setCapture(null); };
  const captureTopicId = capture?.topicId;
  return <View {...swipe.panHandlers} style={{ backgroundColor: Palette.background, flex: 1 }}>
    <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} />, title: formatDiaryDate(date), headerRight: () => <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.md }}>{dayMapFeatures.length ? <Pressable accessibilityLabel="Open Day Map" accessibilityRole="button" hitSlop={12} onPress={() => router.push({ pathname: '/diaries/[diaryId]/map', params: { diaryId: diary.id, dayId: day!.id } })}><MaterialIcons color={Palette.trip} name="map" size={25} /></Pressable> : null}<DiaryViewMenu diaryId={diary.id} /></View> }} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView ref={scrollRef} contentContainerStyle={{ gap: Space.xxl, padding: Screen.gutter, paddingBottom: 112 }} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}><View accessibilityLabel="Day navigation" style={{ alignItems: 'center', flexDirection: 'row', gap: 0 }}><PlainIconAction accessibilityLabel="Previous day" disabled={!previous} icon="chevron-left" onPress={() => navigate(-1)} /><AppText variant="section">{formatDiaryDate(date)}</AppText><PlainIconAction accessibilityLabel="Next day" disabled={!next} icon="chevron-right" onPress={() => navigate(1)} /></View><View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><IconAction accessibilityLabel="Edit Day heading and summary" icon="edit" trip onPress={() => setEditingDay(true)} />{day ? <IconAction accessibilityLabel={`Delete ${formatDiaryDate(date)}`} destructive icon="delete-outline" onPress={() => Alert.alert('Delete Day', 'This removes the stored Day and its Topics. The date range is unchanged.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void actions.deleteDay(diary.id, day.id) }])} /> : null}</View></View>
      {editingDay ? <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, gap: Space.md, padding: Space.lg }}><View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: Space.sm }}><View style={{ flex: 1 }}><DiaryAutosaveField accessibilityLabel="Day heading" inputStyle={Type.title} placeholder="Day heading (optional)" value={day?.heading ?? ''} onSave={(heading) => requireDay().then((target) => actions.updateDay(diary.id, target.id, { heading: heading.trim() || null }))} /></View><FinishEditAction accessibilityLabel="Finish editing Day" size="default" onPress={() => setEditingDay(false)} /></View><DiaryAutosaveField accessibilityLabel="Day summary" multiline placeholder="Day summary (optional)" value={day?.summary ?? ''} onSave={(summary) => requireDay().then((target) => actions.updateDay(diary.id, target.id, { summary: summary.trim() || null }))} /></View> : <View style={{ gap: Space.sm }}>{day?.heading ? <AppText variant="title">{day.heading}</AppText> : null}{day?.summary ? <AppText>{day.summary}</AppText> : null}</View>}
      {!day?.topics.length ? <View accessibilityLabel="This Day is empty. Use the edit button to add a title and the plus button to add a Topic." style={{ alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Space.xs }}><AppText color={Palette.textMuted}>This Day is empty. Use the</AppText><MaterialIcons color={Palette.trip} name="edit" size={18} /><AppText color={Palette.textMuted}>to add a title and the</AppText><MaterialIcons color={Palette.trip} name="add" size={20} /><AppText color={Palette.textMuted}>to add a Topic.</AppText></View> : null}
      {[...(day?.topics ?? [])].sort((a, b) => a.position - b.position).map((topic) => activeTopicId !== topic.id ? <CompletedTopic key={topic.id} onEdit={() => { setCapture(null); setExpandedItemId(null); setFocusTopicId(null); setActiveTopicId(topic.id); }} topic={topic} /> : <View key={topic.id} onLayout={(event) => revealNewTopic(topic.id, event.nativeEvent.layout.y)} style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, gap: Space.sm, padding: Space.md }}>
        <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: Space.sm }}><View style={{ flex: 1, gap: Space.xs }}><DiaryAutosaveField accessibilityLabel={`Topic title ${topic.title || 'new Topic'}`} autoFocus={focusTopicId === topic.id} inputStyle={Type.section} placeholder="Title" value={topic.title} onSave={(title) => title.trim() ? actions.updateTopic(diary.id, day!.id, topic.id, { title: title.trim() }) : Promise.resolve()} /><View style={{ width: 144 }}><DiaryAutosaveField accessibilityLabel="Topic start time" maxLength={8} placeholder="Start time" value={topic.startTime ?? ''} onSave={async (value) => { const normalized = value.trim() ? parseDiaryTopicTime(value) : null; if (value.trim() && !normalized) throw new Error('Enter a valid start time'); await actions.updateTopic(diary.id, day!.id, topic.id, { startTime: normalized }); return normalized ?? ''; }} /></View></View><FinishEditAction accessibilityLabel="Finish editing Topic" onPress={() => { setCapture(null); setPendingMapPin(null); setExpandedItemId(null); setFocusItemId(null); setFocusTopicId(null); setActiveTopicId(null); }} /><IconAction accessibilityLabel={`Delete ${topic.title || 'Topic'}`} destructive icon="delete-outline" size="compact" onPress={() => Alert.alert('Delete Topic', `Delete “${topic.title || 'this Topic'}”?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { setActiveTopicId(null); void actions.deleteTopic(diary.id, day!.id, topic.id); } }])} /></View>
        <DiaryObjectToolbar onSelect={(action) => openCapture(topic.id, action)} />
        <TopicPhotoManagement topic={topic} onRemove={(itemId) => void actions.deleteItem(diary.id, day!.id, topic.id, itemId)} />
        {[...topic.items].sort((a, b) => a.position - b.position).filter((item) => item.type !== 'PHOTO').map((item) => { const compact = item.type === 'PERSONAL_PLACE' || item.type === 'EDITORIAL_PLACE'; return <DiaryObjectEditorShell key={item.id} label={objectLabel(item)} editable={!compact} expanded={!compact && expandedItemId === item.id} collapsed={<CollapsedItem item={item} />} canMoveUp={item.position > 0} canMoveDown={item.position < topic.items.length - 1} onCollapse={() => { setFocusItemId(null); setExpandedItemId(null); }} onExpand={() => { if (!compact) { setFocusItemId(null); setExpandedItemId(item.id); } }} onMove={(offset) => { setExpandedItemId(null); void actions.moveItem(diary.id, day!.id, topic.id, item.id, offset); }} onRemove={() => { if (expandedItemId === item.id) setExpandedItemId(null); void actions.deleteItem(diary.id, day!.id, topic.id, item.id); }}>
          {item.type === 'NARRATIVE' ? <View style={{ gap: Space.xs }}><DiaryAutosaveField accessibilityLabel="Narrative title" autoFocus={focusItemId === item.id} maxLength={200} placeholder="Optional title" value={item.title ?? ''} onSave={(title) => actions.updateItem(diary.id, day!.id, topic.id, item.id, { title: title.trim() || null })} /><DiaryAutosaveField accessibilityLabel="Diary narrative" maxLength={10_000} multiline placeholder="Write narrative…" value={item.text} onSave={(text) => actions.updateItem(diary.id, day!.id, topic.id, item.id, { text })} /></View> : null}
          {item.type === 'LINK' ? <View style={{ gap: Space.xs }}><Pressable accessibilityLabel={`Open ${item.title || item.url}`} accessibilityRole="link" onPress={() => void Linking.openURL(item.url)} style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.55 : 1 })}><AppText color={Palette.trip} style={{ textDecorationLine: 'underline' }} variant="bodyStrong">{item.title || domain(item.url)}</AppText></Pressable><AppText color={Palette.textMuted} variant="caption">{domain(item.url)}</AppText><AppText color={Palette.textMuted} variant="caption">Title</AppText><DiaryAutosaveField accessibilityLabel="Link title" maxLength={200} placeholder="Optional title" value={item.title ?? ''} onSave={(title) => actions.updateItem(diary.id, day!.id, topic.id, item.id, { title: title.trim() || null })} /><AppText color={Palette.textMuted} variant="caption">URL</AppText><DiaryAutosaveField accessibilityLabel="Link URL" placeholder="https://…" value={item.url} onSave={(url) => httpUrl(url) ? actions.updateItem(diary.id, day!.id, topic.id, item.id, { url: url.trim() }) : Promise.reject(new Error('Invalid URL'))} /><AppText color={Palette.textMuted} variant="caption">Note</AppText><DiaryAutosaveField accessibilityLabel="Link note" maxLength={10_000} multiline placeholder="Optional note" value={item.note ?? ''} onSave={(note) => actions.updateItem(diary.id, day!.id, topic.id, item.id, { note: note.trim() || null })} /></View> : null}
          {item.type === 'LOCATION' ? <View style={{ gap: Space.xs }}><DiaryAutosaveField accessibilityLabel="Location name" maxLength={200} placeholder="Optional location name" value={item.label ?? ''} onSave={(label) => actions.updateItem(diary.id, day!.id, topic.id, item.id, { label: label.trim() || null })} /><View style={{ flexDirection: 'row', gap: Space.sm }}><AppButton label="Locate now" onPress={() => void pinNow(topic.id, item.id)} style={{ flex: 1 }} /><AppButton label="Locate on map" variant="secondary" onPress={() => router.push({ pathname: '/diaries/location-picker', params: { diaryId: diary.id, dayId: day!.id, topicId: topic.id, itemId: item.id, latitude: String(item.location.latitude), longitude: String(item.location.longitude) } })} style={{ flex: 1 }} /></View></View> : null}
          {item.type === 'PERSONAL_PLACE' || item.type === 'EDITORIAL_PLACE' ? <AppText variant="bodyStrong">{item.presentationTitle}</AppText> : null}
        </DiaryObjectEditorShell>; })}
      </View>)}
    </ScrollView></KeyboardAvoidingView>
    <Pressable accessibilityLabel="Add Topic" accessibilityRole="button" onPress={createTopic} style={({ pressed }) => ({ ...Shadow.floating, alignItems: 'center', backgroundColor: Palette.trip, borderRadius: Radius.pill, bottom: Math.max(insets.bottom, Screen.bottom), height: 52, justifyContent: 'center', opacity: pressed ? 0.7 : 1, position: 'absolute', right: Screen.gutter, width: 52 })}><MaterialIcons color={Palette.textOnPrimary} name="add" size={28} /></Pressable>
    <Modal animationType="slide" onRequestClose={() => setCapture(null)} transparent visible={Boolean(capture)}><View style={{ backgroundColor: 'rgba(0,0,0,0.28)', flex: 1, justifyContent: 'flex-end' }}><View style={{ backgroundColor: Palette.surface, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, gap: Space.md, maxHeight: '82%', padding: Screen.gutter }}>
      {capture?.action === 'Link' ? <><AppText variant="section">Find a link</AppText><AppTextInput accessibilityLabel="Paste a URL or search term" autoCapitalize="none" autoFocus placeholder="Paste a URL or search term" value={linkQuery} onChangeText={setLinkQuery} /><AppText color={Palette.textMuted} variant="caption">Paste a link or search the web.</AppText>{httpUrl(linkQuery) ? <AppButton label="Use link" onPress={() => { if (!captureTopicId || !day) return; const url = linkQuery.trim(); void actions.addItem(diary.id, day.id, captureTopicId, { type: 'LINK', url, title: domain(url), note: null, contentOrigin: 'USER_OWNED', includeOnMap: false }).then((item) => { setExpandedItemId(item.id); setCapture(null); }); }} /> : <AppButton label="Open web" variant="secondary" onPress={() => linkQuery.trim() ? void Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(linkQuery.trim())}`) : undefined} />}<AppButton label="Cancel" variant="secondary" onPress={() => setCapture(null)} /></> : null}
      {capture?.action === 'Place' ? <><AppText variant="section">Choose a Place</AppText><AppTextInput accessibilityLabel="Search TripIdeas Places" autoFocus placeholder="Search TripIdeas Places" value={placeQuery} onChangeText={setPlaceQuery} /><ScrollView keyboardShouldPersistTaps="handled"><View style={{ gap: Space.md }}>{cards.length ? <><AppText color={Palette.textMuted} variant="label">PERSONAL PLACES</AppText>{cards.map((card) => <Pressable key={card.id} accessibilityLabel={`Choose ${card.title || 'Personal Place'}`} accessibilityRole="button" onPress={() => void selectPersonalPlace(captureTopicId!, card)} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, paddingVertical: Space.sm })}><AppText>{card.title || 'Personal Place'}</AppText></Pressable>)}</> : null}{placeQuery.trim() ? <><AppText color={Palette.textMuted} variant="label">TRIPIDEAS PLACES</AppText>{searchingPlaces ? <AppText color={Palette.textMuted}>Searching…</AppText> : editorialPlaces.length ? editorialPlaces.map((place) => <Pressable key={place._id} accessibilityLabel={`Choose ${place.title || 'TripIdeas Place'}`} accessibilityRole="button" onPress={() => void selectEditorialPlace(captureTopicId!, place)} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, paddingVertical: Space.sm })}><AppText>{place.title || 'TripIdeas Place'}</AppText></Pressable>) : <AppText color={Palette.textMuted}>No TripIdeas Places found.</AppText>}</> : null}</View></ScrollView><AppButton label="Cancel" variant="secondary" onPress={() => setCapture(null)} /></> : null}
      {capture?.action === 'Pin' ? <><AppText variant="section">Choose a Pin location</AppText><AppButton label="Locate now" onPress={() => captureTopicId ? void pinNow(captureTopicId) : undefined} /><AppButton label="Locate on map" variant="secondary" onPress={() => { if (!captureTopicId || !day) return; const topicId = captureTopicId; setPendingMapPin({ itemIds: day.topics.find(({ id }) => id === topicId)?.items.map(({ id }) => id) ?? [], topicId }); setCapture(null); router.push({ pathname: '/diaries/location-picker', params: { diaryId: diary.id, dayId: day.id, topicId } }); }} /><AppButton label="Cancel" variant="secondary" onPress={() => setCapture(null)} /></> : null}
    </View></View></Modal>
  </View>;
}
