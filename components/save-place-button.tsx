import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable } from 'react-native';
import type { GestureResponderEvent, ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/design';
type SavePlaceButtonProps = {
  isSignedIn?: boolean;
  isSaved: boolean;
  onPress: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
};

export function SavePlaceButton({
  isSaved,
  isSignedIn = true,
  onPress,
  style,
}: SavePlaceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        !isSignedIn
          ? 'Sign in to save Favourites'
          : isSaved
            ? 'Remove from favourites'
            : 'Add to favourites'
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
        name={isSaved ? 'favorite' : 'favorite-border'}
        size={25}
        color={isSaved ? Palette.favourite : Palette.text}
      />
    </Pressable>
  );
}
