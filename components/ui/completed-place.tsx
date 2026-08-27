import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { SavedObjectIcons } from '@/components/ui/saved-object-icons';
import { Palette, Space } from '@/constants/design';

export function CompletedPlace({ available = true, icon = SavedObjectIcons.tripIdeasPlace, onPress, title }: { available?: boolean; icon?: ComponentProps<typeof MaterialIcons>['name']; onPress?: () => void; title: string }) {
  const content = <><MaterialIcons color={available ? Palette.trip : Palette.textMuted} name={icon} size={20} /><View style={{ flex: 1 }}><AppText color={available ? Palette.trip : Palette.textMuted} variant="bodyStrong">{title}</AppText>{!available ? <AppText color={Palette.textMuted}>This Place is unavailable. Its last-known title is retained.</AppText> : null}</View></>;
  return available && onPress ? <Pressable accessibilityLabel={`Open ${title}`} accessibilityRole="link" onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', flexDirection: 'row', gap: Space.sm, opacity: pressed ? 0.55 : 1 })}>{content}</Pressable> : <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}>{content}</View>;
}
