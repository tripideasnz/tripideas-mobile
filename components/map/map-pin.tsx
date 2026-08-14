import { View } from 'react-native';

export const MapPinColors = {
  default: '#0080C8',
  focused: '#E74C3C',
  selected: '#005FA3',
} as const;

export function MapPin({ emphasis = 'default' }: {
  emphasis?: keyof typeof MapPinColors;
}) {
  const size = emphasis === 'focused' ? 22 : emphasis === 'selected' ? 20 : 16;
  return (
    <View style={{
      backgroundColor: MapPinColors[emphasis],
      borderColor: '#fff',
      borderRadius: size / 2,
      borderWidth: emphasis === 'default' ? 2 : 3,
      height: size,
      width: size,
    }} />
  );
}
