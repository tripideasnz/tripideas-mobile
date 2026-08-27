import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Palette } from '@/constants/design';

type HeaderBackButtonProps = {
  color?: string;
  fallbackHref?: Href;
  onPress?: () => void;
};

type BackRouter = {
  back: () => void;
  canGoBack: () => boolean;
  replace: (href: Href) => void;
};

export function backOrFallback(router: BackRouter, fallbackHref?: Href) {
  if (router.canGoBack()) router.back();
  else if (fallbackHref) router.replace(fallbackHref);
}

export function HeaderBackButton({
  color = Palette.text,
  fallbackHref,
  onPress,
}: HeaderBackButtonProps = {}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress ?? (() => backOrFallback(router, fallbackHref))}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: Palette.surface,
        borderColor: Palette.border,
        borderRadius: 22,
        borderWidth: StyleSheet.hairlineWidth,
        height: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
        width: 44,
      })}>
      <Ionicons color={color} name="chevron-back" size={24} />
    </Pressable>
  );
}
