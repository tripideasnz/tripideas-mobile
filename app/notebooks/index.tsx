import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/provider';
import { AppButton } from '@/components/ui/app-button';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { IconAction } from '@/components/ui/icon-action';
import { LoadingView } from '@/components/ui/loading-view';
import { TripImageCollage } from '@/components/trip-image-collage';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { pagesFromContentBlocks } from '@/content-blocks/pages';
import { authorizePhotoRead } from '@/notebooks/api';
import { classifyNotebookError } from '@/notebooks/errors';
import { validateNotebookMetadata } from '@/notebooks/model';
import {
  backFromNotebookList,
  openNotebook,
} from '@/notebooks/navigation';
import { useNotebooks } from '@/notebooks/provider';
import type { NotebookSummary } from '@/notebooks/types';
import type { TripImage } from '@/trips/images';

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ''
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

export default function NotebookListScreen() {
  const router = useRouter();
  const { isLoading: isLoadingSession, session, signIn } = useSession();
  const {
    createNotebook,
    deleteNotebook,
    loadNotebook,
    isLoading,
    listError,
    notebooks,
    refresh,
  } = useNotebooks();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [coverImages, setCoverImages] = useState<Record<string, TripImage[]>>({});
  const coverUrlCacheRef = useRef(new Map<string, string>());
  const createInFlightRef = useRef(false);
  const handleBack = useCallback(() => {
    backFromNotebookList(router);
  }, [router]);

  const resetCreateForm = () => {
    setTitle('');
    setDescription('');
    setFormError(null);
    setIsCreating(false);
    createInFlightRef.current = false;
  };

  useEffect(() => {
    if (session) setFormError(null);
  }, [session]);

  const notebookIdsKey = useMemo(
    () => notebooks.map((notebook) => notebook.id).join('|'),
    [notebooks]
  );

  useFocusEffect(useCallback(() => {
    let mounted = true;
    void Promise.all(notebooks.map(async (notebook) => {
      try {
        const detail = await loadNotebook(notebook.id, false);
        if (!detail) return [notebook.id, []] as const;
        const pages = detail.pages ?? pagesFromContentBlocks(detail.items);
        const firstPhotos = pages.flatMap((page) =>
          page.blocks.find((block) => block.type === 'photo') ?? []
        ).slice(0, 4);
        const images = (await Promise.all(firstPhotos.map(async (photo) => {
          const cachedUrl = coverUrlCacheRef.current.get(photo.photoAssetId);
          if (cachedUrl) {
            return {
              alt: `${notebook.title} page photo`,
              cacheKey: photo.photoAssetId,
              url: cachedUrl,
            };
          }
          try {
            const result = await authorizePhotoRead(photo.photoAssetId);
            coverUrlCacheRef.current.set(photo.photoAssetId, result.url);
            return {
              alt: `${notebook.title} page photo`,
              cacheKey: photo.photoAssetId,
              url: result.url,
            };
          } catch {
            return null;
          }
        }))).filter((image): image is NonNullable<typeof image> => image !== null);
        return [notebook.id, images] as const;
      } catch {
        return [notebook.id, []] as const;
      }
    })).then((entries) => {
      if (mounted) setCoverImages(Object.fromEntries(entries));
    });
    return () => { mounted = false; };
    // IDs change when a Notebook is added or removed; detail refresh happens on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadNotebook, notebookIdsKey]));

  const submitCreate = async () => {
    if (createInFlightRef.current) return;

    const validation = validateNotebookMetadata(title, description);
    if (!validation.valid) {
      setFormError(validation.message);
      return;
    }

    createInFlightRef.current = true;
    setIsCreating(true);
    setFormError(null);
    try {
      const detail = await createNotebook({
        title: validation.title,
        description: validation.description,
      });
      resetCreateForm();
      setShowCreate(false);
      openNotebook(router, detail.id);
    } catch (error) {
      const failure = classifyNotebookError(error);
      setFormError(
        failure === 'offline'
          ? 'You appear to be offline. Connect to create a Notebook.'
          : failure === 'validation'
            ? 'Check the title and description, then try again.'
            : 'Could not create the Notebook. Please try again.'
      );
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
    }
  };

  if (isLoadingSession) {
    return (
      <>
        <Stack.Screen
          options={{
            headerLeft: () => <HeaderBackButton color={Palette.trip} onPress={handleBack} />,
            headerRight: () => null,
          }}
        />
        <LoadingView />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Stack.Screen
          options={{
            headerLeft: () => <HeaderBackButton color={Palette.trip} onPress={handleBack} />,
            headerRight: () => null,
          }}
        />
        <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
          <View style={{ gap: Space.lg, padding: Screen.gutter }}>
            <AppText color={Palette.textBody}>
              Sign in to view and edit your private travel Notebooks.
            </AppText>
            <AppButton label="Sign in" onPress={signIn} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: Palette.background }}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderBackButton color={Palette.trip} onPress={handleBack} />,
          headerRight: () => (
            <Pressable
              accessibilityLabel="Add Notebook"
              accessibilityRole="button"
              disabled={showCreate}
              hitSlop={12}
              onPress={() => {
                setFormError(null);
                setShowCreate(true);
              }}
              style={({ pressed }) => ({
                opacity: showCreate ? 0.35 : pressed ? 0.55 : 1,
              })}>
              <MaterialIcons color={Palette.trip} name="add" size={30} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            gap: Space.lg,
            paddingBottom: Screen.bottom,
            paddingHorizontal: Screen.gutter,
            paddingTop: Screen.top,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              accessibilityLabel="Refresh Notebooks"
              onRefresh={refresh}
              refreshing={isLoading}
            />
          }>
          {showCreate ? (
            <View
              style={{
                backgroundColor: Palette.surfaceMuted,
                borderRadius: Radius.card,
                gap: Space.md,
                padding: Space.lg,
              }}>
              <AppText variant="section">New Notebook</AppText>
              <AppTextInput
                accessibilityLabel="Notebook title"
                autoFocus
                maxLength={200}
                onChangeText={(value) => {
                  setTitle(value);
                  setFormError(null);
                }}
                placeholder="e.g. South Island ideas"
                value={title}
              />
              <AppTextInput
                accessibilityLabel="Notebook description"
                maxLength={10_000}
                multiline
                onChangeText={(value) => {
                  setDescription(value);
                  setFormError(null);
                }}
                placeholder="Optional description"
                style={{ minHeight: 72, textAlignVertical: 'top' }}
                value={description}
              />
              {formError ? <AppText color={Palette.danger}>{formError}</AppText> : null}
              <View style={{ flexDirection: 'row', gap: Space.sm, justifyContent: 'flex-end' }}>
                <IconAction
                  accessibilityLabel="Create Notebook"
                  disabled={isCreating}
                  icon="check"
                  onPress={submitCreate}
                />
                <IconAction
                  accessibilityLabel="Cancel Notebook creation"
                  disabled={isCreating}
                  icon="close"
                  onPress={() => {
                    resetCreateForm();
                    setShowCreate(false);
                  }}
                />
              </View>
            </View>
          ) : null}

          {listError ? (
            <View style={{ gap: Space.md }}>
              <AppText color={Palette.danger}>
                {notebooks.length
                  ? 'Could not refresh. Showing saved Notebooks.'
                  : 'Could not load Notebooks. Check your connection and try again.'}
              </AppText>
              <AppButton label="Retry" onPress={refresh} variant="secondary" />
            </View>
          ) : null}

          {isLoading && notebooks.length === 0 ? (
            <LoadingView />
          ) : notebooks.length === 0 ? (
            <AppText color={Palette.textMuted}>
                No Notebooks yet. Add one for notes, plans, and travel ideas.
            </AppText>
          ) : (
            notebooks.map((notebook) => (
              <NotebookRow
                coverImages={coverImages[notebook.id] ?? []}
                key={notebook.id}
                notebook={notebook}
                onCoverImageError={(image) => {
                  if (!image.cacheKey) return;
                  coverUrlCacheRef.current.delete(image.cacheKey);
                  void authorizePhotoRead(image.cacheKey).then((result) => {
                    coverUrlCacheRef.current.set(image.cacheKey as string, result.url);
                    setCoverImages((current) => ({
                      ...current,
                      [notebook.id]: (current[notebook.id] ?? []).map((currentImage) =>
                        currentImage.cacheKey === image.cacheKey
                          ? { ...currentImage, url: result.url }
                          : currentImage
                      ),
                    }));
                  }).catch(() => undefined);
                }}
                onDelete={() => Alert.alert(
                  'Delete Notebook?',
                  `This removes "${notebook.title}" and all its pages.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => void deleteNotebook(notebook.id) },
                  ]
                )}
                onOpen={() => openNotebook(router, notebook.id)}
              />
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function NotebookRow({
  coverImages,
  notebook,
  onCoverImageError,
  onDelete,
  onOpen,
}: {
  coverImages: TripImage[];
  notebook: NotebookSummary;
  onCoverImageError: (image: TripImage) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <View>
      <Pressable
        accessibilityLabel={`Open ${notebook.title}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => ({
          borderColor: Palette.border,
          borderRadius: Radius.card,
          borderWidth: 1,
          flexDirection: 'row',
          opacity: pressed ? 0.65 : 1,
          overflow: 'hidden',
        })}>
        <TripImageCollage
          emptyLabel="Notebook"
          images={coverImages}
          onImageError={onCoverImageError}
          style={{ height: 92, width: 112 }}
        />
        <View style={{ flex: 1, gap: Space.xs, justifyContent: 'center', padding: Space.lg, paddingRight: 60 }}>
        <AppText
          numberOfLines={2}
          style={{ fontSize: 17, fontWeight: '700', lineHeight: 22 }}>
          {notebook.title}
        </AppText>
        <AppText
          color={Palette.textMuted}
          style={{ fontSize: 14, lineHeight: 18 }}>
          {notebook.itemCount} {notebook.itemCount === 1 ? 'page' : 'pages'}
          {displayDate(notebook.updatedAt) ? ` · Updated ${displayDate(notebook.updatedAt)}` : ''}
        </AppText>
        </View>
      </Pressable>
      <View style={{ position: 'absolute', right: Space.md, top: 28 }}>
        <IconAction
          accessibilityLabel={`Delete ${notebook.title}`}
          destructive
          icon="delete-outline"
          onPress={onDelete}
          size="compact"
        />
      </View>
    </View>
  );
}
