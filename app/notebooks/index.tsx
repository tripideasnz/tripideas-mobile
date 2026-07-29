import { HeaderBackButton } from '@react-navigation/elements';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { LoadingView } from '@/components/ui/loading-view';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import { classifyNotebookError } from '@/notebooks/errors';
import { validateNotebookMetadata } from '@/notebooks/model';
import {
  backFromNotebookList,
  openNotebook,
} from '@/notebooks/navigation';
import { useNotebooks } from '@/notebooks/provider';
import type { NotebookSummary } from '@/notebooks/types';

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

  if (isLoadingSession) return <LoadingView />;

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
        <View style={{ gap: Space.lg, padding: Screen.gutter }}>
          <AppText color={Palette.textBody}>
            Sign in to view and edit your private travel Notebooks.
          </AppText>
          <AppButton label="Sign in" onPress={signIn} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: Palette.background }}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderBackButton onPress={handleBack} />,
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
                paddingHorizontal: Space.sm,
              })}>
              <AppText
                color={Palette.trip}
                style={{ fontSize: 34, fontWeight: '500', lineHeight: 34 }}>
                +
              </AppText>
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
              <View style={{ flexDirection: 'row', gap: Space.sm }}>
                <AppButton
                  disabled={isCreating}
                  label={isCreating ? 'Creating…' : 'Create'}
                  onPress={submitCreate}
                  size="compact"
                />
                <AppButton
                  disabled={isCreating}
                  label="Cancel"
                  onPress={() => {
                    resetCreateForm();
                    setShowCreate(false);
                  }}
                  size="compact"
                  variant="secondary"
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
                key={notebook.id}
                notebook={notebook}
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
  notebook,
  onOpen,
}: {
  notebook: NotebookSummary;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Open ${notebook.title}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => ({
        borderBottomColor: Palette.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: Space.md,
        opacity: pressed ? 0.6 : 1,
        paddingHorizontal: Space.xs,
        paddingVertical: Space.lg,
      })}>
      <View style={{ flex: 1, gap: Space.xs }}>
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
      <AppText
        accessibilityElementsHidden
        color={Palette.textMuted}
        importantForAccessibility="no-hide-descendants"
        style={{ alignSelf: 'center', fontSize: 24 }}>
        ›
      </AppText>
    </Pressable>
  );
}
