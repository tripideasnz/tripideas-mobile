import { Camera, Map as MapLibreMap, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MapPin } from '@/components/map/map-pin';
import { MapZoomControls } from '@/components/map/map-controls';
import { useMapSelection } from '@/components/map/use-map-selection';
import { DiaryViewMenu } from '@/components/diary/view-menu';
import { AppText } from '@/components/ui/app-text';
import { HeaderBackButton as SharedHeaderBackButton } from '@/components/ui/header-back-button';
import { Palette, Radius, Screen, Shadow, Space } from '@/constants/design';
import { MAP_STYLE_URL } from '@/constants/map';
import { diaryMapFeatures } from '@/diaries/model';
import { formatDiaryDate } from '@/diaries/dates';
import { useDiaries } from '@/diaries/provider';
import { useSession } from '@/auth/provider';
import { LoadingView } from '@/components/ui/loading-view';
import { SignedOutFeature } from '@/components/signed-out-feature';

export default function DiaryMapScreen() {
  const router = useRouter();
  const { isLoading: sessionLoading, session, signIn } = useSession();
  const { diaryId, dayId } = useLocalSearchParams<{ diaryId: string; dayId?: string }>(); const { diaries } = useDiaries();
  const diary = diaries.find(({ id }) => id === diaryId); const camera = useRef<CameraRef>(null); const zoom = useRef(10); const [ready, setReady] = useState(false);
  const allFeatures = useMemo(() => diary ? diaryMapFeatures(diary) : [], [diary]);
  const openFeature = useCallback((feature: (typeof allFeatures)[number]) => router.push({ pathname: '/diaries/[diaryId]/day', params: { diaryId: feature.diaryId, date: diary?.days.find(({ id }) => id === feature.dayId)?.date ?? '', topicId: feature.topicId, itemId: feature.itemId } }), [diary?.days, router]);
  const { activate: activateFeature, clear: clearSelectedFeature, selectedId: selectedItemId } = useMapSelection(openFeature);
  const focusFeatures = useMemo(() => dayId ? allFeatures.filter((feature) => feature.dayId === dayId) : allFeatures, [allFeatures, dayId]);
  const cameraFeatures = focusFeatures.length ? focusFeatures : allFeatures;
  const selectedFeature = allFeatures.find(({ itemId }) => itemId === selectedItemId); const selectedDay = diary?.days.find(({ id }) => id === selectedFeature?.dayId); const selectedTopic = selectedDay?.topics.find(({ id }) => id === selectedFeature?.topicId);
  const sourceDay = diary?.days.find(({ id }) => id === dayId);
  const mapFallback = dayId && sourceDay
    ? { pathname: '/diaries/[diaryId]/day' as const, params: { diaryId, date: sourceDay.date } }
    : { pathname: '/diaries/[diaryId]' as const, params: { diaryId } };
  const HeaderBackButton = ({ color }: { color: string }) => <SharedHeaderBackButton color={color} fallbackHref={mapFallback} />;
  useEffect(() => { if (!ready || !cameraFeatures.length) return; const lngs = cameraFeatures.map(({ longitude }) => longitude); const lats = cameraFeatures.map(({ latitude }) => latitude); if (cameraFeatures.length === 1) camera.current?.easeTo({ center: [lngs[0], lats[0]], zoom: 13, duration: 350 }); else camera.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { padding: { top: 56, right: 48, bottom: 56, left: 48 }, duration: 350 }); }, [cameraFeatures, ready]);
  if (sessionLoading) return <LoadingView />;
  if (!session) return <SignedOutFeature message="Sign in to view and edit your private Diaries" onSignIn={signIn} />;
  return <View style={{ backgroundColor: Palette.background, flex: 1 }}><Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} />, headerRight: () => diary ? <DiaryViewMenu diaryId={diary.id} /> : null, title: dayId ? 'Day Map' : 'Diary Map' }} />{allFeatures.length ? <><MapLibreMap mapStyle={MAP_STYLE_URL} onDidFinishLoadingMap={() => setReady(true)} onPress={clearSelectedFeature} onRegionDidChange={(event) => { zoom.current = event.nativeEvent.zoom; }} style={{ flex: 1 }}><Camera ref={camera} />{allFeatures.map((feature) => <Marker key={feature.itemId} lngLat={[feature.longitude, feature.latitude]}><Pressable accessibilityLabel={`${feature.label || 'Diary location'}${selectedItemId === feature.itemId ? ', selected. Activate again to open.' : ''}`} accessibilityRole="button" accessibilityState={{ selected: selectedItemId === feature.itemId }} hitSlop={8} onPress={(event) => { event.stopPropagation(); activateFeature(feature.itemId, feature); }}><MapPin emphasis={selectedItemId === feature.itemId ? 'selected' : !dayId || feature.dayId === dayId ? 'focused' : 'default'} /></Pressable></Marker>)}</MapLibreMap><View style={{ bottom: selectedFeature ? 132 : Space.lg, position: 'absolute', right: Space.md }}><MapZoomControls onZoomInPress={() => { zoom.current += 1; camera.current?.zoomTo(zoom.current, { duration: 250 }); }} onZoomOutPress={() => { zoom.current -= 1; camera.current?.zoomTo(zoom.current, { duration: 250 }); }} /></View>{selectedFeature && selectedDay && selectedTopic ? <Pressable accessibilityLabel={`Open ${selectedTopic.title || 'Diary Topic'} on ${selectedDay.date}`} accessibilityRole="button" onPress={() => openFeature(selectedFeature)} style={({ pressed }) => ({ ...Shadow.floating, backgroundColor: Palette.surface, borderColor: Palette.trip, borderRadius: Radius.card, borderWidth: 1, bottom: Space.lg, gap: Space.xs, left: Space.md, opacity: pressed ? 0.65 : 1, padding: Space.md, position: 'absolute', right: Space.md })}><AppText variant="bodyStrong">{selectedTopic.title || 'Untitled Topic'}</AppText><AppText numberOfLines={1}>{selectedFeature.label || (selectedFeature.kind === 'LOCATION' ? 'Saved location' : 'Diary Place')}</AppText><AppText color={Palette.textMuted} variant="caption">{formatDiaryDate(selectedDay.date)}</AppText></Pressable> : null}</> : <View style={{ padding: Screen.gutter }}><AppText color={Palette.textMuted}>No selected Diary locations yet.</AppText></View>}</View>;
}
