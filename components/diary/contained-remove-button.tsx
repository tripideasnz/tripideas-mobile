import { Pressable, Text } from 'react-native';

import { Palette, Radius } from '@/constants/design';

export function ContainedRemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" hitSlop={6} onPress={onPress}
    style={({ pressed }) => ({ alignItems: 'center', backgroundColor: Palette.surface, borderColor: Palette.trip, borderRadius: Radius.pill, borderWidth: 1, height: 36, justifyContent: 'center', opacity: pressed ? 0.65 : 1, width: 36 })}>
    <Text style={{ color: Palette.trip, fontSize: 24, lineHeight: 26 }}>×</Text>
  </Pressable>;
}
