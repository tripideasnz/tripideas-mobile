import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { HeaderBackButton } from '@react-navigation/elements';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/provider';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { LoadingView } from '@/components/ui/loading-view';
import {
  adjacentContentPageId,
  pagesFromContentBlocks,
} from '@/content-blocks/pages';
import { renderContentBlock } from '@/content-blocks/renderer';
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
import { pickPhotoForUpload } from '@/photo-uploads/picker';
import {
  addNotebookPhoto,
  listNotebookPhotoPreviews,
  resumeNotebookPhotos,
} from '@/notebook-photo-blocks/service';

type SaveState = 'failed' | 'idle' | 'saving';
type RetryConflict = () => Promise<void>;
const AUTOSAVE_DELAY_MS = 650;

export default function NotebookDetailScreen() {
  const router = useRouter();
  const { notebookId: rawNotebookId } = useLocalSearchParams<{ notebookId: string }>();
  const notebookId = Array.isArray(rawNotebookId) ? rawNotebookId[0] : rawNotebookId;
  const { isLoading: isLoadingSession, session, signIn } = useSession();
  const {
    deleteNotebook,
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [metadataState, setMetadataState] = useState<SaveState>('idle');
  const [itemStates, setItemStates] = useState<Record<string, SaveState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [localPhotoPreviews, setLocalPhotoPreviews] = useState<
    Record<string, string>
  >({});
  const [photoBusyPage, setPhotoBusyPage] = useState<string | null>(null);
  const [pendingPhotoRetries, setPendingPhotoRetries] = useState(0);
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
  const blockOffsets = useRef<Record<string, number>>({});
  const pageTitleRefs = useRef<Record<string, TextInput | null>>({});
  const pendingScrollRef = useRef<{ focusTitle: boolean; itemId: string } | null>(null);

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
      y: notebookBlockScrollOffset(blockSectionOffset.current, y),
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
          setActionError('Could not load this Notebook. Please try again.');
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

  const addPhoto = async (pageId: string) => {
    if (!session) return;
    setActionError(null);
    try {
      const selected = await pickPhotoForUpload();
      if (!selected) return;
      setLocalPhotoPreviews((current) => ({
        ...current,
        [pageId]: selected.uri,
      }));
      setPhotoBusyPage(pageId);
      const latest = await addNotebookPhoto(
        session.userId,
        detail.id,
        pageId,
        selected,
        mutate.addPhotoBlock
      );
      if (latest) {
        setLocalPhotoPreviews((current) => {
          const next = { ...current };
          delete next[pageId];
          return next;
        });
        applyAuthoritativeDetail(latest);
      }
      else {
        setPendingPhotoRetries((current) => current + 1);
        setActionError('Photo upload paused. Retry when connectivity returns.');
      }
    } catch (error) {
      handleMutationError(error);
    } finally {
      setPhotoBusyPage(null);
    }
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
          headerLeft: () => <HeaderBackButton onPress={handleBack} />,
        }}
      />
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
          stickyHeaderIndices={[1]}>
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
                fontSize: 28,
                fontWeight: '700',
                lineHeight: 34,
                minHeight: 58,
              }}
              value={title}
            />
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
                style={{ minHeight: 96, textAlignVertical: 'top' }}
                value={description}
              />
            ) : (
              <View style={{ gap: Space.xs }}>
                <View
                  style={
                    descriptionExpanded
                      ? undefined
                      : { maxHeight: 72, overflow: 'hidden' }
                  }>
                  <Pressable
                    accessibilityLabel={
                      description ? 'Edit Notebook description' : 'Add Notebook description'
                    }
                    accessibilityRole="button"
                    disabled={mutationDisabled}
                    onPress={() => setDescriptionEditing(true)}>
                    <AppText
                      color={description ? Palette.textBody : Palette.textMuted}
                      onTextLayout={(event) => {
                        setDescriptionOverflows(event.nativeEvent.lines.length > 3);
                      }}>
                      {description || 'Add a description'}
                    </AppText>
                  </Pressable>
                </View>
                {descriptionOverflows || descriptionExpanded ? (
                  <Pressable
                    accessibilityLabel={
                      descriptionExpanded
                        ? 'Collapse Notebook description'
                        : 'Expand Notebook description'
                    }
                    accessibilityRole="button"
                    onPress={() => setDescriptionExpanded((current) => !current)}>
                    <AppText
                      color={Palette.textMuted}
                      style={{ fontStyle: 'italic' }}
                      variant="caption">
                      {descriptionExpanded ? '... show less' : '... read more'}
                    </AppText>
                  </Pressable>
                ) : (
                  <AppText color={Palette.textMuted} variant="caption">
                    Tap to edit
                  </AppText>
                )}
              </View>
            )}
              <SaveLabel state={metadataState} />
            </View>
            <View
              style={{
                borderColor: Palette.border,
                borderRadius: Radius.card,
                borderWidth: 1,
                gap: Space.sm,
                padding: Space.lg,
              }}>
              <AppText variant="cardTitle">Sharing</AppText>
              <AppText color={Palette.textMuted}>
                Create and manage read-only links to this Notebook.
              </AppText>
              <AppButton
                accessibilityLabel="Manage Notebook sharing"
                disabled={!session}
                label="Manage Sharing"
                onPress={() =>
                  router.push({
                    pathname: '/notebooks/[notebookId]/sharing',
                    params: { notebookId: detail.id },
                  })
                }
                size="compact"
                style={{ alignSelf: 'flex-start' }}
                variant="secondary"
              />
            </View>
          </View>

          <View
            style={{
              backgroundColor: Palette.background,
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingVertical: Space.sm,
            }}>
            <AppButton
              accessibilityLabel="Add Page"
              disabled={mutationDisabled}
              label="Add Page"
              onPress={() => void addPage()}
              size="compact"
              style={{ width: 112 }}
            />
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
                    blockOffsets.current[item.id] = event.nativeEvent.layout.y;
                    requestAnimationFrame(finishPendingScroll);
                  }}
                  style={{
                    borderColor: Palette.border,
                    borderRadius: Radius.card,
                    borderWidth: 1,
                    gap: Space.md,
                    padding: Space.lg,
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
                    value={titleDrafts[item.id] ?? item.title ?? ''}
                  />
                  <AppTextInput
                    accessibilityLabel={`Page ${index + 1} body`}
                    editable={!mutationDisabled}
                    maxLength={100_000}
                    multiline
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
                    style={{ minHeight: 112, textAlignVertical: 'top' }}
                    value={textDrafts[item.id] ?? item.text}
                  />
                  {page.blocks.slice(1).map((block) =>
                    block.type === 'photo' ? (
                      <View key={block.id} style={{ gap: Space.sm }}>
                        {photoUrls[block.photoAssetId] ? (
                          <Image
                            accessibilityLabel="Notebook photo"
                            contentFit="contain"
                            onError={() => {
                              const attempts =
                                photoRefreshAttemptsRef.current[
                                  block.photoAssetId
                                ] ?? 0;
                              if (attempts >= 2) return;
                              photoRefreshAttemptsRef.current[
                                block.photoAssetId
                              ] = attempts + 1;
                              void refreshPhotoUrl(block.photoAssetId);
                            }}
                            source={{ uri: photoUrls[block.photoAssetId] }}
                            style={{
                              aspectRatio: 4 / 3,
                              backgroundColor: Palette.surfaceMuted,
                              borderRadius: Radius.control,
                              width: '100%',
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              alignItems: 'center',
                              aspectRatio: 4 / 3,
                              backgroundColor: Palette.surfaceMuted,
                              borderRadius: Radius.control,
                              justifyContent: 'center',
                            }}>
                            <AppText color={Palette.textMuted}>
                              Loading photo…
                            </AppText>
                          </View>
                        )}
                        <AppButton
                          accessibilityLabel="Remove photo from page"
                          disabled={mutationDisabled}
                          label="Remove Photo"
                          onPress={() =>
                            void runImmediateMutation(() =>
                              mutate.deletePhotoBlock(detail.id, block.id)
                            )
                          }
                          size="compact"
                          style={{ alignSelf: 'flex-end', width: 132 }}
                          variant="danger"
                        />
                      </View>
                    ) : null
                  )}
                  {localPhotoPreviews[page.id] ? (
                    <View style={{ gap: Space.sm }}>
                      <Image
                        accessibilityLabel="Pending Notebook photo preview"
                        contentFit="contain"
                        source={{ uri: localPhotoPreviews[page.id] }}
                        style={{
                          aspectRatio: 4 / 3,
                          backgroundColor: Palette.surfaceMuted,
                          borderRadius: Radius.control,
                          width: '100%',
                        }}
                      />
                      <AppText color={Palette.textMuted} variant="caption">
                        Photo upload pending
                      </AppText>
                    </View>
                  ) : null}
                  <AppButton
                    accessibilityLabel={`Add photo to page ${index + 1}`}
                    disabled={mutationDisabled || photoBusyPage === page.id}
                    label={
                      photoBusyPage === page.id ? 'Uploading…' : 'Add Photo'
                    }
                    onPress={() => void addPhoto(page.id)}
                    size="compact"
                    style={{ alignSelf: 'flex-end', width: 112 }}
                    variant="secondary"
                  />
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}>
                    <View style={{ flexDirection: 'row', gap: Space.sm }}>
                      <AppButton
                        accessibilityLabel="Go to previous page"
                        disabled={mutationDisabled || index === 0}
                        label="↑"
                        onPress={() => {
                          const target = adjacentContentPageId(pages, page.id, -1);
                          if (target) navigateToPage(target);
                        }}
                        size="compact"
                        style={{ width: 44 }}
                        variant="secondary"
                      />
                      <AppButton
                        accessibilityLabel="Go to next page"
                        disabled={mutationDisabled || index === pages.length - 1}
                        label="↓"
                        onPress={() => {
                          const target = adjacentContentPageId(pages, page.id, 1);
                          if (target) navigateToPage(target);
                        }}
                        size="compact"
                        style={{ width: 44 }}
                        variant="secondary"
                      />
                    </View>
                    <AppButton
                      accessibilityLabel="Delete page"
                      disabled={mutationDisabled}
                      label="Delete"
                      onPress={() =>
                        Alert.alert('Delete page?', 'This page will be removed.', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              const timer = itemTimersRef.current[item.id];
                              if (timer) clearTimeout(timer);
                              delete itemTimersRef.current[item.id];
                              void runImmediateMutation(
                                () => mutate.deleteBlock(detail.id, item.id),
                                item.id
                              );
                            },
                          },
                        ])
                      }
                      size="compact"
                      style={{ width: 112 }}
                      variant="danger"
                    />
                  </View>
                  <SaveLabel state={itemStates[item.id] ?? 'idle'} />
                </View>
                  ),
                  photo: () => <View />,
                })
              )
            )}
          </View>

          <AppButton
            accessibilityLabel="Delete this Notebook"
            disabled={mutationDisabled}
            label="Delete Notebook"
            onPress={() =>
              Alert.alert(
                'Delete Notebook?',
                'This removes the Notebook and all its pages.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void deleteNotebook(detail.id)
                        .then(() => router.replace('/notebooks'))
                        .catch(handleMutationError);
                    },
                  },
                ]
              )
            }
            size="compact"
            variant="danger"
          />
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

function SaveLabel({ state }: { state: SaveState }) {
  const label =
    state === 'saving'
      ? 'Saving…'
      : state === 'failed'
        ? 'Could not save'
        : '';
  return label ? (
    <AppText
      accessibilityLiveRegion="polite"
      color={state === 'failed' ? Palette.danger : Palette.textMuted}
      variant="caption">
      {label}
    </AppText>
  ) : null;
}
