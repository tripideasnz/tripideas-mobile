import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { Palette, Radius } from '@/constants/design';

export function IconAction({
  accessibilityLabel,
  destructive = false,
  disabled = false,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  destructive?: boolean;
  disabled?: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
}) {
  const color = destructive ? Palette.danger : Palette.textBody;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderColor: destructive ? Palette.danger : Palette.border,
        borderRadius: Radius.pill,
        borderWidth: 1,
        height: 44,
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.55 : 1,
        width: 44,
      })}>
      <MaterialIcons color={color} name={icon} size={22} />
    </Pressable>
  );
}
