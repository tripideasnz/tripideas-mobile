import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/provider';
import { NotebookAutosaveField, type NotebookAutosaveFieldHandle } from '@/components/notebook/autosave-field';
import { NotebookObjectToolbar, type NotebookObjectAction } from '@/components/notebook/object-toolbar';
import { DragReorderRow } from '@/components/ui/drag-reorder-row';
import { PlacePhotoGrid } from '@/components/place-photo-grid';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { SavedLinkCapture } from '@/components/ui/saved-link-capture';
import { FinishEditAction } from '@/components/ui/finish-edit-action';
import { FloatingStructuralAdd } from '@/components/ui/floating-structural-add';
import { FloatingContentAdd } from '@/components/ui/floating-content-add';
import { SavedPlaceSelector, type SavedPlaceSelection } from '@/components/ui/saved-place-selector';
import { SavedObjectEditorShell } from '@/components/ui/saved-object-editor-shell';
import { SavedObjectFocusScope, SavedObjectReveal } from '@/components/ui/saved-object-focus';
import { SavedLinkObject, SavedPinObject, SavedPlaceObject, savedPlaceLabel } from '@/components/ui/saved-object-presentations';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { IconAction } from '@/components/ui/icon-action';
import { LoadingView } from '@/components/ui/loading-view';
import { ShowMoreText } from '@/components/ui/show-more-text';
import { pagesFromContentBlocks } from '@/content-blocks/pages';
import { moveContentBlockIds, orderedContentBlocks } from '@/content-blocks/ordering';
import type { ContentBlock, ContentPage, PhotoContentBlock, PlaceContentBlock, TextContentBlock } from '@/content-blocks/types';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { getOneForegroundLocation } from '@/location/foreground';
import { checkApiCapability, type ApiCapabilityStatus } from '@/lib/api-compatibility';
import { isHttpUrl } from '@/lib/url';
import { classifyNotebookError } from '@/notebooks/errors';
import { groupContiguousNotebookPhotos, moveContiguousNotebookBlockIds } from '@/notebooks/presentation';
import { authorizePhotoRead } from '@/notebooks/api';
import { useNotebooks } from '@/notebooks/provider';
import { addNotebookPhotos, listNotebookPhotoPreviews, resumeNotebookPhotos } from '@/notebook-photo-blocks/service';
import { usePersonalPlaceCards } from '@/personal-place-cards/provider';
import { pickPhotosForUpload } from '@/photo-uploads/picker';

type Capture =
  | { action: 'Link'; pageId: string; clientRequestId: string }
  | { action: Exclude<NotebookObjectAction, 'Link'>; pageId: string }
  | null;

