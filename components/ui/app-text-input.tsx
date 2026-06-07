import { TextInput, type TextInputProps } from 'react-native';

import { Palette, Radius, Space, Type } from '@/constants/design';

export function AppTextInput({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={Palette.textMuted}
      {...props}
      style={[
        Type.body,
        {
          backgroundColor: Palette.surface,
          borderColor: Palette.border,
          borderRadius: Radius.input,
          borderWidth: 1,
          color: Palette.text,
          minHeight: 48,
          paddingHorizontal: Space.lg,
          paddingVertical: Space.md,
        },
        style,
      ]}
    />
  );
}
