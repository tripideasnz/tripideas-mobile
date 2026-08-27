import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette, Radius, Screen, Shadow } from '@/constants/design';

export function FloatingStructuralAdd({ accessibilityLabel, disabled = false, onPress }: {
  accessibilityLabel: string; disabled?: boolean; onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ ...Shadow.floating, alignItems: 'center', backgroundColor: Palette.trip, borderRadius: Radius.pill, bottom: Math.max(insets.bottom, Screen.bottom), height: 52, justifyContent: 'center', opacity: disabled ? 0.45 : pressed ? 0.7 : 1, position: 'absolute', right: Screen.gutter, width: 52 })}><MaterialIcons color={Palette.textOnPrimary} name="add" size={28} /></Pressable>;
}