export default function NotebookDetailScreen() {
  const router = useRouter();
  const { notebookId: rawNotebookId } = useLocalSearchParams<{ notebookId: string }>();
  const notebookId = Array.isArray(rawNotebookId) ? rawNotebookId[0] : rawNotebookId;
  const { isLoading: sessionLoading, session, signIn } = useSession();
  const { cards } = usePersonalPlaceCards();
  const { details, loadNotebook, mutate } = useNotebooks();
  const detail = notebookId ? details[notebookId] : undefined;
  const pages = useMemo(() => detail ? detail.pages ?? pagesFromContentBlocks(detail.items) : [], [detail]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [capability, setCapability] = useState<ApiCapabilityStatus | 'checking'>('checking');
  const [editingNotebook, setEditingNotebook] = useState(false);
  const [editingPages, setEditingPages] = useState<Set<string>>(new Set());
  const [editingBlocks, setEditingBlocks] = useState<Set<string>>(new Set());
  const activeContentPageId = [...editingPages].at(-1);
  const [capture, setCapture] = useState<Capture>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [pendingPreviews, setPendingPreviews] = useState<Record<string, string[]>>({});
  const [photoBusyPage, setPhotoBusyPage] = useState<string | null>(null);
  const [pendingPhotoCount, setPendingPhotoCount] = useState(0);
  const autosaveRefs = useRef<Record<string, NotebookAutosaveFieldHandle | null>>({});
  const photoAttempts = useRef<Record<string, number>>({});
  const scrollRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null!);
  const [revealPageId, setRevealPageId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!notebookId || !session) { setLoading(false); return; }
    setLoading(true); setMessage(null); setNotFound(false);
    try { await loadNotebook(notebookId, true); setOffline(false); }
    catch (error) {
      const failure = classifyNotebookError(error);
      setOffline(failure === 'offline');
      setNotFound(failure === 'not-found');
      if (!detail && failure !== 'offline') setMessage('Could not load this Notebook.');
    } finally { setLoading(false); }
  }, [detail, loadNotebook, notebookId, session]);

  useEffect(() => { void reload(); /* identity-scoped provider owns subsequent refreshes */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId, session?.userId]);
  useEffect(() => { let active = true; void checkApiCapability('notebook-object-blocks-v2').then((result) => { if (active) setCapability(result); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!session || !notebookId) return;
    void listNotebookPhotoPreviews(session.userId, notebookId).then(setPendingPreviews);
    void resumeNotebookPhotos(session.userId, notebookId, mutate.addPhotoBlock).then(({ pendingCount }) => setPendingPhotoCount(pendingCount));
  }, [mutate.addPhotoBlock, notebookId, session]);

  const refreshPhoto = useCallback(async (assetId: string) => {
    try { const result = await authorizePhotoRead(assetId); setPhotoUrls((current) => ({ ...current, [assetId]: result.url })); }
    catch { /* retain the safe placeholder or last in-memory URL */ }
  }, []);
  useEffect(() => {
    for (const block of pages.flatMap((page) => page.blocks)) {
      if (block.type === 'photo' && !photoUrls[block.photoAssetId]) void refreshPhoto(block.photoAssetId);
    }
  }, [pages, photoUrls, refreshPhoto]);
  useEffect(() => { if (!session) { setPhotoUrls({}); setPendingPreviews({}); } }, [session]);

  const run = async (operation: () => Promise<unknown>) => {
    setMessage(null);
    try { await operation(); setOffline(false); return true; }
    catch (error) {
      const failure = classifyNotebookError(error);
      setOffline(failure === 'offline');
      setNotFound(failure === 'not-found');
      setMessage(failure === 'conflict' ? 'This Notebook changed elsewhere. Reload and try again.' :
        failure === 'validation' ? 'Check this content and try again.' : 'Could not save. Please try again.');
      return false;
    }
  };
  const register = (key: string) => (handle: NotebookAutosaveFieldHandle | null) => { autosaveRefs.current[key] = handle; };
  const flush = async (keys: string[]) => {
    const results = await Promise.allSettled(keys.map((key) => autosaveRefs.current[key]?.flush()));
    if (results.some((result) => result.status === 'rejected')) throw new Error('pending_autosave_failed');
  };

  if (sessionLoading) return <LoadingView />;
  if (!session) return <SafeAreaView style={{ backgroundColor: Palette.background, flex: 1 }}><View style={{ gap: Space.lg, padding: Screen.gutter }}><AppText variant="title">Private Notebook</AppText><AppText>Sign in to view this Notebook.</AppText><AppButton label="Sign in" onPress={signIn} /></View></SafeAreaView>;
  if (notFound) return <SafeAreaView style={{ backgroundColor: Palette.background, flex: 1 }}><View style={{ gap: Space.lg, padding: Screen.gutter }}><AppText variant="title">Notebook unavailable</AppText><AppText color={Palette.textMuted}>It may have been deleted, or you may no longer have access.</AppText><AppButton label="Back to Notebooks" onPress={() => router.dismissTo('/notebooks')} /></View></SafeAreaView>;
  if (loading && !detail) return <LoadingView />;
  if (!detail) return <SafeAreaView style={{ backgroundColor: Palette.background, flex: 1 }}><View style={{ gap: Space.lg, padding: Screen.gutter }}><AppText color={Palette.danger}>{message ?? 'Could not load this Notebook.'}</AppText><AppButton label="Retry" onPress={() => void reload()} /></View></SafeAreaView>;

  const v2Enabled = capability === 'supported' && !offline;
  const addPage = () => run(async () => { const latest = await mutate.addBlock(detail.id, { type: 'text', text: '' }); const page = latest.pages?.at(-1); if (page) { setRevealPageId(page.id); setEditingPages((current) => new Set(current).add(page.id)); } });
  const deletePage = (page: ContentPage) => {
    const body = page.blocks.find((block): block is TextContentBlock => block.type === 'text' && block.role === 'pageBody');
    if (!body) return;
    Alert.alert('Delete this Page?', 'This Page and every object inside it will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete Page', style: 'destructive', onPress: () => void run(() => mutate.deleteBlock(detail.id, body.id)) }]);
  };
  const deleteObject = (block: ContentBlock) => void run(() => mutate.deleteObjectBlock(detail.id, block.id));
  const move = (page: ContentPage, block: ContentBlock, offset: -1 | 1) => {
    const ids = moveContentBlockIds(page.blocks, block.id, offset);
    if (ids) void run(() => mutate.reorderPageBlocks(detail.id, page.id, ids));
  };
  const movePhotoRun = (page: ContentPage, blocks: PhotoContentBlock[], offset: -1 | 1) => {
    const ids = moveContiguousNotebookBlockIds(page.blocks, blocks.map(({ id }) => id), offset);
    if (ids) void run(() => mutate.reorderPageBlocks(detail.id, page.id, ids));
  };
  const addPhoto = async (pageId: string) => {
    const selected = await pickPhotosForUpload(); if (!selected.length) return;
    setPendingPreviews((current) => ({ ...current, [pageId]: selected.map(({ uri }) => uri) }));
    setPhotoBusyPage(pageId);
    try {
      const result = await addNotebookPhotos(session.userId, detail.id, pageId, selected, mutate.addPhotoBlock);
      const next = await listNotebookPhotoPreviews(session.userId, detail.id); setPendingPreviews(next);
      setPendingPhotoCount(Object.values(next).reduce((count, values) => count + values.length, 0));
      if (result.errors.length) setMessage('Some photo uploads paused. Retry when connectivity returns.');
    } finally { setPhotoBusyPage(null); }
  };
  const openCapture = (pageId: string, action: NotebookObjectAction) => {
    if (action === 'Text') { void run(async () => { const latest = await mutate.addTextBlock({ id: detail.id, pageId, clientRequestId: Crypto.randomUUID(), title: null, text: '' }); const created = latest.pages?.find(({ id }) => id === pageId)?.blocks.at(-1); if (created) setEditingBlocks((current) => new Set(current).add(created.id)); }); return; }
    if (action === 'Photo') { void addPhoto(pageId); return; }
    setCapture(action === 'Link'
      ? { pageId, action, clientRequestId: Crypto.randomUUID() }
      : { pageId, action });
  };
  const confirmPlace = async (selectedPlace: SavedPlaceSelection) => {
    if (!capture || capture.action !== 'Place') return;
    const pageId = capture.pageId;
    const saved = selectedPlace.kind === 'editorial'
      ? await run(() => { const { place } = selectedPlace; const latitude = place.coordinates?.lat; const longitude = place.coordinates?.lng; return mutate.addPlaceBlock({ id: detail.id, pageId, clientRequestId: Crypto.randomUUID(), titleSnapshot: place.title || 'TripIdeas Place', reference: { kind: 'editorial', editorialPlaceId: place._id! }, locationSnapshot: typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude, accuracyMeters: null } : null }); })
      : await run(() => { const { card } = selectedPlace; return mutate.addPlaceBlock({ id: detail.id, pageId, clientRequestId: Crypto.randomUUID(), titleSnapshot: card.title || 'Personal Place', reference: { kind: 'personal', personalPlaceCardId: card.id }, locationSnapshot: card.location ? { latitude: card.location.latitude, longitude: card.location.longitude, accuracyMeters: null } : null }); });
    if (saved) setCapture(null);
  };
  const pinNow = async (pageId: string) => {
    const result = await getOneForegroundLocation();
    if (result.status !== 'granted') { Alert.alert('Location unavailable', result.status === 'denied' ? 'Permission was not granted. You can still use Locate on map.' : 'Try Locate on map instead.'); return; }
    const saved = await run(() => mutate.addPinBlock({ id: detail.id, pageId, clientRequestId: Crypto.randomUUID(), title: null, location: { ...result.point, source: 'PIN_NOW' } }));
    if (saved) setCapture(null);
  };

  return <SafeAreaView edges={['bottom']} style={{ backgroundColor: Palette.background, flex: 1 }}>
    <Stack.Screen options={{ headerLeft: () => <HeaderBackButton color={Palette.trip} fallbackHref="/notebooks" /> }} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88} style={{ flex: 1 }}>
      <SavedObjectFocusScope contentRef={scrollContentRef} scrollRef={scrollRef}><ScrollView ref={scrollRef} innerViewRef={scrollContentRef} contentContainerStyle={{ gap: Space.xl, paddingBottom: Screen.bottom, paddingHorizontal: Screen.gutter, paddingTop: Screen.top }} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
        {offline ? <Notice text="Offline: showing saved content. Editing is unavailable." /> : null}
        {capability === 'unreachable' ? <Notice text="Could not verify object editing right now. Saved Notebook content remains available." /> : null}
        {capability === 'unsupported' ? <Notice text="This API does not support Notebook objects-v2. Existing content remains readable." /> : null}
        {message ? <AppText color={Palette.danger}>{message}</AppText> : null}
        {pendingPhotoCount ? <AppButton label="Retry Photo Uploads" size="compact" variant="secondary" onPress={() => void resumeNotebookPhotos(session.userId, detail.id, mutate.addPhotoBlock).then(({ pendingCount }) => setPendingPhotoCount(pendingCount))} /> : null}

        {editingNotebook ? <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.card, gap: Space.md, padding: Space.lg }}>
          <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: Space.sm }}><View style={{ flex: 1 }}><NotebookAutosaveField ref={register('notebook-title')} accessibilityLabel="Notebook title" maxLength={200} placeholder="Notebook title" textVariant="title" value={detail.title} onSave={(title) => title.trim() ? mutate.updateMetadata(detail.id, { title: title.trim() }).then(() => title.trim()) : Promise.reject(new Error('title_required'))} /></View><FinishEditAction accessibilityLabel="Finish editing Notebook" size="default" onPress={() => void flush(['notebook-title', 'notebook-description']).then(() => setEditingNotebook(false)).catch(() => setMessage('Could not save. Tap the status to retry.'))} /></View>
          <NotebookAutosaveField ref={register('notebook-description')} accessibilityLabel="Notebook description" maxLength={10_000} multiline placeholder="Optional description" value={detail.description ?? ''} onSave={(description) => mutate.updateMetadata(detail.id, { description: description.trim() ? description : null }).then(() => description)} />
        </View> : <View style={{ gap: Space.sm }}><View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><AppText style={{ flex: 1 }} variant="title">{detail.title}</AppText><IconAction accessibilityLabel="Edit Notebook title and description" icon="edit" semantic="edit" onPress={() => setEditingNotebook(true)} /></View>{detail.description ? <ShowMoreText accessibilityLabel="Notebook description" value={detail.description} /> : null}</View>}

        {pages.length ? pages.map((page, pageIndex) => <SavedObjectReveal key={page.id} revealKey={revealPageId === page.id ? page.id : null}><NotebookPage notebookId={detail.id} page={page} pageIndex={pageIndex} editing={editingPages.has(page.id)} v2Enabled={v2Enabled}
          photoUrls={photoUrls} pendingPreviews={pendingPreviews[page.id] ?? []} photoBusy={photoBusyPage === page.id}
          cards={cards} editingBlocks={editingBlocks} register={register}
          onEdit={() => setEditingPages((current) => new Set(current).add(page.id))}
          onFinish={async () => { await flush(Object.keys(autosaveRefs.current)); setEditingPages((current) => { const next = new Set(current); next.delete(page.id); return next; }); setEditingBlocks(new Set()); }}
          onDelete={() => deletePage(page)}
          onToolbar={(action) => openCapture(page.id, action)} onRemove={deleteObject} onMove={(block, offset) => move(page, block, offset)}
          onMovePhotoRun={(blocks, offset) => movePhotoRun(page, blocks, offset)}
          onSaveBlock={(block, input) => mutate.updateRichBlock(detail.id, block.id, input)}
          onExpand={(id) => setEditingBlocks((current) => new Set(current).add(id))} onCollapse={(id) => setEditingBlocks((current) => { const next = new Set(current); next.delete(id); return next; })}
          onPhotoError={(block) => { const attempts = photoAttempts.current[block.photoAssetId] ?? 0; if (attempts < 2) { photoAttempts.current[block.photoAssetId] = attempts + 1; void refreshPhoto(block.photoAssetId); } }} /></SavedObjectReveal>) : <AppText color={Palette.textMuted}>No Pages yet. Add one to start writing.</AppText>}
      </ScrollView></SavedObjectFocusScope>
    </KeyboardAvoidingView>
    {activeContentPageId ? <FloatingContentAdd disabled={!v2Enabled || Boolean(photoBusyPage)}>{(close) => <><AppText variant="section">Add content to this Page</AppText><NotebookObjectToolbar disabled={!v2Enabled || Boolean(photoBusyPage)} onSelect={(action) => { close(); if (action === 'Photo') setTimeout(() => openCapture(activeContentPageId, action), 350); else openCapture(activeContentPageId, action); }} /></>}</FloatingContentAdd> : null}
    <FloatingStructuralAdd accessibilityLabel="Add Page" disabled={offline} onPress={() => void addPage()} />

    <Modal animationType="slide" onRequestClose={() => setCapture(null)} transparent visible={Boolean(capture)}><View style={{ backgroundColor: 'rgba(0,0,0,0.28)', flex: 1, justifyContent: 'flex-end' }}><View style={{ backgroundColor: Palette.surface, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, gap: Space.md, maxHeight: '82%', padding: Screen.gutter }}>
      {capture?.action === 'Link' ? <SavedLinkCapture onCancel={() => setCapture(null)} onSave={async ({ title, url }) => { const saved = await run(() => mutate.addLinkBlock({ id: detail.id, pageId: capture.pageId, url, title, text: null, clientRequestId: capture.clientRequestId })); if (saved) setCapture(null); }} /> : null}
      {capture?.action === 'Place' ? <SavedPlaceSelector cards={cards} onCancel={() => setCapture(null)} onConfirm={confirmPlace} /> : null}
      {capture?.action === 'Pin' ? <><AppText variant="section">Choose a Pin location</AppText><AppButton label="Locate now" onPress={() => void pinNow(capture.pageId)} /><AppButton label="Locate on map" variant="secondary" onPress={() => { const pageId = capture.pageId; setCapture(null); router.push({ pathname: '/notebooks/location-picker', params: { notebookId: detail.id, pageId } }); }} /><AppButton label="Cancel" variant="secondary" onPress={() => setCapture(null)} /></> : null}
    </View></View></Modal>
  </SafeAreaView>;
}

