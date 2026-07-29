import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/provider';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Palette, Radius, Screen, Space } from '@/constants/design';
import {
  createNotebookShare,
  listNotebookShares,
  revokeNotebookShare,
  rotateNotebookShare,
} from '@/notebook-sharing/api';
import {
  copyNotebookShareLink,
  openNotebookShareSheet,
} from '@/notebook-sharing/actions';
import {
  activeShareCapabilities,
  displayShareDate,
  sharingErrorMessage,
} from '@/notebook-sharing/model';
import type {
  NotebookShareCapability,
  NotebookShareState,
} from '@/notebook-sharing/types';
import { useNotebooks } from '@/notebooks/provider';

type ShareAction = 'create' | `revoke:${string}` | `rotate:${string}` | null;

function requestId(action: 'create' | 'rotate'): string {
  return `mobile-share-${action}:${Crypto.randomUUID()}`;
}

export default function NotebookSharingScreen() {
  const router = useRouter();
  const { notebookId: rawNotebookId } =
    useLocalSearchParams<{ notebookId: string }>();
  const notebookId = Array.isArray(rawNotebookId)
    ? rawNotebookId[0]
    : rawNotebookId;
  const { isLoading: isLoadingSession, session } = useSession();
  const { details } = useNotebooks();
  const notebook = notebookId ? details[notebookId] : undefined;
  const colorScheme = useColorScheme();
  const dark = colorScheme === 'dark';
  const colors = useMemo(
    () =>
      dark
        ? {
            background: '#111111',
            border: '#3b3b3b',
            muted: '#b8b8b8',
            surface: '#1d1d1d',
            text: '#ffffff',
          }
        : {
            background: Palette.background,
            border: Palette.border,
            muted: Palette.textMuted,
            surface: Palette.surfaceMuted,
            text: Palette.text,
          },
    [dark]
  );
  const [shareState, setShareState] = useState<NotebookShareState | null>(null);
  const [availableUrls, setAvailableUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [action, setAction] = useState<ShareAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const mountedRef = useRef(true);
  const createRequestRef = useRef<string | null>(null);
  const rotateRequestsRef = useRef<Record<string, string>>({});

  const load = useCallback(
    async (refresh = false) => {
      if (!notebookId || !session) return;
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const latest = await listNotebookShares(notebookId);
        if (mountedRef.current) setShareState(latest);
      } catch (loadError) {
        if (mountedRef.current) setError(sharingErrorMessage(loadError));
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [notebookId, session]
  );

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    if (!isLoadingSession && !session) router.replace('/notebooks');
  }, [isLoadingSession, router, session]);

  const activeCapabilities = activeShareCapabilities(shareState);
  const runCreate = async () => {
    if (!notebookId || action) return;
    const stableRequest =
      createRequestRef.current ?? (createRequestRef.current = requestId('create'));
    setAction('create');
    setError(null);
    try {
      const created = await createNotebookShare(notebookId, stableRequest);
      createRequestRef.current = null;
      if (created.url) {
        setAvailableUrls((current) => ({
          ...current,
          [created.id]: created.url as string,
        }));
        setAnnouncement('Share link created.');
      } else {
        setError(
          'The link was already created, but its secure URL is no longer available. Rotate it to create a new link.'
        );
      }
      await load(true);
    } catch (createError) {
      setError(sharingErrorMessage(createError));
    } finally {
      setAction(null);
    }
  };

  const runRotate = async (capability: NotebookShareCapability) => {
    if (!notebookId || action) return;
    const stableRequest =
      rotateRequestsRef.current[capability.id] ?? requestId('rotate');
    rotateRequestsRef.current[capability.id] = stableRequest;
    setAction(`rotate:${capability.id}`);
    setError(null);
    try {
      const created = await rotateNotebookShare(
        notebookId,
        capability.id,
        stableRequest
      );
      delete rotateRequestsRef.current[capability.id];
      setAvailableUrls((current) => {
        const next = { ...current };
        delete next[capability.id];
        if (created.url) next[created.id] = created.url;
        return next;
      });
      setAnnouncement('Share link rotated. The previous link no longer works.');
      if (!created.url) {
        setError(
          'The link was rotated, but its secure URL is no longer available. Rotate the active link again.'
        );
      }
      await load(true);
    } catch (rotateError) {
      setError(sharingErrorMessage(rotateError));
    } finally {
      setAction(null);
    }
  };

  const runRevoke = async (capability: NotebookShareCapability) => {
    if (!notebookId || action) return;
    setAction(`revoke:${capability.id}`);
    setError(null);
    try {
      await revokeNotebookShare(notebookId, capability.id);
      setAvailableUrls((current) => {
        const next = { ...current };
        delete next[capability.id];
        return next;
      });
      setAnnouncement('Share link revoked.');
      await load(true);
    } catch (revokeError) {
      setError(sharingErrorMessage(revokeError));
    } finally {
      setAction(null);
    }
  };

  const copyLink = async (capability: NotebookShareCapability) => {
    const url = availableUrls[capability.id];
    if (!url) return;
    try {
      await copyNotebookShareLink(url, Clipboard.setStringAsync);
      setAnnouncement('Share link copied.');
    } catch {
      setError('Could not copy the link. Please try again.');
    }
  };

  const shareLink = async (capability: NotebookShareCapability) => {
    const url = availableUrls[capability.id];
    if (!url) return;
    try {
      await openNotebookShareSheet(
        notebook?.title ?? 'My TripIdeas Notebook',
        url,
        Share.share
      );
    } catch {
      setError('Could not open sharing. Please try again.');
    }
  };

  if (isLoadingSession || (isLoading && shareState === null)) {
    return (
      <SafeAreaView
        style={{
          alignItems: 'center',
          backgroundColor: colors.background,
          flex: 1,
          justifyContent: 'center',
        }}>
        <ActivityIndicator accessibilityLabel="Loading sharing" color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ backgroundColor: colors.background, flex: 1 }}>
      <Stack.Screen options={{ title: 'Sharing' }} />
      <ScrollView
        contentContainerStyle={{
          gap: Space.xl,
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}
        refreshControl={
          <RefreshControl
            accessibilityLabel="Refresh sharing"
            onRefresh={() => void load(true)}
            refreshing={isRefreshing}
            tintColor={colors.text}
          />
        }>
        <View style={{ gap: Space.xs }}>
          <AppText color={colors.text} variant="section">
            Share this Notebook
          </AppText>
          <AppText color={colors.muted}>
            Anyone with an active link can view its current text and photos.
          </AppText>
        </View>

        {error ? (
          <AppText accessibilityLiveRegion="polite" color={Palette.danger}>
            {error}
          </AppText>
        ) : null}
        {announcement ? (
          <AppText
            accessibilityLiveRegion="polite"
            color={colors.muted}
            variant="caption">
            {announcement}
          </AppText>
        ) : null}

        {activeCapabilities.length === 0 ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: Radius.card,
              borderWidth: 1,
              gap: Space.lg,
              padding: Space.lg,
            }}>
            <AppText color={colors.text}>This Notebook is private.</AppText>
            <AppButton
              accessibilityLabel="Create share link"
              disabled={action !== null || !session}
              label={action === 'create' ? 'Creating…' : 'Create share link'}
              onPress={() => void runCreate()}
            />
          </View>
        ) : (
          <View style={{ gap: Space.md }}>
            {activeCapabilities.map((capability) => {
              const urlAvailable = Boolean(availableUrls[capability.id]);
              const isRotating = action === `rotate:${capability.id}`;
              const isRevoking = action === `revoke:${capability.id}`;
              return (
                <View
                  key={capability.id}
                  accessibilityLabel={`Active share link created ${displayShareDate(capability.createdAt)}`}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: Radius.card,
                    borderWidth: 1,
                    gap: Space.md,
                    padding: Space.lg,
                  }}>
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}>
                    <AppText color={colors.text} variant="bodyStrong">
                      Active link
                    </AppText>
                    <AppText color={colors.muted} variant="caption">
                      Created {displayShareDate(capability.createdAt)}
                    </AppText>
                  </View>
                  {!urlAvailable ? (
                    <AppText color={colors.muted} variant="caption">
                      For security, an existing link cannot be shown again.
                      Rotate it to create a new link you can copy or share.
                    </AppText>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
                    <AppButton
                      accessibilityHint={
                        urlAvailable
                          ? 'Copies the private share link'
                          : 'Rotate this link before copying'
                      }
                      disabled={!urlAvailable || action !== null}
                      label="Copy Link"
                      onPress={() => void copyLink(capability)}
                      size="compact"
                      variant="secondary"
                    />
                    <AppButton
                      accessibilityHint={
                        urlAvailable
                          ? 'Opens the system share sheet'
                          : 'Rotate this link before sharing'
                      }
                      disabled={!urlAvailable || action !== null}
                      label="Share…"
                      onPress={() => void shareLink(capability)}
                      size="compact"
                      variant="secondary"
                    />
                    <AppButton
                      disabled={action !== null}
                      label={isRotating ? 'Rotating…' : 'Rotate'}
                      onPress={() =>
                        Alert.alert(
                          'Rotate share link?',
                          'The current link will stop working immediately.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Rotate',
                              style: 'destructive',
                              onPress: () => void runRotate(capability),
                            },
                          ]
                        )
                      }
                      size="compact"
                      variant="secondary"
                    />
                    <AppButton
                      disabled={action !== null}
                      label={isRevoking ? 'Revoking…' : 'Revoke'}
                      onPress={() =>
                        Alert.alert(
                          'Revoke share link?',
                          'Anyone using this link will immediately lose access.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Revoke',
                              style: 'destructive',
                              onPress: () => void runRevoke(capability),
                            },
                          ]
                        )
                      }
                      size="compact"
                      variant="danger"
                    />
                  </View>
                </View>
              );
            })}
            <AppButton
              disabled={action !== null}
              label={action === 'create' ? 'Creating…' : 'Create another link'}
              onPress={() => void runCreate()}
              variant="secondary"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
