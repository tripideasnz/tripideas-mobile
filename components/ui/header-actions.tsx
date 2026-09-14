import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';

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

// Use the existing React header control on every platform. Native toolbar items
// depend on the installed iOS binary and can leave beta builds without actions.
export function headerAddAction(action: HeaderAction): NativeStackNavigationOptions {
  return { headerRight: fallback('add', action) };
}

export function headerShareAction(action: HeaderAction): NativeStackNavigationOptions {
  return { headerRight: fallback('share', action) };
}

export function clearHeaderRightAction(): NativeStackNavigationOptions {
  return { headerRight: () => null };
}
