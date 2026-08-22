import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { Palette } from '@/constants/design';

export function PlainIconAction({ accessibilityLabel, disabled = false, icon, onPress }: {
  accessibilityLabel: string; disabled?: boolean; icon: ComponentProps<typeof MaterialIcons>['name']; onPress: () => void;
}) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} hitSlop={{ bottom: 0, left: 4, right: 4, top: 0 }} onPress={onPress}
    style={({ pressed }) => ({ alignItems: 'center', height: 44, justifyContent: 'center', opacity: disabled ? 0.3 : pressed ? 0.55 : 1, width: 36 })}>
    <MaterialIcons color={Palette.trip} name={icon} size={28} />
  </Pressable>;
}
