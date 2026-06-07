import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable } from 'react-native';
import type { GestureResponderEvent, ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/design';

type AddPlaceToTripButtonProps = {
  isInTrip: boolean;
  onPress: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
};

export function AddPlaceToTripButton({
  isInTrip,
  onPress,
  style,
}: AddPlaceToTripButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isInTrip ? 'Add to another trip' : 'Add to trip'
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
      <MaterialIcons
        name={isInTrip ? 'folder' : 'folder-open'}
        size={25}
        color={isInTrip ? Palette.trip : Palette.text}
      />
    </Pressable>
  );
}
