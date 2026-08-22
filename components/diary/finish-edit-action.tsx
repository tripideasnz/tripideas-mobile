import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable } from 'react-native';

import { Palette, Radius } from '@/constants/design';

export function FinishEditAction({ accessibilityLabel, onPress, size = 'compact' }: { accessibilityLabel: string; onPress: () => void; size?: 'compact' | 'default' }) {
  const dimension = size === 'compact' ? 36 : 44;
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" hitSlop={6} onPress={onPress}
    style={({ pressed }) => ({ alignItems: 'center', backgroundColor: Palette.surface, borderColor: Palette.success, borderRadius: Radius.pill, borderWidth: 1, height: dimension, justifyContent: 'center', opacity: pressed ? 0.65 : 1, width: dimension })}>
    <MaterialIcons color={Palette.success} name="check" size={size === 'compact' ? 22 : 24} />
  </Pressable>;
}
