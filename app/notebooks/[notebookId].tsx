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
import {
  moveNotebookItemIds,
  notebookBlockIndexLabel,
  notebookBlockScrollOffset,
  validateNotebookMetadata,
} from '@/notebooks/model';
import { useNotebooks } from '@/notebooks/provider';
import type { NotebookDetail } from '@/notebooks/types';

type SaveState = 'changed' | 'failed' | 'idle' | 'saved' | 'saving';

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
  const scrollRef = useRef<ScrollView>(null);
  const blockSectionOffset = useRef(0);
  const blockOffsets = useRef<Record<string, number>>({});

  const applyAuthoritativeDetail = useCallback((
    next: NotebookDetail,
    options: { resetDrafts?: boolean; savedItemId?: string; savedMetadata?: boolean } = {}
  ) => {
    const { resetDrafts = false, savedItemId, savedMetadata = false } = options;
    setTitle((current) =>
      resetDrafts || savedMetadata || !['changed', 'failed'].includes(metadataState)
        ? next.title
        : current
    );
    setDescription((current) =>
      resetDrafts || savedMetadata || !['changed', 'failed'].includes(metadataState)
        ? next.description ?? ''
        : current
    );
    setTextDrafts((current) =>
      Object.fromEntries(
        next.items.map((item) => [
          item.id,
          resetDrafts ||
          savedItemId === item.id ||
          !['changed', 'failed'].includes(itemStates[item.id] ?? 'idle')
            ? item.text
            : current[item.id] ?? item.text,
        ])
      )
    );
    setTitleDrafts((current) =>
      Object.fromEntries(
        next.items.map((item) => [
          item.id,
          resetDrafts ||
          savedItemId === item.id ||
          !['changed', 'failed'].includes(itemStates[item.id] ?? 'idle')
            ? item.title ?? ''
            : current[item.id] ?? item.title ?? '',
        ])
      )
    );
    if (resetDrafts) {
      setMetadataState('saved');
      setItemStates({});
    } else {
      if (savedMetadata) setMetadataState('saved');
      if (savedItemId) {
        setItemStates((current) => ({ ...current, [savedItemId]: 'saved' }));
      }
    }
    setConflict(false);
    setActionError(null);
    setIsOffline(false);
  }, [itemStates, metadataState]);

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
        setIsOffline(false);
      } catch (error) {
        const failure = classifyNotebookError(error);
        setIsOffline(failure === 'offline');
        setNotFound(failure === 'not-found');
        if (failure !== 'offline' && failure !== 'not-found') {
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
    if (detail && !title && metadataState === 'idle') {
      applyAuthoritativeDetail(detail, { resetDrafts: true });
    }
  }, [applyAuthoritativeDetail, detail, metadataState, title]);

  const handleMutationError = (error: unknown, itemId?: string) => {
    const failure = classifyNotebookError(error);
    if (failure === 'conflict') {
      setConflict(true);
      setActionError('This Notebook changed elsewhere.');
    } else if (failure === 'offline') {
      setIsOffline(true);
      setActionError('You appear to be offline. Your changes have not been saved.');
    } else if (failure === 'not-found') {
      setNotFound(true);
    } else if (failure === 'validation') {
      setActionError('Check this content and try again.');
    } else {
      setActionError('Could not save. Please try again.');
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
  const saveMetadata = async () => {
    const validation = validateNotebookMetadata(title, description);
    if (!validation.valid) {
      setActionError(validation.message);
      setMetadataState('failed');
      return;
    }
    setMetadataState('saving');
    setActionError(null);
    try {
      const latest = await mutate.updateMetadata(detail, {
        title: validation.title,
        description: validation.description,
      });
      applyAuthoritativeDetail(latest, { savedMetadata: true });
    } catch (error) {
      handleMutationError(error);
    }
  };

  const saveText = async (itemId: string) => {
    const blockTitle = titleDrafts[itemId] ?? '';
    if (blockTitle.length > 200) {
      setActionError('Keep block titles under 200 characters.');
      setItemStates((current) => ({ ...current, [itemId]: 'failed' }));
      return;
    }
    setItemStates((current) => ({ ...current, [itemId]: 'saving' }));
    setActionError(null);
    try {
      const latest = await mutate.updateText(detail, itemId, {
        title: blockTitle.trim() || null,
        text: textDrafts[itemId] ?? '',
      });
      applyAuthoritativeDetail(latest, { savedItemId: itemId });
    } catch (error) {
      handleMutationError(error, itemId);
    }
  };

  const reorder = async (itemId: string, offset: -1 | 1) => {
    const ids = moveNotebookItemIds(detail.items, itemId, offset);
    if (!ids) return;
    setActionError(null);
    try {
      applyAuthoritativeDetail(await mutate.reorder(detail, ids));
    } catch (error) {
      handleMutationError(error, itemId);
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
                <AppButton
                  label="Keep draft"
                  onPress={() => setActionError('Draft kept locally. Reload before saving.')}
                  style={{ flex: 1 }}
                  variant="secondary"
                />
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
                setTitle(value);
                setMetadataState('changed');
              }}
              value={title}
            />
            <AppTextInput
              accessibilityLabel="Notebook description"
              editable={!mutationDisabled}
              maxLength={10_000}
              multiline
              onChangeText={(value) => {
                setDescription(value);
                setMetadataState('changed');
              }}
              placeholder="Optional description"
              style={{ minHeight: 96, textAlignVertical: 'top' }}
              value={description}
            />
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.md }}>
              <AppButton
                disabled={mutationDisabled || metadataState === 'saving'}
                label={metadataState === 'saving' ? 'Saving…' : 'Save details'}
                onPress={saveMetadata}
              />
              <SaveLabel state={metadataState} />
            </View>
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
                onPress={async () => {
                  setActionError(null);
                  try {
                    applyAuthoritativeDetail(await mutate.addText(detail, ''));
                  } catch (error) {
                    handleMutationError(error);
                  }
                }}
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
                      setTitleDrafts((current) => ({ ...current, [item.id]: value }));
                      setItemStates((current) => ({ ...current, [item.id]: 'changed' }));
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
                      setTextDrafts((current) => ({ ...current, [item.id]: value }));
                      setItemStates((current) => ({ ...current, [item.id]: 'changed' }));
                    }}
                    placeholder="Write a note…"
                    style={{ minHeight: 112, textAlignVertical: 'top' }}
                    value={textDrafts[item.id] ?? item.text}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
                    <AppButton
                      accessibilityLabel={`Save text block ${index + 1}`}
                      disabled={mutationDisabled || itemStates[item.id] === 'saving'}
                      label={itemStates[item.id] === 'saving' ? 'Saving…' : 'Save'}
                      onPress={() => saveText(item.id)}
                    />
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
                              void mutate
                                .deleteText(detail, item.id)
                                .then(applyAuthoritativeDetail)
                                .catch((error) => handleMutationError(error, item.id));
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
                      void deleteNotebook(detail.id, detail.version)
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
      ? 'Saving'
      : state === 'saved'
        ? 'Saved'
        : state === 'failed'
          ? 'Failed to save'
          : state === 'changed'
            ? 'Unsaved changes'
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
