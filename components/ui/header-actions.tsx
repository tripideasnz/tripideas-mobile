import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Platform, Pressable } from 'react-native';

import { Palette } from '@/constants/design';

type HeaderAction = { accessibilityLabel: string; disabled?: boolean; onPress: () => void };

function HeaderActionFallback({
  action,
  icon,
}: {
  action: HeaderAction;
  icon: 'add' | 'share';
}) {
  return (
    <Pressable
      accessibilityLabel={action.accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: action.disabled }}
      disabled={action.disabled}
      hitSlop={12}
      onPress={action.onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        height: 44,
        justifyContent: 'center',
        opacity: action.disabled ? 0.35 : pressed ? 0.55 : 1,
        width: 44,
      })}>
      <MaterialIcons
        color={Palette.trip}
        name={icon}
        size={icon === 'add' ? 30 : 24}
      />
    </Pressable>
  );
}

function fallback(icon: 'add' | 'share', action: HeaderAction) {
  return function HeaderRightAction() {
    return <HeaderActionFallback action={action} icon={icon} />;
  };
}

function nativeItem(icon: 'plus' | 'square.and.arrow.up', action: HeaderAction): NativeStackNavigationOptions {
  return {
    unstable_headerRightItems: () => [{
      accessibilityLabel: action.accessibilityLabel,
      disabled: action.disabled,
      hidesSharedBackground: true,
      icon: { type: 'sfSymbol', name: icon },
      label: action.accessibilityLabel,
      onPress: action.onPress,
      tintColor: Palette.trip,
      type: 'button',
      variant: 'plain',
    }],
  };
}

export function headerAddAction(action: HeaderAction): NativeStackNavigationOptions {
  return Platform.OS === 'ios' ? nativeItem('plus', action) : { headerRight: fallback('add', action) };
}

export function headerShareAction(action: HeaderAction): NativeStackNavigationOptions {
  return Platform.OS === 'ios' ? nativeItem('square.and.arrow.up', action) : { headerRight: fallback('share', action) };
}

export function clearHeaderRightAction(): NativeStackNavigationOptions {
  return Platform.OS === 'ios'
    ? { unstable_headerRightItems: () => [] }
    : { headerRight: () => null };
}