function NotebookPage({ notebookId, page, pageIndex, editing, v2Enabled, photoUrls, pendingPreviews, photoBusy, cards, editingBlocks, register, onEdit, onFinish, onDelete, onToolbar, onRemove, onMove, onMovePhotoRun, onSaveBlock, onExpand, onCollapse, onPhotoError }: {
  notebookId: string; page: ContentPage; pageIndex: number; editing: boolean; v2Enabled: boolean;
  photoUrls: Record<string, string>; pendingPreviews: string[]; photoBusy: boolean; cards: ReturnType<typeof usePersonalPlaceCards>['cards'];
  editingBlocks: Set<string>;
  register: (key: string) => (handle: NotebookAutosaveFieldHandle | null) => void;
  onEdit: () => void; onFinish: () => Promise<void>; onDelete: () => void;
  onToolbar: (action: NotebookObjectAction) => void; onRemove: (block: ContentBlock) => void; onMove: (block: ContentBlock, offset: -1 | 1) => void;
  onMovePhotoRun: (blocks: PhotoContentBlock[], offset: -1 | 1) => void;
  onSaveBlock: (block: ContentBlock, input: { title?: string | null; text?: string | null; url?: string }) => Promise<unknown>;
  onExpand: (id: string) => void; onCollapse: (id: string) => void; onPhotoError: (block: Extract<ContentBlock, { type: 'photo' }>) => void;
}) {
  const blocks = orderedContentBlocks(page.blocks);
  const body = blocks.find((block): block is TextContentBlock => block.type === 'text' && block.role === 'pageBody');
  const presentedBlocks = groupContiguousNotebookPhotos(blocks.filter((block) => block.id !== body?.id));
  return <View style={{ borderColor: Palette.border, borderRadius: Radius.card, borderWidth: 1, gap: Space.md, padding: Space.lg }}>
    <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: Space.xs }}><View style={{ flex: 1 }}>
      {editing && body ? <NotebookAutosaveField ref={register(`${page.id}:${body.id}:title`)} accessibilityLabel={`Page ${pageIndex + 1} title`} maxLength={200} placeholder="Page title" textVariant="section" value={body.title ?? ''} onSave={(title) => onSaveBlock(body, { title: title.trim() || null }).then(() => title)} /> : <AppText variant="section">{body?.title || `Page ${pageIndex + 1}`}</AppText>}
    </View>
      {editing ? <FinishEditAction accessibilityLabel={`Finish editing Page ${pageIndex + 1}`} onPress={() => void onFinish().catch(() => undefined)} /> : <IconAction accessibilityLabel={`Edit Page ${pageIndex + 1}`} icon="edit" semantic="edit" onPress={onEdit} size="compact" />}
      <IconAction accessibilityLabel={`Delete Page ${pageIndex + 1}`} destructive icon="delete-outline" onPress={onDelete} size="compact" />
    </View>
    {editing && body ? <NotebookAutosaveField ref={register(`${page.id}:${body.id}:body`)} accessibilityLabel={`Page ${pageIndex + 1} body`} maxLength={100_000} multiline placeholder="Write something…" value={body.text} onSave={(text) => onSaveBlock(body, { text }).then(() => text)} /> : body?.text ? <ShowMoreText accessibilityLabel={`Page ${pageIndex + 1} body`} value={body.text} /> : null}
    {presentedBlocks.map((item, index) => item.kind === 'photos'
      ? <NotebookPhotoRun key={item.blocks.map(({ id }) => id).join(':')} blocks={item.blocks} canMoveDown={index < presentedBlocks.length - 1} canMoveUp={index > 0} editingPage={editing} photoUrls={photoUrls} onMove={(offset) => onMovePhotoRun(item.blocks, offset)} onPhotoError={onPhotoError} onRemove={onRemove} />
      : <NotebookObject key={item.block.id} notebookId={notebookId} block={item.block} index={index} count={presentedBlocks.length} editingPage={editing} expanded={editingBlocks.has(item.block.id)} cards={cards}
        register={register} onSaveBlock={onSaveBlock} onRemove={() => onRemove(item.block)} onMove={(offset) => onMove(item.block, offset)} onExpand={() => onExpand(item.block.id)} onCollapse={() => onCollapse(item.block.id)} />)}
    {pendingPreviews.length ? <SavedObjectReveal revealKey={`${page.id}:photos`}><View style={{ gap: Space.sm }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>{pendingPreviews.map((uri, index) => <Image key={`${uri}-${index}`} accessibilityLabel={`Pending Notebook photo ${index + 1}`} source={{ uri }} style={{ aspectRatio: 1, borderRadius: Radius.control, opacity: 0.65, width: '47%' }} />)}</View><AppText color={Palette.textMuted} variant="caption">{pendingPreviews.length} photo {pendingPreviews.length === 1 ? 'upload' : 'uploads'} pending</AppText></View></SavedObjectReveal> : null}
  </View>;
}

