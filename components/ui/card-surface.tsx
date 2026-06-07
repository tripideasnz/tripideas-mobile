import { View, type ViewProps } from 'react-native';

import { Palette, Radius, Shadow } from '@/constants/design';

export function CardSurface({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        Shadow.card,
        {
          backgroundColor: Palette.surface,
          borderColor: Palette.border,
          borderRadius: Radius.card,
          borderWidth: 1,
          overflow: 'hidden',
        },
        style,
      ]}
    />
  );
}
