import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
      hitSlop={8}
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => ({
        alignItems: 'center',
        height: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
        width: 44,
      })}>
      <MaterialIcons
        color={Palette.text}
        name="arrow-back-ios-new"
        size={22}
        style={{ transform: [{ translateX: 2 }] }}
      />
    </Pressable>
  );
}
