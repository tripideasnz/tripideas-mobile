import { Text, type TextProps } from 'react-native';

import { Palette, Type } from '@/constants/design';

type AppTextVariant = keyof typeof Type;

type AppTextProps = TextProps & {
  color?: string;
  variant?: AppTextVariant;
};

export function AppText({
  color = Palette.text,
  style,
  variant = 'body',
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[Type[variant], { color }, style]}
    />
  );
}