function NotebookObject({ notebookId, block, index, count, editingPage, expanded, cards, register, onSaveBlock, onRemove, onMove, onExpand, onCollapse }: {
  notebookId: string; block: Exclude<ContentBlock, PhotoContentBlock>; index: number; count: number; editingPage: boolean; expanded: boolean;
  cards: ReturnType<typeof usePersonalPlaceCards>['cards']; register: (key: string) => (handle: NotebookAutosaveFieldHandle | null) => void;
  onSaveBlock: (block: ContentBlock, input: { title?: string | null; text?: string | null; url?: string }) => Promise<unknown>;
  onRemove: () => void; onMove: (offset: -1 | 1) => void; onExpand: () => void; onCollapse: () => void;
}) {
  const router = useRouter();
  const content = <View style={{ gap: Space.sm }}>
    {block.type === 'text' ? expanded ? <><NotebookAutosaveField ref={register(`${block.id}:title`)} accessibilityLabel="Text title" maxLength={200} placeholder="Optional title" textVariant="cardTitle" value={block.title ?? ''} onSave={(title) => onSaveBlock(block, { title: title.trim() || null }).then(() => title)} /><NotebookAutosaveField ref={register(`${block.id}:body`)} accessibilityLabel="Text body" maxLength={10_000} multiline placeholder="Write something…" value={block.text} onSave={(text) => onSaveBlock(block, { text }).then(() => text)} /></> : <View>{block.title ? <AppText variant="bodyStrong">{block.title}</AppText> : null}<ShowMoreText accessibilityLabel="Text body" value={block.text || 'Empty content'} /></View> : null}
    {block.type === 'link' ? <>{<SavedLinkObject note={block.text} title={block.title} url={block.url} />}{expanded ? <><NotebookAutosaveField ref={register(`${block.id}:title`)} accessibilityLabel="Link title" maxLength={200} placeholder="Optional title" value={block.title ?? ''} onSave={(title) => onSaveBlock(block, { title: title.trim() || null }).then(() => title)} /><NotebookAutosaveField ref={register(`${block.id}:url`)} accessibilityLabel="Link URL" placeholder="https://…" value={block.url} onSave={(url) => isHttpUrl(url) ? onSaveBlock(block, { url: url.trim() }).then(() => url.trim()) : Promise.reject(new Error('invalid_url'))} /><NotebookAutosaveField ref={register(`${block.id}:note`)} accessibilityLabel="Link note" maxLength={10_000} multiline placeholder="Optional note" value={block.text ?? ''} onSave={(text) => onSaveBlock(block, { text: text.trim() || null }).then(() => text)} /></> : null}</> : null}
    {block.type === 'place' ? <SavedPlaceObject available={block.availability === 'available'} kind={block.reference.kind === 'personal' ? 'personal' : 'editorial'} onPress={block.availability === 'available' ? () => openCanonicalPlace(router, notebookId, block) : undefined} showLabel={false} title={placeTitle(block, cards)} /> : null}
    {block.type === 'pin' ? <><SavedPinObject detail={`${block.location.latitude.toFixed(5)}, ${block.location.longitude.toFixed(5)}`} onShowMap={() => router.push({ pathname: '/map', params: { lat: String(block.location.latitude), lng: String(block.location.longitude), title: block.title || 'Saved Pin', origin: 'notebook', notebookId } })} title={block.title} />{expanded ? <><NotebookAutosaveField ref={register(`${block.id}:title`)} accessibilityLabel="Pin label" maxLength={200} placeholder="Optional label" value={block.title ?? ''} onSave={(title) => onSaveBlock(block, { title: title.trim() || null }).then(() => title)} /><AppButton label="Change location" variant="secondary" onPress={() => router.push({ pathname: '/notebooks/location-picker', params: { notebookId, blockId: block.id, latitude: String(block.location.latitude), longitude: String(block.location.longitude) } })} /></> : null}</> : null}
  </View>;
  return editingPage ? <SavedObjectEditorShell canMoveDown={index < count - 1} canMoveUp={index > 0} collapsed={content} editable={block.type !== 'place'} expanded={expanded} label={objectName(block).toUpperCase()} onCollapse={onCollapse} onExpand={onExpand} onMove={onMove} onRemove={onRemove}>{content}</SavedObjectEditorShell> : <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.control, padding: Space.md }}><AppText color={Palette.textMuted} variant="label">{objectName(block).toUpperCase()}</AppText>{content}</View>;
}

