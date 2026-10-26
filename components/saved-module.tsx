import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Radius, Space } from '@/constants/design';

type SavedModuleProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  description?: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  stateText: string;
  title: string;
};

export function SavedModule({
  accessibilityLabel,
  disabled = false,
  description,
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
      {/* The text column takes the remaining width and wraps naturally. */}
      <View style={{ flex: 1, gap: Space.xs, marginLeft: Space.lg, minWidth: 0 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {description ? (
          <AppText color={Palette.textBody} style={{ fontSize: 15, lineHeight: 21 }} variant="body">
            {description}
          </AppText>
        ) : null}
        <AppText color={Palette.textMuted} variant="caption">
          {stateText}
        </AppText>
      </View>
      {/* Dedicated chevron area: never overlapped by text, 16 pt clear of it. */}
      <View style={{ alignItems: 'center', justifyContent: 'center', marginLeft: Space.lg, width: 28 }}>
        <MaterialIcons color={Palette.trip} name="chevron-right" size={30} />
      </View>
    </Pressable>
  );
}
