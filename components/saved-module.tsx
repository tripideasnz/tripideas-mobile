import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Radius, Space } from '@/constants/design';

type SavedModuleProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  stateText: string;
  title: string;
};

export function SavedModule({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
  stateText,
  title,
}: SavedModuleProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? `Open ${title}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: Palette.surface,
        borderColor: Palette.border,
        borderRadius: Radius.card,
        borderWidth: 1,
        flexDirection: 'row',
        minHeight: 76,
        opacity: disabled ? 0.45 : pressed ? 0.6 : 1,
        paddingHorizontal: Space.lg,
        paddingVertical: Space.md,
      })}>
      <MaterialIcons color={Palette.text} name={icon} size={25} />
      <View style={{ flex: 1, gap: Space.xs, marginLeft: Space.lg }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText color={Palette.textMuted} variant="caption">
          {stateText}
        </AppText>
      </View>
      <MaterialIcons color={Palette.trip} name="chevron-right" size={26} />
    </Pressable>
  );
}
