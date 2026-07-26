import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/provider';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { classifyNotebookError } from '@/notebooks/errors';
import { shouldAdoptAutosaveResponse } from '@/notebooks/autosave';
import {
  moveNotebookItemIds,
  notebookBlockIndexLabel,
  notebookBlockScrollOffset,
  validateNotebookMetadata,
} from '@/notebooks/model';
import { useNotebooks } from '@/notebooks/provider';
import type { NotebookDetail } from '@/notebooks/types';

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
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [indexOpen, setIndexOpen] = useState(false);
  const [metadataState, setMetadataState] = useState<SaveState>('idle');
  const [itemStates, setItemStates] = useState<Record<string, SaveState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const titleRef = useRef('');
  const descriptionRef = useRef('');
  const titleDraftsRef = useRef<Record<string, string>>({});
  const textDraftsRef = useRef<Record<string, string>>({});
  const metadataRevisionRef = useRef(0);
  const itemRevisionsRef = useRef<Record<string, number>>({});
  const metadataTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const retryConflictRef = useRef<RetryConflict | null>(null);
  const initializedNotebookRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const blockSectionOffset = useRef(0);
  const blockOffsets = useRef<Record<string, number>>({});

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
      const revision = itemRevisionsRef.current[item.id] ?? 0;
      const adoptItem =
        resetDrafts ||
        revision === 0 ||
        (savedItem?.id === item.id &&
          shouldAdoptAutosaveResponse(revision, savedItem.revision));
      nextTitles[item.id] = adoptItem
        ? item.title ?? ''
        : titleDraftsRef.current[item.id] ?? item.title ?? '';
      nextTexts[item.id] = adoptItem
        ? item.text
        : textDraftsRef.current[item.id] ?? item.text;
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

  useEffect(() => () => {
    if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current);
    Object.values(itemTimersRef.current).forEach(clearTimeout);
  }, []);

  const handleMutationError = (
    error: unknown,
    itemId?: string,
    retry?: RetryConflict
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
    } else {
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
    setMetadataState('saving');
    setActionError(null);
    try {
      const latest = await mutate.updateMetadata(detail.id, {
        title: validation.title,
        description: validation.description,
      });
      applyAuthoritativeDetail(latest, { metadataRevision: revision });
    } catch (error) {
      handleMutationError(error, undefined, () =>
        saveMetadata(metadataRevisionRef.current)
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
    setItemStates((current) => ({ ...current, [itemId]: 'saving' }));
    setActionError(null);
    try {
      const latest = await mutate.updateText(detail.id, itemId, {
        title: blockTitle.trim() || null,
        text: textDraftsRef.current[itemId] ?? '',
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

  const reorder = async (itemId: string, offset: -1 | 1) => {
    const ids = moveNotebookItemIds(detail.items, itemId, offset);
    if (!ids) return;
    const operation = () => mutate.reorder(detail.id, ids);
    await runImmediateMutation(operation, itemId);
  };

  const keepMyVersion = async () => {
    const retry = retryConflictRef.current;
    if (!retry || !notebookId) return;
    setActionError(null);
    try {
      await loadNotebook(notebookId, true);
      setConflict(false);
      retryConflictRef.current = null;
      await retry();
    } catch (error) {
      handleMutationError(error, undefined, retry);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: Palette.background }}>
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
          keyboardShouldPersistTaps="handled">
          <AppText numberOfLines={2} variant="title">{detail.title}</AppText>

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

          <View style={{ gap: Space.md }}>
            <AppText variant="section">Details</AppText>
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
              value={title}
            />
            <AppTextInput
              accessibilityLabel="Notebook description"
              editable={!mutationDisabled}
              maxLength={10_000}
              multiline
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
            <SaveLabel state={metadataState} />
          </View>

          <View
            onLayout={(event: LayoutChangeEvent) => {
              blockSectionOffset.current = event.nativeEvent.layout.y;
            }}
            style={{ gap: Space.md }}>
            <View
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: Space.md,
              }}>
              <AppText style={{ flex: 1 }} variant="section">Text blocks</AppText>
              {detail.items.length > 0 ? (
                <AppButton
                  accessibilityLabel={indexOpen ? 'Hide block index' : 'Show block index'}
                  label={indexOpen ? 'Hide index' : 'Block index'}
                  onPress={() => setIndexOpen((current) => !current)}
                  variant="secondary"
                />
              ) : null}
              <AppButton
                accessibilityLabel="Add empty text block"
                disabled={mutationDisabled}
                label="Add block"
                onPress={() =>
                  runImmediateMutation(() => mutate.addText(detail.id, ''))
                }
              />
            </View>
            {indexOpen ? (
              <View
                accessibilityLabel="Notebook block index"
                style={{
                  backgroundColor: Palette.surfaceMuted,
                  borderRadius: Radius.control,
                  gap: Space.xs,
                  padding: Space.md,
                }}>
                {detail.items.map((item, index) => (
                  <AppButton
                    key={item.id}
                    accessibilityLabel={`Go to block ${index + 1}`}
                    label={`${index + 1}. ${notebookBlockIndexLabel(item, index)}`}
                    onPress={() => {
                      const y = blockOffsets.current[item.id];
                      if (y !== undefined) {
                        scrollRef.current?.scrollTo({
                          animated: true,
                          y: notebookBlockScrollOffset(blockSectionOffset.current, y),
                        });
                      }
                    }}
                    variant="secondary"
                  />
                ))}
              </View>
            ) : null}
            {detail.items.length === 0 ? (
              <AppText color={Palette.textMuted}>
                No text blocks yet. Add one to start writing.
              </AppText>
            ) : (
              detail.items.map((item, index) => (
                <View
                  key={item.id}
                  onLayout={(event: LayoutChangeEvent) => {
                    blockOffsets.current[item.id] = event.nativeEvent.layout.y;
                  }}
                  style={{
                    borderColor: Palette.border,
                    borderRadius: Radius.card,
                    borderWidth: 1,
                    gap: Space.md,
                    padding: Space.lg,
                  }}>
                  <AppTextInput
                    accessibilityLabel={`Text block ${index + 1} title`}
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
                    placeholder="Optional block title"
                    value={titleDrafts[item.id] ?? item.title ?? ''}
                  />
                  <AppTextInput
                    accessibilityLabel={`Text block ${index + 1}`}
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
                    placeholder="Write a note…"
                    style={{ minHeight: 112, textAlignVertical: 'top' }}
                    value={textDrafts[item.id] ?? item.text}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
                    <AppButton
                      accessibilityLabel={`Move text block ${index + 1} up`}
                      disabled={mutationDisabled || index === 0}
                      label="Move up"
                      onPress={() => reorder(item.id, -1)}
                      variant="secondary"
                    />
                    <AppButton
                      accessibilityLabel={`Move text block ${index + 1} down`}
                      disabled={mutationDisabled || index === detail.items.length - 1}
                      label="Move down"
                      onPress={() => reorder(item.id, 1)}
                      variant="secondary"
                    />
                    <AppButton
                      accessibilityLabel={`Delete text block ${index + 1}`}
                      disabled={mutationDisabled}
                      label="Delete"
                      onPress={() =>
                        Alert.alert('Delete text block?', 'This text block will be removed.', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              const timer = itemTimersRef.current[item.id];
                              if (timer) clearTimeout(timer);
                              delete itemTimersRef.current[item.id];
                              void runImmediateMutation(
                                () => mutate.deleteText(detail.id, item.id),
                                item.id
                              );
                            },
                          },
                        ])
                      }
                      variant="danger"
                    />
                  </View>
                  <SaveLabel state={itemStates[item.id] ?? 'idle'} />
                </View>
              ))
            )}
          </View>

          <AppButton
            accessibilityLabel="Delete this Notebook"
            disabled={mutationDisabled}
            label="Delete Notebook"
            onPress={() =>
              Alert.alert(
                'Delete Notebook?',
                'This removes the Notebook and all its text blocks.',
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
