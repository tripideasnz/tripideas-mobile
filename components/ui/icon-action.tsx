import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { Palette, Radius } from '@/constants/design';

export function IconAction({
  accessibilityLabel,
  color: customColor,
  destructive = false,
  disabled = false,
  icon,
  onPress,
  semantic,
  size = 'default',
  trip = false,
}: {
  accessibilityLabel: string;
  color?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  semantic?: 'edit';
  size?: 'compact' | 'default';
  trip?: boolean;
}) {
  const usesTripColor = trip || semantic === 'edit';
  const color = customColor ?? (destructive ? Palette.danger : usesTripColor ? Palette.trip : Palette.textBody);
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
        borderColor: customColor ?? (destructive ? Palette.danger : usesTripColor ? Palette.trip : Palette.border),
        borderRadius: Radius.pill,
        borderWidth: 1,
        height: dimension,
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.55 : 1,
        width: dimension,
      })}>
      <MaterialIcons color={color} name={icon} size={size === 'compact' ? 18 : 22} />
    </Pressable>
  );
}
