import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
    deleteNotebook,
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

  const submitCreate = async () => {
    const validation = validateNotebookMetadata(title, description);
    if (!validation.valid) {
      setFormError(validation.message);
      return;
    }

    setIsCreating(true);
    setFormError(null);
    try {
      const detail = await createNotebook({
        title: validation.title,
        description: validation.description,
      });
      setTitle('');
      setDescription('');
      setShowCreate(false);
      router.push(`/notebooks/${detail.id}` as Href);
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
      setIsCreating(false);
    }
  };

  if (isLoadingSession) return <LoadingView />;

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.background }}>
        <View style={{ gap: Space.lg, padding: Screen.gutter }}>
          <AppText variant="display">Notebooks</AppText>
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
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.md }}>
            <AppText style={{ flex: 1 }} variant="section">Notebooks</AppText>
            <AppButton
              accessibilityLabel="Add Notebook"
              label={showCreate ? 'Cancel' : 'Add Notebook'}
              onPress={() => {
                setFormError(null);
                setShowCreate((current) => !current);
              }}
              variant="secondary"
            />
          </View>

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
                onChangeText={setTitle}
                placeholder="e.g. South Island ideas"
                value={title}
              />
              <AppTextInput
                accessibilityLabel="Notebook description"
                maxLength={10_000}
                multiline
                onChangeText={setDescription}
                placeholder="Optional description"
                style={{ minHeight: 96, textAlignVertical: 'top' }}
                value={description}
              />
              {formError ? <AppText color={Palette.danger}>{formError}</AppText> : null}
              <AppButton
                disabled={isCreating}
                label={isCreating ? 'Creating…' : 'Create Notebook'}
                onPress={submitCreate}
              />
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
                onDelete={() =>
                  Alert.alert(
                    'Delete Notebook?',
                    'This removes the Notebook and its pages.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          void deleteNotebook(notebook.id).catch(() => {
                            Alert.alert(
                              'Could not delete Notebook',
                              'It may have changed elsewhere. Open it and reload before trying again.'
                            );
                          });
                        },
                      },
                    ]
                  )
                }
                onOpen={() =>
                  router.push(`/notebooks/${notebook.id}` as Href)
                }
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
  onDelete,
  onOpen,
}: {
  notebook: NotebookSummary;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <View
      style={{
        borderColor: Palette.border,
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
      }}>
      <View style={{ gap: Space.xs, padding: Space.lg }}>
        <AppText numberOfLines={2} variant="cardTitle">{notebook.title}</AppText>
        {notebook.description ? (
          <AppText color={Palette.textMuted} numberOfLines={2}>
            {notebook.description}
          </AppText>
        ) : null}
        <AppText color={Palette.textMuted} variant="caption">
          {notebook.itemCount} {notebook.itemCount === 1 ? 'page' : 'pages'}
          {displayDate(notebook.updatedAt) ? ` · Updated ${displayDate(notebook.updatedAt)}` : ''}
        </AppText>
        <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.sm }}>
          <AppButton
            accessibilityLabel={`Open ${notebook.title}`}
            label="Open"
            onPress={onOpen}
            style={{ minHeight: 40, paddingVertical: Space.sm }}
          />
          <AppButton
            accessibilityLabel={`Delete ${notebook.title}`}
            label="Delete"
            onPress={onDelete}
            style={{ minHeight: 40, paddingVertical: Space.sm }}
            variant="danger"
          />
        </View>
      </View>
    </View>
  );
}
