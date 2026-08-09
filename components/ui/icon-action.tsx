import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { Palette, Radius } from '@/constants/design';

export function IconAction({
  accessibilityLabel,
  color,
  destructive = false,
  disabled = false,
  icon,
  onPress,
  size = 'default',
}: {
  accessibilityLabel: string;
  color?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  size?: 'compact' | 'default';
}) {
  const actionColor = destructive ? Palette.danger : color ?? Palette.textBody;
  const dimension = size === 'compact' ? 36 : 44;
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
        borderColor: destructive ? Palette.danger : color ?? Palette.border,
        borderRadius: Radius.pill,
        borderWidth: 1,
        height: dimension,
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.55 : 1,
        width: dimension,
      })}>
      <MaterialIcons color={actionColor} name={icon} size={size === 'compact' ? 18 : 22} />
    </Pressable>
  );
}
