import { Redirect, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/use-session';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { StatusText } from '@/components/ui/status-text';
import { Palette, Screen, Space } from '@/constants/design';
import { safePhotoUploadMessage } from '@/photo-uploads/errors';
import { pickPhotoForUpload } from '@/photo-uploads/picker';
import {
  listNativePhotoUploads,
  prepareNativePhotoUpload,
  startNativePhotoUpload,
} from '@/photo-uploads/service';
import type { LocalPhotoUploadRecord } from '@/photo-uploads/types';

export default function PhotoUploadDevScreen() {
  const { session, user } = useSession();
  const userId = session?.userId ?? user?.id ?? null;
  const [records, setRecords] = useState<LocalPhotoUploadRecord[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      return;
    }
    setRecords(await listNativePhotoUploads(userId));
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!__DEV__) return <Redirect href="/(tabs)/saved" />;

  const select = async () => {
    if (!userId || isBusy) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const selected = await pickPhotoForUpload();
      if (!selected) return;
      await prepareNativePhotoUpload(userId, selected);
      await refresh();
    } catch {
      setMessage('The selected photo could not be prepared.');
    } finally {
      setIsBusy(false);
    }
  };

  const start = async (
    record: LocalPhotoUploadRecord,
    interruptPutOnce = false
  ) => {
    if (!userId || isBusy) return;
    setIsBusy(true);
    setMessage(null);
    try {
      const result = await startNativePhotoUpload(userId, record.id, {
        interruptPutOnce,
      });
      if (result.lastErrorCode) {
        setMessage(safePhotoUploadMessage(result.lastErrorCode));
      }
      await refresh();
    } catch {
      setMessage('The upload could not be started.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: Palette.background }}>
      <Stack.Screen options={{ title: 'Photo upload verification' }} />
      <ScrollView
        contentContainerStyle={{
          gap: Space.lg,
          paddingBottom: Screen.bottom,
          paddingHorizontal: Screen.gutter,
          paddingTop: Screen.top,
        }}>
        <AppText variant="display">Photo transport</AppText>
        <StatusText>
          Development-only staging harness. It does not attach photos to Notebooks.
        </StatusText>
        {!userId ? (
          <StatusText>Sign in before testing an upload.</StatusText>
        ) : (
          <AppButton
            disabled={isBusy}
            label={isBusy ? 'Working…' : 'Select photo'}
            onPress={select}
          />
        )}
        {message ? <StatusText>{message}</StatusText> : null}
        {records.map((record) => (
          <View
            key={record.id}
            style={{
              backgroundColor: Palette.surface,
              borderColor: Palette.border,
              borderRadius: 12,
              borderWidth: 1,
              gap: Space.sm,
              padding: Space.lg,
            }}>
            <AppText variant="bodyStrong">Upload {record.id.slice(0, 8)}</AppText>
            <AppText>State: {record.state}</AppText>
            <AppText>Type: {record.contentType}</AppText>
            <AppText>Bytes: {record.fileSizeBytes}</AppText>
            <AppText>Retries: {record.retryCount}</AppText>
            <AppText>
              Remote asset: {record.assetId ? record.assetId : 'not created'}
            </AppText>
            {record.lastErrorCode ? (
              <AppText>Error: {record.lastErrorCode}</AppText>
            ) : null}
            {record.state !== 'UPLOADED' &&
            record.state !== 'PERMANENT_ERROR' ? (
              <AppButton
                disabled={isBusy}
                label={record.retryCount > 0 ? 'Retry upload' : 'Start upload'}
                onPress={() => start(record)}
                variant="secondary"
              />
            ) : null}
            {record.state === 'VALIDATED' && record.retryCount === 0 ? (
              <AppButton
                disabled={isBusy}
                label="Test interrupted PUT"
                onPress={() => start(record, true)}
                variant="secondary"
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
