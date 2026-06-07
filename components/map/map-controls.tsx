import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, View } from 'react-native';

type MapControlsProps = {
  onLayersPress: () => void;
  onRecenterPress: () => void;
};

export function MapControls({
  onLayersPress,
  onRecenterPress,
}: MapControlsProps) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: '#dedede',
        borderRadius: 14,
        borderWidth: 1,
        elevation: 3,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 5,
      }}>
      <ControlButton
        accessibilityLabel="Map layers"
        icon="layers"
        onPress={onLayersPress}
      />
      <View style={{ backgroundColor: '#e2e2e2', height: 1 }} />
      <ControlButton
        accessibilityLabel="Recenter map"
        icon="my-location"
        onPress={onRecenterPress}
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
      <MaterialIcons color="#111" name={icon} size={23} />
    </Pressable>
  );
}
