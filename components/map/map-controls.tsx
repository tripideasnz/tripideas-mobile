import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, View } from 'react-native';

import { Palette, Radius, Shadow } from '@/constants/design';
type MapControlsProps = {
  onLayersPress: () => void;
  onRecenterPress: () => void;
};

export function MapControls({
  onLayersPress,
  onRecenterPress,
}: MapControlsProps) {
  const sep = <View style={{ backgroundColor: Palette.border, height: 1 }} />;
  return (
    <View
      style={{
        ...Shadow.floating,
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: Palette.border,
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
      }}>
      <ControlButton
        accessibilityLabel="Map layers"
        icon="layers"
        onPress={onLayersPress}
      />
      {sep}
      <ControlButton
        accessibilityLabel="Recenter map"
        icon="my-location"
        onPress={onRecenterPress}
      />
    </View>
  );
}

type MapZoomControlsProps = {
  onZoomInPress: () => void;
  onZoomOutPress: () => void;
};

export function MapZoomControls({
  onZoomInPress,
  onZoomOutPress,
}: MapZoomControlsProps) {
  const sep = <View style={{ backgroundColor: Palette.border, height: 1 }} />;
  return (
    <View
      style={{
        ...Shadow.floating,
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: Palette.border,
        borderRadius: Radius.card,
        borderWidth: 1,
        overflow: 'hidden',
      }}>
      <ControlButton
        accessibilityLabel="Zoom in"
        icon="add"
        onPress={onZoomInPress}
      />
      {sep}
      <ControlButton
        accessibilityLabel="Zoom out"
        icon="remove"
        onPress={onZoomOutPress}
      />
    </View>
  );
}

function ControlButton({
  accessibilityLabel,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        height: 48,
        justifyContent: 'center',
        opacity: pressed ? 0.55 : 1,
        width: 48,
      })}>
      <MaterialIcons color={Palette.text} name={icon} size={23} />
    </Pressable>
  );
}
