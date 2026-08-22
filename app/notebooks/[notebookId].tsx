import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
    KeyboardAvoidingView,
    Modal,
  type LayoutChangeEvent,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/provider';
import { AppButton } from '@/components/ui/app-button';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { AutosaveStatus, type AutosaveState } from '@/components/ui/autosave-status';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { ExpandableText } from '@/components/ui/expandable-text';
import { IconAction } from '@/components/ui/icon-action';
import { LoadingView } from '@/components/ui/loading-view';
import { PlacePhotoGrid } from '@/components/place-photo-grid';
import {
  adjacentContentPageId,
  pagesFromContentBlocks,
} from '@/content-blocks/pages';
import { renderContentBlock } from '@/content-blocks/renderer';
import type { ContentBlock } from '@/content-blocks/types';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { classifyNotebookError } from '@/notebooks/errors';
import {
  reconcileAutosaveDraft,
  retryNotebookConflict,
  shouldAdoptAutosaveResponse,
} from '@/notebooks/autosave';
import {
  notebookBlockScrollOffset,
  validateNotebookMetadata,
} from '@/notebooks/model';
import {
  backFromNotebookDetail,
} from '@/notebooks/navigation';
import { useNotebooks } from '@/notebooks/provider';
import { authorizePhotoRead } from '@/notebooks/api';
import type { NotebookDetail } from '@/notebooks/types';
import { pickPhotosForUpload } from '@/photo-uploads/picker';
import { getOneForegroundLocation } from '@/location/foreground';
import {
  addNotebookPhotos,
  listNotebookPhotoPreviews,
  resumeNotebookPhotos,
} from '@/notebook-photo-blocks/service';

type SaveState = AutosaveState;
type RetryConflict = () => Promise<void>;
const AUTOSAVE_DELAY_MS = 700;

