import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Pressable } from 'react-native';
import type { GestureResponderEvent, ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/design';

type AddPlaceToTripButtonProps = {
  isSignedIn?: boolean;
  isPending?: boolean;
  disabled?: boolean;
  isCurrentTrip?: boolean;
  isInTrip: boolean;
  onPress: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
};

export function AddPlaceToTripButton({
  isInTrip,
  isPending = false,
  disabled = false,
  isCurrentTrip = false,
  isSignedIn = true,
  onPress,
  style,
}: AddPlaceToTripButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || isPending}
      accessibilityState={{ disabled: disabled || isPending, busy: isPending, selected: isInTrip }}
      accessibilityLabel={
        !isSignedIn
          ? 'Sign in to view and edit your private Trips'
          : isCurrentTrip
            ? isInTrip ? 'Remove from this Trip' : 'Add to this Trip'
            : isInTrip
            ? 'Add to another Trip'
            : 'Add to Trip'
      }
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.94)',
          borderRadius: Radius.pill,
          height: 44,
          justifyContent: 'center',
          opacity: pressed ? 0.72 : 1,
          width: 44,
        },
        style,
      ]}>
      {isPending ? <ActivityIndicator color={Palette.trip} /> : <MaterialIcons
        name={isInTrip ? 'folder' : 'folder-open'}
        size={25}
        color={isInTrip ? Palette.trip : Palette.text}
      />}
    </Pressable>
  );
}
