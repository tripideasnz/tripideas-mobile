import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { Palette, Radius, Space, Type } from '@/constants/design';

export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput({ style, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
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
);
