import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { Palette, Space } from '@/constants/design';

const actions = [
  ['Narrative', 'notes'], ['Photo', 'photo-library'], ['Link', 'link'],
  ['Place', 'place'], ['Pin', 'add-location-alt'],
] as const;
export type DiaryObjectAction = typeof actions[number][0];
export function DiaryObjectToolbar({ onSelect }: { onSelect: (action: DiaryObjectAction) => void }) {
  return <View accessibilityLabel="Add Diary object" style={{ borderBottomColor: Palette.border, borderBottomWidth: 1, borderTopColor: Palette.border, borderTopWidth: 1, gap: Space.xs, paddingVertical: Space.sm }}>
    <AppText color={Palette.textMuted} variant="label">ADD CONTENT</AppText>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{actions.map(([label, icon]) => <Pressable key={label} accessibilityLabel={`Add ${label}`} accessibilityRole="button" onPress={() => onSelect(label)}
      style={({ pressed }) => ({ alignItems: 'center', gap: 2, minHeight: 44, minWidth: 48, opacity: pressed ? 0.55 : 1 })}>
      <MaterialIcons color={Palette.trip} name={icon} size={21} /><AppText color={Palette.textMuted} variant="caption">{label}</AppText>
    </Pressable>)}</View>
  </View>;
}
