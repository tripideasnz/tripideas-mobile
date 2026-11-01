// Shared header for Saved screens that have a top-right action.
//
// On iOS 26 the native header wraps every right-hand custom view in a system
// capsule that UIKit sizes itself (react-native-screens 4.16 cannot constrain
// it), so a fixed-size React button ended up inside a wide pill. This header is
// plain React Native views instead: every control sits in a fixed, non-flexing
// 44 pt slot, so nothing can expand, and title/back positions stay predictable.
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { NativeStackHeaderProps, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HEADER_CONTROL_BORDER_COLOR, HEADER_CONTROL_BORDER_WIDTH, HeaderBackButton } from '@/components/ui/header-back-button';
import { CONTROL_MAX_FONT_SCALE, Palette } from '@/constants/design';

export const SAVED_HEADER_CONTROL_SIZE = 44;
export const SAVED_HEADER_GUTTER = 16;

/** Fixed, non-flexing frame shared by the back control, the action and the empty slot. */
export const savedHeaderSlotStyle = {
  alignItems: 'center',
  flexGrow: 0,
  flexShrink: 0,
  height: SAVED_HEADER_CONTROL_SIZE,
  justifyContent: 'center',
  overflow: 'visible',
  width: SAVED_HEADER_CONTROL_SIZE,
} as const;

export type SavedHeaderAction = { accessibilityLabel: string; disabled?: boolean; onPress: () => void };

/** A circular 44 pt action with a centred icon. It never grows with its content. */
export function SavedHeaderActionButton({ action, icon }: { action: SavedHeaderAction; icon: 'add' | 'share' }) {
  return (
    <Pressable
      accessibilityLabel={action.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      hitSlop={10}
      onPress={action.onPress}
      style={({ pressed }) => ({
        ...savedHeaderSlotStyle,
        backgroundColor: Palette.surface,
        borderColor: HEADER_CONTROL_BORDER_COLOR,
        borderRadius: SAVED_HEADER_CONTROL_SIZE / 2,
        borderWidth: HEADER_CONTROL_BORDER_WIDTH,
        opacity: action.disabled ? 0.35 : pressed ? 0.55 : 1,
      })}>
      <MaterialIcons color={Palette.trip} name={icon} size={icon === 'add' ? 26 : 22} />
    </Pressable>
  );
}

export function SavedActionHeader({ options, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : '';
  const canGoBack = Boolean(back);
  const left = options.headerLeft?.({ canGoBack, tintColor: Palette.trip }) ?? (canGoBack ? <HeaderBackButton color={Palette.trip} /> : null);
  const right = options.headerRight?.({ canGoBack, tintColor: Palette.trip }) ?? null;
  return (
    <View
      style={{
        backgroundColor: Palette.background,
        paddingTop: insets.top,
      }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          height: SAVED_HEADER_CONTROL_SIZE + 12,
          justifyContent: 'space-between',
          paddingHorizontal: SAVED_HEADER_GUTTER,
        }}>
        <View style={savedHeaderSlotStyle}>{left}</View>
        {/* Out of the row flow, so the slots on either side can never be squeezed or stretched. */}
        <View
          pointerEvents="none"
          style={{
            alignItems: 'center',
            bottom: 0,
            justifyContent: 'center',
            left: SAVED_HEADER_GUTTER + SAVED_HEADER_CONTROL_SIZE + 8,
            position: 'absolute',
            right: SAVED_HEADER_GUTTER + SAVED_HEADER_CONTROL_SIZE + 8,
            top: 0,
          }}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={CONTROL_MAX_FONT_SCALE} numberOfLines={1} style={{ color: Palette.text, fontSize: 17, fontWeight: '600' }}>
            {title}
          </Text>
        </View>
        <View style={{ ...savedHeaderSlotStyle, overflow: 'hidden' }}>{right}</View>
      </View>
    </View>
  );
}

/** Options that switch a Saved screen to the shared fixed-layout header. */
export const savedActionHeader: NativeStackNavigationOptions = {
  header: (props) => <SavedActionHeader {...props} />,
};
