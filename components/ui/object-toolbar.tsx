import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Space } from '@/constants/design';

export type ObjectToolbarAction<TName extends string = string> = {
  name: TName;
  icon: ComponentProps<typeof MaterialIcons>['name'];
};

export function ObjectToolbar<TName extends string>({ accessibilityLabel, actions, disabled = false, onSelect }: {
  accessibilityLabel: string;
  actions: readonly ObjectToolbarAction<TName>[];
  disabled?: boolean;
  onSelect: (action: TName) => void;
}) {
  return <View accessibilityLabel={accessibilityLabel} style={{ borderBottomColor: Palette.border, borderBottomWidth: 1, borderTopColor: Palette.border, borderTopWidth: 1, gap: Space.xs, paddingVertical: Space.sm }}>
    <AppText color={Palette.textMuted} variant="label">ADD CONTENT</AppText>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {actions.map(({ name, icon }) => <Pressable key={name} accessibilityLabel={`Add ${name}`} accessibilityRole="button"
        accessibilityState={{ disabled }} disabled={disabled} onPress={() => onSelect(name)}
        style={({ pressed }) => ({ alignItems: 'center', gap: 2, minHeight: 44, minWidth: 48, opacity: disabled ? 0.35 : pressed ? 0.55 : 1 })}>
        <MaterialIcons color={Palette.trip} name={icon} size={21} />
        <AppText color={Palette.textMuted} variant="caption">{name}</AppText>
      </Pressable>)}
    </View>
  </View>;
}
