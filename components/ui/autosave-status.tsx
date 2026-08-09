import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette } from '@/constants/design';

export type AutosaveState = 'failed' | 'idle' | 'saving';

export function AutosaveStatus({
  accessibilityLabel,
  onRetry,
  state,
}: {
  accessibilityLabel: string;
  onRetry?: () => void;
  state: AutosaveState;
}) {
  const canRetry = state === 'failed' && Boolean(onRetry);
  return (
    <View style={{ minHeight: 17 }}>
      <Pressable
        accessibilityElementsHidden={state === 'idle'}
        accessibilityLabel={canRetry ? `Retry saving ${accessibilityLabel}` : undefined}
        accessibilityRole={canRetry ? 'button' : undefined}
        disabled={!canRetry}
        onPress={onRetry}
        style={{ opacity: state === 'idle' ? 0 : 1 }}>
        <AppText
          accessibilityLiveRegion="polite"
          color={state === 'failed' ? Palette.danger : Palette.textMuted}
          variant="caption">
          {state === 'saving'
            ? 'Saving…'
            : state === 'failed'
              ? onRetry ? 'Could not save. Tap to retry.' : 'Could not save'
              : 'Saved'}
        </AppText>
      </Pressable>
    </View>
  );
}
