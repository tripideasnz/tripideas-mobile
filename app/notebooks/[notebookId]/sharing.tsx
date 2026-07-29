import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { pagesFromContentBlocks } from '@/content-blocks/pages';
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
  sharingErrorMessage,
} from '@/notebook-sharing/model';
import type {
  NotebookShareCapability,
  NotebookShareState,
} from '@/notebook-sharing/types';
import { useNotebooks } from '@/notebooks/provider';
import { authorizePhotoRead } from '@/notebooks/api';

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
  const pages = useMemo(
    () =>
      notebook
        ? notebook.pages ?? pagesFromContentBlocks(notebook.items)
        : [],
    [notebook]
  );
  const previewPage = pages[0];
  const previewText = previewPage?.blocks.find((block) => block.type === 'text');
  const previewPhoto = previewPage?.blocks.find(
    (block) => block.type === 'photo'
  );
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
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
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

  useEffect(() => {
    let active = true;
    setPreviewPhotoUrl(null);
    if (!previewPhoto || previewPhoto.type !== 'photo') return;
    void authorizePhotoRead(previewPhoto.photoAssetId)
      .then((authorization) => {
        if (active) setPreviewPhotoUrl(authorization.url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [previewPhoto]);

  const activeCapabilities = activeShareCapabilities(shareState);
  const capability = activeCapabilities[0];
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
          'The link was already created, but its secure URL is no longer available. Generate a new link to continue.'
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
          'The new link was created, but its secure URL is no longer available. Generate another link to continue.'
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

        {!capability ? (
          <View style={{ gap: Space.lg }}>
            <View style={{ alignItems: 'center', gap: Space.md }}>
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  borderRadius: Radius.pill,
                  height: 52,
                  justifyContent: 'center',
                  width: 52,
                }}>
                <Ionicons color={colors.muted} name="link-outline" size={24} />
              </View>
              <AppText color={colors.text} variant="section">
                Share Notebook
              </AppText>
              <AppText color={colors.muted}>
                This Notebook is currently private.
              </AppText>
            </View>
            <SharingPromise
              color={colors.text}
              text="Anyone with the link can view this Notebook."
            />
            <SharingPromise
              color={colors.text}
              text="They cannot edit or make changes."
            />
            <AppButton
              accessibilityLabel="Create share link"
              disabled={action !== null || !session}
              label={action === 'create' ? 'Creating…' : 'Create Share Link'}
              onPress={() => void runCreate()}
            />
            <AppButton
              label="Cancel"
              onPress={() => router.back()}
              variant="secondary"
            />
          </View>
        ) : (
          <View style={{ gap: Space.lg }}>
            <View style={{ alignItems: 'center', gap: Space.sm }}>
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: '#2e9d50',
                  borderRadius: Radius.pill,
                  height: 44,
                  justifyContent: 'center',
                  width: 44,
                }}>
                <Ionicons color="#ffffff" name="checkmark" size={26} />
              </View>
              <AppText color={colors.text} variant="section">
                Link Active
              </AppText>
              <AppText color={colors.muted} style={{ textAlign: 'center' }}>
                Anyone with this link can view this Notebook.
              </AppText>
            </View>

            <View
              accessibilityLabel="Shared Notebook preview"
              style={{
                borderColor: colors.border,
                borderRadius: Radius.card,
                borderWidth: 1,
                gap: Space.sm,
                overflow: 'hidden',
                padding: Space.md,
              }}>
              <AppText color={colors.text} variant="bodyStrong">
                {previewPage?.title || notebook?.title || 'Notebook'}
              </AppText>
              {previewText?.type === 'text' && previewText.text ? (
                <AppText color={colors.muted} numberOfLines={3}>
                  {previewText.text}
                </AppText>
              ) : null}
              {previewPhotoUrl ? (
                <Image
                  accessibilityLabel="Shared Notebook preview photo"
                  contentFit="cover"
                  source={{ uri: previewPhotoUrl }}
                  style={{
                    aspectRatio: 16 / 7,
                    borderRadius: Radius.small,
                    width: '100%',
                  }}
                />
              ) : null}
            </View>

            {!availableUrls[capability.id] ? (
              <AppText color={colors.muted} variant="caption">
                For security, the existing link cannot be shown again.
                Generate a new link to copy or share it.
              </AppText>
            ) : null}

            <View>
              <SharingActionRow
                color={Palette.trip}
                disabled={!availableUrls[capability.id] || action !== null}
                icon="copy-outline"
                label="Copy Link"
                onPress={() => void copyLink(capability)}
              />
              <SharingActionRow
                color={Palette.trip}
                disabled={!availableUrls[capability.id] || action !== null}
                icon="share-outline"
                label="Share…"
                onPress={() => void shareLink(capability)}
              />
              <SharingActionRow
                color={Palette.trip}
                disabled={action !== null}
                icon="refresh-circle-outline"
                label={
                  action === `rotate:${capability.id}`
                    ? 'Generating…'
                    : 'Generate New Link'
                }
                onPress={() =>
                  Alert.alert(
                    'Generate a new link?',
                    'The current link will stop working immediately.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Generate',
                        style: 'destructive',
                        onPress: () => void runRotate(capability),
                      },
                    ]
                  )
                }
              />
              <SharingActionRow
                color={Palette.danger}
                disabled={action !== null}
                icon="trash-outline"
                label={
                  action === `revoke:${capability.id}`
                    ? 'Stopping…'
                    : 'Stop Sharing'
                }
                onPress={() =>
                  Alert.alert(
                    'Stop Sharing?',
                    'The current link will stop working immediately.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Stop Sharing',
                        style: 'destructive',
                        onPress: () => void runRevoke(capability),
                      },
                    ]
                  )
                }
              />
            </View>
            <AppButton
              label="Cancel"
              onPress={() => router.back()}
              variant="secondary"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SharingPromise({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: Space.sm }}>
      <Ionicons color={color} name="checkmark" size={20} />
      <AppText color={color} style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

function SharingActionRow({
  color,
  disabled,
  icon,
  label,
  onPress,
}: {
  color: string;
  disabled: boolean;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderBottomColor: Palette.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: Space.md,
        minHeight: 48,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        paddingHorizontal: Space.sm,
      })}>
      <Ionicons color={color} name={icon} size={20} />
      <AppText color={color} variant="bodyStrong">
        {label}
      </AppText>
    </Pressable>
  );
}
