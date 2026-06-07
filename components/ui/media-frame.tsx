import { Image, type ImageProps } from 'expo-image';
import { View, type ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/design';

type MediaFrameProps = ImageProps & {
  aspectRatio?: number;
  radius?: number;
  style?: ViewStyle;
};

export function MediaFrame({
  aspectRatio = 4 / 3,
  radius = Radius.card,
  style,
  ...props
}: MediaFrameProps) {
  const hasExplicitHeight =
    Boolean(style) &&
    !Array.isArray(style) &&
    typeof style === 'object' &&
    'height' in style;

  return (
    <View
      style={[
        {
          aspectRatio: hasExplicitHeight ? undefined : aspectRatio,
          backgroundColor: Palette.surfaceMuted,
          borderRadius: radius,
          overflow: 'hidden',
          width: '100%',
        },
        style,
      ]}>
      <Image
        contentFit="cover"
        {...props}
        style={{
          bottom: 0,
          height: undefined,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
          width: undefined,
        }}
      />
    </View>
  );
}