function NotebookPhotoRun({ blocks, canMoveDown, canMoveUp, editingPage, photoUrls, onMove, onPhotoError, onRemove }: {
  blocks: PhotoContentBlock[]; canMoveDown: boolean; canMoveUp: boolean; editingPage: boolean; photoUrls: Record<string, string>;
  onMove: (offset: -1 | 1) => void; onPhotoError: (block: PhotoContentBlock) => void; onRemove: (block: ContentBlock) => void;
}) {
  const images = blocks.flatMap((block) => { const url = photoUrls[block.photoAssetId]; return url ? [{ _key: block.id, alt: 'Notebook photo', url }] : []; });
  const grid = images.length ? <PlacePhotoGrid bottomMargin={0} images={images} onImageError={(image) => { const block = blocks.find(({ id }) => id === image._key); if (block) onPhotoError(block); }} onRemoveImage={editingPage ? (image) => { const block = blocks.find(({ id }) => id === image._key); if (block) onRemove(block); } : undefined} placeTitle="Notebook" /> : <AppText color={Palette.textMuted}>Photos loading…</AppText>;
  return editingPage ? <DragReorderRow canMoveDown={canMoveDown} canMoveUp={canMoveUp} header={<AppText color={Palette.textMuted} variant="label">PHOTOS</AppText>} label={blocks.length === 1 ? 'Photo' : 'Photo group'} onMove={onMove}>{grid}</DragReorderRow> : <View style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.control, gap: Space.sm, padding: Space.md }}><AppText color={Palette.textMuted} variant="label">PHOTOS</AppText>{grid}</View>;
}

