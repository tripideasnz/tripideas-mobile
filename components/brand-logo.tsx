import { Image } from 'expo-image';
import type { ImageStyle, StyleProp } from 'react-native';

import { BrandName } from '@/constants/design';

type BrandLogoProps = {
  kind?: 'icon' | 'logo';
  style?: StyleProp<ImageStyle>;
  tone?: 'dark' | 'light';
};

const brandAssets = {
  dark: {
    icon: require('@/assets/brand/icon-dark.png'),
    logo: require('@/assets/brand/logo-dark.png'),
  },
  light: {
    icon: require('@/assets/brand/icon-light.png'),
    logo: require('@/assets/brand/logo-light.png'),
  },
} as const;

export function BrandLogo({
  kind = 'logo',
  style,
  tone = 'dark',
}: BrandLogoProps) {
  return (
    <Image
      accessibilityLabel={`${BrandName} logo`}
      contentFit="contain"
      source={brandAssets[tone][kind]}
      style={[
        kind === 'icon'
          ? { aspectRatio: 1, height: 40 }
          : { aspectRatio: 977 / 305, height: 44 },
        style,
      ]}
    />
  );
}
