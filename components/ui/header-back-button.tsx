import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Palette } from '@/constants/design';

/** Outline of the JavaScript-rendered circular header controls (back, add, share). */
export const HEADER_CONTROL_BORDER_COLOR = '#c9c9c4';
export const HEADER_CONTROL_BORDER_WIDTH = 1;
export const HEADER_CHEVRON_SIZE = 26;

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
        borderColor: HEADER_CONTROL_BORDER_COLOR,
        borderRadius: 22,
        borderWidth: HEADER_CONTROL_BORDER_WIDTH,
        height: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
        width: 44,
      })}>
      <Ionicons color={color} name="chevron-back" size={HEADER_CHEVRON_SIZE} />
    </Pressable>
  );
}