function openCanonicalPlace(router: ReturnType<typeof useRouter>, notebookId: string, block: PlaceContentBlock) {
  if (block.reference.kind === 'personal') {
    router.push({ pathname: '/personal-place-cards/[cardId]', params: { cardId: block.reference.personalPlaceCardId, mode: 'view', notebookId, origin: 'notebook' } });
    return;
  }
  router.push({ pathname: '/place/[slug]', params: { slug: block.reference.editorialPlaceId, editorialPlaceId: block.reference.editorialPlaceId, notebookId, origin: 'notebook' } });
}

function objectName(block: ContentBlock) { return block.type === 'text' ? 'Text' : block.type === 'photo' ? 'Photo' : block.type === 'link' ? 'Link' : block.type === 'place' ? savedPlaceLabel(block.reference.kind === 'personal' ? 'personal' : 'editorial') : 'Pin'; }
function placeTitle(block: Extract<ContentBlock, { type: 'place' }>, cards: ReturnType<typeof usePersonalPlaceCards>['cards']) {
  if (block.reference.kind === 'personal') {
    const personalPlaceCardId = block.reference.personalPlaceCardId;
    return cards.find(({ id }) => id === personalPlaceCardId)?.title || block.titleSnapshot || 'Personal Place';
  }
  return block.titleSnapshot || 'TripIdeas Place';
}
function Notice({ text }: { text: string }) { return <View accessibilityRole="alert" style={{ backgroundColor: Palette.surfaceMuted, borderRadius: Radius.control, padding: Space.lg }}><AppText>{text}</AppText></View>; }
