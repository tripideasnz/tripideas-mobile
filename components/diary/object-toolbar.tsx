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
  return <View accessibilityLabel="Add Diary object" style={{ borderTopColor: Palette.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', paddingTop: Space.sm }}>
    {actions.map(([label, icon]) => <Pressable key={label} accessibilityLabel={`Add ${label}`} accessibilityRole="button" onPress={() => onSelect(label)}
      style={({ pressed }) => ({ alignItems: 'center', gap: 2, minHeight: 44, minWidth: 48, opacity: pressed ? 0.55 : 1 })}>
      <MaterialIcons color={Palette.textMuted} name={icon} size={21} /><AppText color={Palette.textMuted} variant="caption">{label}</AppText>
    </Pressable>)}
  </View>;
}