export default function NotebookDetailScreen() {
  const router = useRouter();
  const { notebookId: rawNotebookId } = useLocalSearchParams<{ notebookId: string }>();
  const notebookId = Array.isArray(rawNotebookId) ? rawNotebookId[0] : rawNotebookId;
  const { isLoading: isLoadingSession, session, signIn } = useSession();
  const {
    details,
    loadNotebook,
    mutate,
  } = useNotebooks();
  const detail = notebookId ? details[notebookId] : undefined;
  const pages = useMemo(
    () => detail ? detail.pages ?? pagesFromContentBlocks(detail.items) : [],
    [detail]
  );
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [editingPageIds, setEditingPageIds] = useState<Set<string>>(new Set());
  const [highlightedPageId, setHighlightedPageId] = useState<string | null>(null);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [metadataState, setMetadataState] = useState<SaveState>('idle');
  const [itemStates, setItemStates] = useState<Record<string, SaveState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [localPhotoPreviews, setLocalPhotoPreviews] = useState<
    Record<string, string[]>
  >({});
  const [photoBusyPage, setPhotoBusyPage] = useState<string | null>(null);
  const [pendingPhotoRetries, setPendingPhotoRetries] = useState(0);
  const [linkPageId, setLinkPageId] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [temporalEditor, setTemporalEditor] = useState<{
    blockId: string; precision: 'DATE' | 'DATETIME'; date: string; time: string;
  } | null>(null);
  const titleRef = useRef('');
  const descriptionRef = useRef('');
  const titleDraftsRef = useRef<Record<string, string>>({});
  const textDraftsRef = useRef<Record<string, string>>({});
  const metadataRevisionRef = useRef(0);
  const itemRevisionsRef = useRef<Record<string, number>>({});
  const metadataTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const retryConflictRef = useRef<RetryConflict | null>(null);
  const photoRefreshAttemptsRef = useRef<Record<string, number>>({});
  const initializedNotebookRef = useRef<string | null>(null);
  const hadAuthenticatedSessionRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const blockSectionOffset = useRef(0);
  const stickyToolbarHeight = useRef(0);
  const blockOffsets = useRef<Record<string, number>>({});
  const pageTitleRefs = useRef<Record<string, TextInput | null>>({});
  const pendingScrollRef = useRef<{ focusTitle: boolean; itemId: string } | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBack = useCallback(() => {
    backFromNotebookDetail(router);
  }, [router]);

  const finishPendingScroll = useCallback(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return false;
    const { focusTitle, itemId } = pending;
    const y = blockOffsets.current[itemId];
    if (y === undefined) return false;
    scrollRef.current?.scrollTo({
      animated: true,
      y: Math.max(
        0,
        notebookBlockScrollOffset(blockSectionOffset.current, y) -
          stickyToolbarHeight.current
      ),
    });
    if (focusTitle) {
      requestAnimationFrame(() => pageTitleRefs.current[itemId]?.focus());
    }
    pendingScrollRef.current = null;
    return true;
  }, []);

  const navigateToPage = useCallback((
    itemId: string,
    focusTitle = false
  ) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedPageId(itemId);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedPageId((current) => current === itemId ? null : current);
      highlightTimerRef.current = null;
    }, 500);
    pendingScrollRef.current = { focusTitle, itemId };
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      finishPendingScroll();
    });
  }, [finishPendingScroll]);

  const applyAuthoritativeDetail = useCallback((
    next: NotebookDetail,
    options: {
      metadataRevision?: number;
      resetDrafts?: boolean;
      savedItem?: { id: string; revision: number };
    } = {}
  ) => {
    const { metadataRevision, resetDrafts = false, savedItem } = options;
    const adoptMetadata =
      resetDrafts ||
      metadataRevisionRef.current === 0 ||
      (metadataRevision !== undefined &&
        shouldAdoptAutosaveResponse(
          metadataRevisionRef.current,
          metadataRevision
        ));
    if (adoptMetadata) {
      titleRef.current = next.title;
      descriptionRef.current = next.description ?? '';
      setTitle(next.title);
      setDescription(next.description ?? '');
    }

    const nextTitles: Record<string, string> = {};
    const nextTexts: Record<string, string> = {};
    const nextRevisions: Record<string, number> = {};
    for (const item of next.items) {
      if (item.type !== 'text') continue;
      const revision = itemRevisionsRef.current[item.id] ?? 0;
      const adoptItem =
        resetDrafts ||
        revision === 0 ||
        (savedItem?.id === item.id &&
          shouldAdoptAutosaveResponse(revision, savedItem.revision));
      nextTitles[item.id] = reconcileAutosaveDraft(
        item.title ?? '',
        titleDraftsRef.current[item.id] ?? item.title ?? '',
        revision,
        savedItem?.id === item.id ? savedItem.revision : -1,
        resetDrafts || revision === 0
      );
      nextTexts[item.id] = reconcileAutosaveDraft(
        item.text,
        textDraftsRef.current[item.id] ?? item.text,
        revision,
        savedItem?.id === item.id ? savedItem.revision : -1,
        resetDrafts || revision === 0
      );
      nextRevisions[item.id] = adoptItem ? 0 : revision;
    }
    titleDraftsRef.current = nextTitles;
    textDraftsRef.current = nextTexts;
    itemRevisionsRef.current = nextRevisions;
    setTitleDrafts(nextTitles);
    setTextDrafts(nextTexts);

    if (resetDrafts) {
      metadataRevisionRef.current = 0;
      setMetadataState('idle');
      setItemStates({});
    } else if (
      metadataRevision !== undefined &&
      metadataRevisionRef.current === metadataRevision
    ) {
      metadataRevisionRef.current = 0;
      setMetadataState('idle');
    }
    if (
      savedItem &&
      itemRevisionsRef.current[savedItem.id] === 0
    ) {
      setItemStates((current) => ({ ...current, [savedItem.id]: 'idle' }));
    }
    setConflict(false);
    retryConflictRef.current = null;
    setActionError(null);
    setIsOffline(false);
  }, []);

  const reload = useCallback(
    async (replaceDrafts: boolean) => {
      if (!notebookId) return;
      setIsLoading(true);
      setNotFound(false);
      setActionError(null);
      try {
        const latest = await loadNotebook(notebookId);
        if (latest && replaceDrafts) {
          applyAuthoritativeDetail(latest, { resetDrafts: true });
        }
        setConflict(false);
        setActionError(null);
        setNotFound(false);
        setIsOffline(false);
      } catch (error) {
        const failure = classifyNotebookError(error);
        setIsOffline(failure === 'offline');
        setNotFound(failure === 'not-found');
        if (
          !detailRef.current &&
          failure !== 'offline' &&
          failure !== 'not-found'
        ) {
          setActionError(
            failure === 'route-unavailable'
              ? 'Notebooks are unavailable on the connected API. Cached content remains available.'
              : 'Could not load this Notebook. Please try again.'
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [applyAuthoritativeDetail, loadNotebook, notebookId]
  );

  useEffect(() => {
    if (session) {
      hadAuthenticatedSessionRef.current = true;
      return;
    }
    setPhotoUrls({});
    setLocalPhotoPreviews({});
    if (!isLoadingSession && hadAuthenticatedSessionRef.current) {
      hadAuthenticatedSessionRef.current = false;
      router.replace('/notebooks');
    }
  }, [isLoadingSession, router, session]);

  useEffect(() => {
    if (!session || !notebookId) {
      setIsLoading(false);
      return;
    }
    void reload(!detail);
    // Load once for the requested identity. Provider updates flow through detail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId, session?.userId]);

  useEffect(() => {
    if (detail && initializedNotebookRef.current !== detail.id) {
      initializedNotebookRef.current = detail.id;
      applyAuthoritativeDetail(detail, { resetDrafts: true });
    }
  }, [applyAuthoritativeDetail, detail]);

  useEffect(() => {
    const ownerId = session?.userId;
    if (!ownerId || !notebookId) return;
    void listNotebookPhotoPreviews(ownerId, notebookId).then(
      setLocalPhotoPreviews
    );
    void resumeNotebookPhotos(
      ownerId,
      notebookId,
      mutate.addPhotoBlock
    ).then(({ completed, pendingCount }) => {
      setPendingPhotoRetries(pendingCount);
      const latest = completed.at(-1);
      if (latest) {
        setLocalPhotoPreviews({});
        applyAuthoritativeDetail(latest);
      }
    });
  }, [
    applyAuthoritativeDetail,
    mutate.addPhotoBlock,
    notebookId,
    session?.userId,
  ]);

  useEffect(() => {
    const photoIds = pages.flatMap((page) =>
      page.blocks
        .filter((block) => block.type === 'photo')
        .map((block) => block.photoAssetId)
    );
    for (const assetId of photoIds) {
      if (photoUrls[assetId]) continue;
      void refreshPhotoUrl(assetId);
    }
  }, [pages, photoUrls]);

  const refreshPhotoUrl = async (assetId: string) => {
    try {
      const authorization = await authorizePhotoRead(assetId);
      setPhotoUrls((current) => ({
        ...current,
        [assetId]: authorization.url,
      }));
    } catch { /* keep the current safe placeholder or last in-memory URL */ }
  };

  useEffect(() => () => {
    if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    Object.values(itemTimersRef.current).forEach(clearTimeout);
  }, []);

  const handleMutationError = (
    error: unknown,
    itemId?: string,
    retry?: RetryConflict,
    metadata = false
  ) => {
    const failure = classifyNotebookError(error);
    if (failure === 'conflict') {
      setConflict(true);
      setActionError('This Notebook changed elsewhere.');
      retryConflictRef.current = retry ?? null;
    } else if (failure === 'offline') {
      setIsOffline(true);
      setActionError('You appear to be offline. Your changes have not been saved.');
    } else if (failure === 'route-unavailable') {
      setActionError('Notebooks are unavailable on the connected API. Your changes have not been saved.');
    } else if (failure === 'not-found') {
      setNotFound(true);
    } else if (failure === 'validation') {
      setActionError('Check this content and try again.');
    } else {
      setActionError('Could not save.');
    }
    if (itemId) {
      setItemStates((current) => ({ ...current, [itemId]: 'failed' }));
    } else if (metadata) {
      setMetadataState('failed');
    }
  };

  if (isLoadingSession) return <LoadingView />;
  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
        <View style={{ gap: Space.lg, padding: Screen.gutter }}>
          <AppText variant="title">Private Notebook</AppText>
          <AppText>Sign in to view this Notebook.</AppText>
          <AppButton label="Sign in" onPress={signIn} />
        </View>
      </SafeAreaView>
    );
  }
  if (notFound) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
        <View style={{ gap: Space.lg, padding: Screen.gutter }}>
          <AppText variant="title">Notebook unavailable</AppText>
          <AppText color={Palette.textMuted}>
            It may have been deleted, or you may no longer have access.
          </AppText>
          <AppButton label="Back to Notebooks" onPress={() => router.replace('/notebooks')} />
        </View>
      </SafeAreaView>
    );
  }
  if (isLoading && !detail) return <LoadingView />;
  if (!detail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
        <View style={{ gap: Space.lg, padding: Screen.gutter }}>
          <AppText color={Palette.danger}>
            Could not load this Notebook.
          </AppText>
          <AppButton label="Retry" onPress={() => reload(true)} />
        </View>
      </SafeAreaView>
    );
  }

  const mutationDisabled = isOffline || conflict;
  const saveMetadata = async (revision: number) => {
    const validation = validateNotebookMetadata(
      titleRef.current,
      descriptionRef.current
    );
    if (!validation.valid) {
      setActionError(validation.message);
      setMetadataState('failed');
      return;
    }
    const current = detailRef.current;
    if (
      current &&
      validation.title === current.title &&
      validation.description === current.description
    ) {
      metadataRevisionRef.current = 0;
      setMetadataState('idle');
      setActionError(null);
      return;
    }
    setMetadataState('saving');
    setActionError(null);
    try {
      const latest = await mutate.updateMetadata(detail.id, {
        title: validation.title,
        description: validation.description,
      });
      applyAuthoritativeDetail(latest, { metadataRevision: revision });
    } catch (error) {
      handleMutationError(
        error,
        undefined,
        () => saveMetadata(metadataRevisionRef.current),
        true
      );
    }
  };

  const scheduleMetadataSave = () => {
    if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current);
    const revision = metadataRevisionRef.current;
    metadataTimerRef.current = setTimeout(() => {
      metadataTimerRef.current = null;
      void saveMetadata(revision);
    }, AUTOSAVE_DELAY_MS);
  };

  const saveText = async (itemId: string, revision: number) => {
    const blockTitle = titleDraftsRef.current[itemId] ?? '';
    if (blockTitle.length > 200) {
      setActionError('Keep page titles under 200 characters.');
      setItemStates((current) => ({ ...current, [itemId]: 'failed' }));
      return;
    }
    const normalizedTitle = blockTitle.trim() || null;
    const body = textDraftsRef.current[itemId] ?? '';
    const currentItem = detailRef.current?.items.find(
      (item) => item.id === itemId && item.type === 'text'
    );
    if (
      currentItem?.type === 'text' &&
      normalizedTitle === currentItem.title &&
      body === currentItem.text
    ) {
      itemRevisionsRef.current[itemId] = 0;
      setItemStates((current) => ({ ...current, [itemId]: 'idle' }));
      setActionError(null);
      return;
    }
    setItemStates((current) => ({ ...current, [itemId]: 'saving' }));
    setActionError(null);
    try {
      const latest = await mutate.updateBlock(detail.id, itemId, {
        type: 'text',
        title: normalizedTitle,
        text: body,
      });
      applyAuthoritativeDetail(latest, {
        savedItem: { id: itemId, revision },
      });
    } catch (error) {
      handleMutationError(error, itemId, () =>
        saveText(itemId, itemRevisionsRef.current[itemId] ?? revision)
      );
    }
  };

  const scheduleTextSave = (itemId: string) => {
    const existing = itemTimersRef.current[itemId];
    if (existing) clearTimeout(existing);
    const revision = itemRevisionsRef.current[itemId];
    itemTimersRef.current[itemId] = setTimeout(() => {
      delete itemTimersRef.current[itemId];
      void saveText(itemId, revision);
    }, AUTOSAVE_DELAY_MS);
  };

  const runImmediateMutation = async (
    operation: () => Promise<NotebookDetail>,
    itemId?: string
  ) => {
    setActionError(null);
    try {
      applyAuthoritativeDetail(await operation());
    } catch (error) {
      handleMutationError(error, itemId, () =>
        runImmediateMutation(operation, itemId)
      );
    }
  };

  const addPage = async () => {
    setActionError(null);
    const previousIds = new Set(detail.items.map((item) => item.id));
    try {
      const latest = await mutate.addBlock(detail.id, {
        type: 'text',
        text: '',
      });
      const newPage =
        latest.items.find((item) => !previousIds.has(item.id)) ??
        latest.items.at(-1);
      applyAuthoritativeDetail(latest);
      if (newPage) navigateToPage(newPage.id, true);
    } catch (error) {
      handleMutationError(error, undefined, addPage);
    }
  };

  const confirmDeletePage = (itemId: string) => {
    Alert.alert(
      'Delete this page?',
      'This page and its photos will be removed from this Notebook.',
      [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Page',
        style: 'destructive',
        onPress: () => {
          const timer = itemTimersRef.current[itemId];
          if (timer) clearTimeout(timer);
          delete itemTimersRef.current[itemId];
          const currentIndex = pages.findIndex((page) => page.id === itemId);
          const targetId =
            pages[currentIndex + 1]?.id ?? pages[currentIndex - 1]?.id;
          setActionError(null);
          void mutate.deleteBlock(detail.id, itemId)
            .then((latest) => {
              applyAuthoritativeDetail(latest);
              if (targetId) navigateToPage(targetId);
            })
            .catch((error) => {
              handleMutationError(error, itemId);
            });
        },
      },
      ]
    );
  };

  const addPhoto = async (pageId: string) => {
    if (!session) return;
    setActionError(null);
    try {
      const selected = await pickPhotosForUpload();
      if (selected.length === 0) return;
      setLocalPhotoPreviews((current) => ({
        ...current,
        [pageId]: selected.map((photo) => photo.uri),
      }));
      setPhotoBusyPage(pageId);
      const result = await addNotebookPhotos(
        session.userId,
        detail.id,
        pageId,
        selected,
        mutate.addPhotoBlock
      );
      const latest = result.completed.at(-1);
      if (latest) {
        applyAuthoritativeDetail(latest);
      }
      const pendingPreviews = await listNotebookPhotoPreviews(
        session.userId,
        detail.id
      );
      setLocalPhotoPreviews(pendingPreviews);
      const durablePendingCount = Object.values(pendingPreviews)
        .reduce((count, previews) => count + previews.length, 0);
      setPendingPhotoRetries(durablePendingCount);
      if (durablePendingCount > 0) {
        setActionError('Photo upload paused. Retry when connectivity returns.');
      } else if (result.errors[0]) {
        handleMutationError(result.errors[0]);
      }
    } catch (error) {
      handleMutationError(error);
    } finally {
      setPhotoBusyPage(null);
    }
  };

  const addLink = async () => {
    if (!linkPageId) return;
    const normalized = linkUrl.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(normalized)) {
      setActionError('Enter a valid http:// or https:// link.');
      return;
    }
    await runImmediateMutation(() => mutate.addLinkBlock({
      id: detail.id, pageId: linkPageId, url: normalized,
      clientRequestId: Crypto.randomUUID(),
    }));
    setLinkPageId(null);
    setLinkUrl('');
  };

  const showMetadataActions = (block: ContentBlock) => {
    const now = new Date();
    Alert.alert('Object details', undefined, [
      { text: block.isImportant ? 'Remove importance' : 'Mark important', onPress: () => void runImmediateMutation(() =>
        mutate.updateRichBlock(detail.id, block.id, { isImportant: !block.isImportant })) },
      { text: block.event ? 'Change date/time' : 'Add date/time', onPress: () => {
        const current = block.event?.precision === 'DATETIME' ? new Date(block.event.dateTime) : now;
        setTemporalEditor({ blockId: block.id, precision: block.event?.precision ?? 'DATE',
          date: block.event?.precision === 'DATE' ? block.event.date : current.toISOString().slice(0, 10),
          time: `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}` });
      } },
      ...(block.event ? [{ text: 'Remove date/time', style: 'destructive' as const, onPress: () => void runImmediateMutation(() =>
        mutate.updateRichBlock(detail.id, block.id, { event: null })) }] : []),
      { text: 'Pin now', onPress: () => void getOneForegroundLocation().then((result) => {
        if (result.status !== 'granted') { setActionError('Location is unavailable. You can still choose a point on the map.'); return; }
        return runImmediateMutation(() => mutate.updateRichBlock(detail.id, block.id, {
          location: { ...result.point, source: 'PIN_NOW' },
        }));
      }) },
      { text: block.location ? 'Change location on map' : 'Choose location on map', onPress: () => router.push({
        pathname: '/notebooks/location-picker',
        params: { notebookId: detail.id, blockId: block.id,
          latitude: block.location?.latitude, longitude: block.location?.longitude },
      }) },
      ...(block.location ? [{ text: 'Remove location', style: 'destructive' as const, onPress: () => void runImmediateMutation(() =>
        mutate.updateRichBlock(detail.id, block.id, { location: null })) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const retryPhotos = async () => {
    if (!session) return;
    setActionError(null);
    const { completed, pendingCount } = await resumeNotebookPhotos(
      session.userId,
      detail.id,
      mutate.addPhotoBlock
    );
    setPendingPhotoRetries(pendingCount);
    const latest = completed.at(-1);
    if (latest) {
      setLocalPhotoPreviews(
        await listNotebookPhotoPreviews(session.userId, detail.id)
      );
      applyAuthoritativeDetail(latest);
    }
    if (pendingCount > 0) {
      setActionError('Photo upload is still paused. Please try again.');
    }
  };

  const keepMyVersion = async () => {
    const retry = retryConflictRef.current;
    if (!retry || !notebookId) return;
    setActionError(null);
    try {
      await retryNotebookConflict(
        () => loadNotebook(notebookId, true),
        async () => {
          setConflict(false);
          retryConflictRef.current = null;
          await retry();
        }
      );
    } catch (error) {
      handleMutationError(error, undefined, retry);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: Palette.background }}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderBackButton color={Palette.trip} onPress={handleBack} />,
        }}
      />
      <Modal animationType="fade" onRequestClose={() => setTemporalEditor(null)} transparent visible={temporalEditor !== null}>
        <View style={{ alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', flex: 1, justifyContent: 'center', padding: Screen.gutter }}>
          {temporalEditor ? <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.card, gap: Space.md, padding: Space.xl, width: '100%' }}>
            <AppText variant="section">Date and time</AppText>
            <View style={{ flexDirection: 'row', gap: Space.sm }}>
              <AppButton label="Date only" onPress={() => setTemporalEditor((current) => current ? { ...current, precision: 'DATE' } : null)} size="compact" variant={temporalEditor.precision === 'DATE' ? 'primary' : 'secondary'} />
              <AppButton label="Date + time" onPress={() => setTemporalEditor((current) => current ? { ...current, precision: 'DATETIME' } : null)} size="compact" variant={temporalEditor.precision === 'DATETIME' ? 'primary' : 'secondary'} />
            </View>
            <AppTextInput accessibilityLabel="Event date" autoCapitalize="none" onChangeText={(date) => setTemporalEditor((current) => current ? { ...current, date } : null)} placeholder="YYYY-MM-DD" value={temporalEditor.date} />
            {temporalEditor.precision === 'DATETIME' ? <AppTextInput accessibilityLabel="Event time" autoCapitalize="none" onChangeText={(time) => setTemporalEditor((current) => current ? { ...current, time } : null)} placeholder="HH:MM" value={temporalEditor.time} /> : null}
            <View style={{ flexDirection: 'row', gap: Space.sm, justifyContent: 'flex-end' }}>
              <AppButton label="Cancel" onPress={() => setTemporalEditor(null)} size="compact" variant="secondary" />
              <AppButton label="Apply" onPress={() => {
                const editor = temporalEditor;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(editor.date) || (editor.precision === 'DATETIME' && !/^\d{2}:\d{2}$/.test(editor.time))) {
                  setActionError('Enter the date as YYYY-MM-DD and time as HH:MM.'); return;
                }
                const event = editor.precision === 'DATE'
                  ? { precision: 'DATE' as const, date: editor.date }
                  : { precision: 'DATETIME' as const, dateTime: new Date(`${editor.date}T${editor.time}:00`).toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
                setTemporalEditor(null);
                void runImmediateMutation(() => mutate.updateRichBlock(detail.id, editor.blockId, { event }));
              }} size="compact" />
            </View>
          </View> : null}
        </View>
      </Modal>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
        style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            gap: Space.xl,
            paddingBottom: Screen.bottom,
            paddingHorizontal: Screen.gutter,
            paddingTop: Screen.top,
          }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => requestAnimationFrame(finishPendingScroll)}
          >
          <View style={{ gap: Space.xl }}>
            {isOffline ? (
              <Notice text="Offline: showing saved content. Editing is unavailable." />
            ) : null}
            {conflict ? (
              <View style={{ gap: Space.md }}>
                <Notice text="This Notebook changed elsewhere. Your unsaved text is still here." />
                <View style={{ flexDirection: 'row', gap: Space.sm }}>
                  <AppButton
                    label="Reload latest"
                    onPress={() => reload(true)}
                    style={{ flex: 1 }}
                  />
                  {retryConflictRef.current ? (
                    <AppButton
                      label="Keep my version"
                      onPress={keepMyVersion}
                      style={{ flex: 1 }}
                      variant="secondary"
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
            {actionError ? <AppText color={Palette.danger}>{actionError}</AppText> : null}
            {pendingPhotoRetries > 0 ? (
              <AppButton
                label="Retry Photo Uploads"
                onPress={() => void retryPhotos()}
                size="compact"
                variant="secondary"
              />
            ) : null}

            <View style={{ gap: Space.md }}>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                gap: Space.sm,
              }}>
              <AppTextInput
                accessibilityLabel="Notebook title"
                editable={!mutationDisabled}
                maxLength={200}
                onChangeText={(value) => {
                  titleRef.current = value;
                  setTitle(value);
                  metadataRevisionRef.current += 1;
                  setMetadataState('idle');
                  scheduleMetadataSave();
                }}
                style={{
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  flex: 1,
                  fontSize: 28,
                  fontWeight: '700',
                  lineHeight: 34,
                  minHeight: 44,
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                }}
                value={title}
              />
              <IconAction
                accessibilityLabel="Add Page"
                disabled={mutationDisabled}
                icon="add"
                onPress={() => void addPage()}
              />
              <IconAction
                accessibilityLabel="Share this Notebook"
                disabled={!session}
                icon="share"
                onPress={() =>
                  router.push({
                    pathname: '/notebooks/[notebookId]/sharing',
                    params: { notebookId: detail.id },
                  })
                }
              />
            </View>
            {descriptionEditing ? (
              <AppTextInput
                accessibilityLabel="Notebook description"
                autoFocus
                editable={!mutationDisabled}
                maxLength={10_000}
                multiline
                onBlur={() => setDescriptionEditing(false)}
                onChangeText={(value) => {
                  descriptionRef.current = value;
                  setDescription(value);
                  metadataRevisionRef.current += 1;
                  setMetadataState('idle');
                  scheduleMetadataSave();
                }}
                placeholder="Optional description"
                style={{ minHeight: 112, textAlignVertical: 'top' }}
                value={description}
              />
            ) : (
              <ExpandableText
                accessibilityLabel="Notebook description"
                disabled={mutationDisabled}
                onPress={() => setDescriptionEditing(true)}
                placeholder="Add a description"
                value={description}
              />
            )}
              <SaveLabel
                accessibilityLabel="Notebook title and description"
                onRetry={() => void saveMetadata(metadataRevisionRef.current)}
                state={metadataState}
              />
            </View>
          </View>

          <View
            onLayout={(event: LayoutChangeEvent) => {
              blockSectionOffset.current = event.nativeEvent.layout.y;
            }}
            style={{ gap: Space.md }}>
            {pages.length === 0 ? (
              <AppText color={Palette.textMuted}>
                No pages yet. Add one to start writing.
              </AppText>
            ) : (
              pages.map((page, pageIndex) =>
                renderContentBlock(page.blocks[0], pageIndex, {
                  text: (item, index) => (
                <View
                  key={item.id}
                  onLayout={(event: LayoutChangeEvent) => {
                    const y = event.nativeEvent.layout.y;
                    blockOffsets.current[item.id] = y;
                    blockOffsets.current[page.id] = y;
                    requestAnimationFrame(finishPendingScroll);
                  }}
                  style={{
                    backgroundColor: Palette.background,
                    borderColor:
                      highlightedPageId === item.id ||
                      highlightedPageId === page.id
                        ? Palette.trip
                        : Palette.border,
                    borderRadius: Radius.card,
                    borderWidth: 1,
                    gap: Space.md,
                    padding: Space.lg,
                  }}>
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      gap: Space.xs,
                    }}>
                    <AppTextInput
                      ref={(input) => {
                        pageTitleRefs.current[item.id] = input;
                      }}
                      accessibilityLabel={`Page ${index + 1} title`}
                      editable={!mutationDisabled}
                      maxLength={200}
                      onChangeText={(value) => {
                        titleDraftsRef.current = {
                          ...titleDraftsRef.current,
                          [item.id]: value,
                        };
                        setTitleDrafts((current) => ({ ...current, [item.id]: value }));
                        itemRevisionsRef.current[item.id] =
                          (itemRevisionsRef.current[item.id] ?? 0) + 1;
                        setItemStates((current) => ({ ...current, [item.id]: 'idle' }));
                        scheduleTextSave(item.id);
                      }}
                      placeholder="Page title"
                      style={{
                        backgroundColor: 'transparent',
                        borderWidth: 0,
                        flex: 1,
                        fontWeight: '700',
                        paddingHorizontal: 0,
                        paddingVertical: 0,
                      }}
                      value={titleDrafts[item.id] ?? item.title ?? ''}
                    />
                    <PageNavigationButton
                      accessibilityLabel="Go to previous page"
                      disabled={index === 0}
                      icon="arrow-up"
                      onPress={() => {
                        const target = adjacentContentPageId(pages, page.id, -1);
                        if (target) navigateToPage(target);
                      }}
                    />
                    <PageNavigationButton
                      accessibilityLabel="Go to next page"
                      disabled={index === pages.length - 1}
                      icon="arrow-down"
                      onPress={() => {
                        const target = adjacentContentPageId(pages, page.id, 1);
                        if (target) navigateToPage(target);
                      }}
                    />
                    <IconAction
                      accessibilityLabel={`Edit details for page ${index + 1}`}
                      disabled={mutationDisabled}
                      icon="more-horiz"
                      onPress={() => showMetadataActions(item)}
                      size="compact"
                    />
                    <IconAction
                      accessibilityLabel={`Delete page ${index + 1}`}
                      destructive
                      disabled={mutationDisabled}
                      icon="delete-outline"
                      onPress={() => confirmDeletePage(item.id)}
                      size="compact"
                    />
                  </View>
                  {editingPageIds.has(item.id) ? (
                    <AppTextInput
                      accessibilityLabel={`Page ${index + 1} body`}
                      autoFocus
                      editable={!mutationDisabled}
                      maxLength={100_000}
                      multiline
                      onBlur={() => setEditingPageIds((current) => {
                        const next = new Set(current);
                        next.delete(item.id);
                        return next;
                      })}
                      onChangeText={(value) => {
                        textDraftsRef.current = {
                          ...textDraftsRef.current,
                          [item.id]: value,
                        };
                        setTextDrafts((current) => ({ ...current, [item.id]: value }));
                        itemRevisionsRef.current[item.id] =
                          (itemRevisionsRef.current[item.id] ?? 0) + 1;
                        setItemStates((current) => ({ ...current, [item.id]: 'idle' }));
                        scheduleTextSave(item.id);
                      }}
                      placeholder="Write something…"
                      style={{ minHeight: 100, textAlignVertical: 'top' }}
                      value={textDrafts[item.id] ?? item.text}
                    />
                  ) : (
                    <ExpandableText
                      accessibilityLabel={`Page ${index + 1} body`}
                      disabled={mutationDisabled}
                      onPress={() => setEditingPageIds((current) => new Set(current).add(item.id))}
                      placeholder="Write something…"
                      value={textDrafts[item.id] ?? item.text}
                    />
                  )}
                  <MetadataSummary block={item} />
                  <PlacePhotoGrid
                    horizontalInset={Space.lg}
                    images={page.blocks.slice(1).flatMap((block) =>
                      block.type === 'photo' && photoUrls[block.photoAssetId]
                        ? [{
                            _key: block.id,
                            alt: 'Notebook photo',
                            url: photoUrls[block.photoAssetId],
                          }]
                        : []
                    )}
                    onImageError={(image) => {
                      const block = page.blocks.find((candidate) => candidate.id === image._key);
                      if (!block || block.type !== 'photo') return;
                      const attempts = photoRefreshAttemptsRef.current[block.photoAssetId] ?? 0;
                      if (attempts >= 2) return;
                      photoRefreshAttemptsRef.current[block.photoAssetId] = attempts + 1;
                      void refreshPhotoUrl(block.photoAssetId);
                    }}
                    onRemoveImage={mutationDisabled ? undefined : (image) => {
                      if (!image._key) return;
                      void runImmediateMutation(() =>
                        mutate.deletePhotoBlock(detail.id, image._key!)
                      );
                    }}
                    placeTitle={item.title ?? `Notebook page ${index + 1}`}
                  />
                  {page.blocks.filter((block) => block.type === 'link').map((block) =>
                    block.type === 'link' ? (
                      <View key={block.id} style={{ borderColor: Palette.border, borderRadius: Radius.control, borderWidth: 1, gap: Space.xs, padding: Space.md }}>
                        <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}>
                          <View style={{ flex: 1 }}>
                            <AppText variant="bodyStrong">{block.title || block.url}</AppText>
                            {block.title ? <AppText color={Palette.textMuted} variant="caption">{block.url}</AppText> : null}
                            {block.text ? <AppText>{block.text}</AppText> : null}
                          </View>
                          <IconAction accessibilityLabel="Edit link details" icon="more-horiz" onPress={() => showMetadataActions(block)} size="compact" />
                          <IconAction accessibilityLabel="Delete link" destructive icon="delete-outline" onPress={() => void runImmediateMutation(() => mutate.deletePhotoBlock(detail.id, block.id))} size="compact" />
                        </View>
                        <AppTextInput accessibilityLabel="Link title" defaultValue={block.title ?? ''}
                          key={`${block.id}-title-${block.updatedAt}`} maxLength={200} placeholder="Optional title"
                          onEndEditing={(event) => void runImmediateMutation(() => mutate.updateRichBlock(detail.id, block.id, { title: event.nativeEvent.text || null }))} />
                        <AppTextInput accessibilityLabel="Link note" defaultValue={block.text ?? ''}
                          key={`${block.id}-note-${block.updatedAt}`} maxLength={100000} multiline placeholder="Optional note"
                          onEndEditing={(event) => void runImmediateMutation(() => mutate.updateRichBlock(detail.id, block.id, { text: event.nativeEvent.text || null }))} />
                        <MetadataSummary block={block} />
                      </View>
                    ) : null
                  )}
                  {localPhotoPreviews[page.id]?.length ? (
                    <View style={{ gap: Space.sm }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
                        {localPhotoPreviews[page.id].map((uri, previewIndex) => (
                          <Image
                            accessibilityLabel={`Pending Notebook photo ${previewIndex + 1}`}
                            contentFit="cover"
                            key={`${uri}-${previewIndex}`}
                            source={{ uri }}
                            style={{
                              aspectRatio: 1,
                              backgroundColor: Palette.surfaceMuted,
                              borderRadius: Radius.control,
                              opacity: 0.65,
                              width: '48%',
                            }}
                          />
                        ))}
                      </View>
                      <AppText color={Palette.textMuted} variant="caption">
                        {localPhotoPreviews[page.id].length === 1
                          ? 'Photo upload pending'
                          : `${localPhotoPreviews[page.id].length} photo uploads pending`}
                      </AppText>
                    </View>
                  ) : null}
                  <AppButton
                    accessibilityLabel={`Add photo to page ${index + 1}`}
                    disabled={mutationDisabled || photoBusyPage === page.id}
                    label={
                      photoBusyPage === page.id ? 'Uploading…' : 'Add photos'
                    }
                    onPress={() => void addPhoto(page.id)}
                    size="compact"
                    style={{ alignSelf: 'flex-end' }}
                    variant="secondary"
                  />
                  {linkPageId === page.id ? (
                    <View style={{ gap: Space.sm }}>
                      <AppTextInput accessibilityLabel="Link URL" autoCapitalize="none" autoCorrect={false}
                        keyboardType="url" onChangeText={setLinkUrl} placeholder="https://…" value={linkUrl} />
                      <View style={{ flexDirection: 'row', gap: Space.sm, justifyContent: 'flex-end' }}>
                        <AppButton label="Cancel" onPress={() => { setLinkPageId(null); setLinkUrl(''); }} size="compact" variant="secondary" />
                        <AppButton label="Add link" onPress={() => void addLink()} size="compact" />
                      </View>
                    </View>
                  ) : (
                    <AppButton accessibilityLabel={`Add link to page ${index + 1}`} label="Add link"
                      onPress={() => { setLinkPageId(page.id); setLinkUrl(''); }} size="compact"
                      style={{ alignSelf: 'flex-end' }} variant="secondary" />
                  )}
                  <SaveLabel
                    accessibilityLabel={`Page ${index + 1} text`}
                    onRetry={() => void saveText(
                      item.id,
                      itemRevisionsRef.current[item.id] ?? 0
                    )}
                    state={itemStates[item.id] ?? 'idle'}
                  />
                </View>
                  ),
                  photo: () => <View />,
                  link: () => <View />,
                })
              )
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: Palette.surfaceMuted,
        borderRadius: Radius.control,
        padding: Space.lg,
      }}>
      <AppText>{text}</AppText>
    </View>
  );
}

function MetadataSummary({ block }: { block: ContentBlock }) {
  const labels: string[] = [];
  if (block.isImportant) labels.push('Important');
  if (block.event?.precision === 'DATE') labels.push(block.event.date);
  if (block.event?.precision === 'DATETIME') labels.push(new Date(block.event.dateTime).toLocaleString());
  if (block.location) labels.push('Location saved');
  if (labels.length === 0) return null;
  return <AppText color={Palette.textMuted} variant="caption">{labels.join(' · ')}</AppText>;
}

function PageNavigationButton({
  accessibilityLabel,
  disabled,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  icon: 'arrow-down' | 'arrow-up';
  onPress: () => void;
}) {
  return <IconAction
    accessibilityLabel={accessibilityLabel}
    disabled={disabled}
    icon={icon === 'arrow-up' ? 'arrow-upward' : 'arrow-downward'}
    onPress={onPress}
    size="compact"
  />;
}

function SaveLabel({
  accessibilityLabel,
  onRetry,
  state,
}: {
  accessibilityLabel: string;
  onRetry: () => void;
  state: SaveState;
}) {
  return <AutosaveStatus
    accessibilityLabel={accessibilityLabel}
    onRetry={onRetry}
    state={state}
  />;
}
