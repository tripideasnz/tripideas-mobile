import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Palette } from '@/constants/design';

type HeaderBackButtonProps = {
  onPress?: () => void;
};

export function HeaderBackButton({ onPress }: HeaderBackButtonProps = {}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: Palette.surface,
        borderColor: Palette.border,
        borderRadius: 22,
        borderWidth: 0.5,
        height: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
        width: 44,
      })}>
      <Ionicons color={Palette.text} name="chevron-back" size={24} />
    </Pressable>
  );
}
