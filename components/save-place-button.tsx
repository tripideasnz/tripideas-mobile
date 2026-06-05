import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable } from 'react-native';
import type { GestureResponderEvent, ViewStyle } from 'react-native';

type SavePlaceButtonProps = {
  isSaved: boolean;
  onPress: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
};

export function SavePlaceButton({
  isSaved,
  onPress,
  style,
}: SavePlaceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Remove from saved places' : 'Save place'}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        {
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.94)',
          borderRadius: 999,
          height: 44,
          justifyContent: 'center',
          opacity: pressed ? 0.72 : 1,
          width: 44,
        },
        style,
      ]}>
      <MaterialIcons
        name={isSaved ? 'favorite' : 'favorite-border'}
        size={25}
        color={isSaved ? '#e31b23' : '#111'}
      />
    </Pressable>
  );
}
