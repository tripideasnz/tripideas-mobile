import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Radius, Space } from '@/constants/design';

type AppButtonVariant = 'primary' | 'secondary' | 'danger';

type AppButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  style?: StyleProp<ViewStyle>;
  variant?: AppButtonVariant;
};

export function AppButton({
  disabled,
  label,
  style,
  variant = 'primary',
  ...props
}: AppButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const foreground = isPrimary
    ? Palette.textOnPrimary
    : isDanger
      ? Palette.danger
      : Palette.text;

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          backgroundColor: isPrimary ? Palette.primary : Palette.surface,
          borderColor: isDanger ? Palette.danger : Palette.border,
          borderRadius: Radius.control,
          borderWidth: isPrimary ? 0 : 1,
          justifyContent: 'center',
          minHeight: 46,
          opacity: disabled ? 0.4 : pressed ? 0.68 : 1,
          paddingHorizontal: Space.lg,
          paddingVertical: Space.md,
        },
        style,
      ]}>
      <AppText color={foreground} variant="bodyStrong">
        {label}
      </AppText>
    </Pressable>
  );
}
