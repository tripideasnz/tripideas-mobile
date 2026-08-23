import { forwardRef, useState } from 'react';
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

export const AutoExpandingTextInput = forwardRef<TextInput, TextInputProps>(
  function AutoExpandingTextInput({ style, ...props }, ref) {
    const [height, setHeight] = useState(48);
    const maximumHeight = 184;
    return <AppTextInput
      {...props}
      multiline
      onContentSizeChange={(event) => {
        props.onContentSizeChange?.(event);
        // React Native's native content height already accounts for the
        // multiline input's inset. Adding padding here creates a feedback loop:
        // frame grows -> content size grows -> frame grows again.
        const measuredContentHeight = Math.ceil(event.nativeEvent.contentSize.height);
        const next = Math.min(maximumHeight, Math.max(48, measuredContentHeight));
        setHeight((current) => Math.abs(current - next) >= 2 ? next : current);
      }}
      ref={ref}
      scrollEnabled={height >= maximumHeight}
      submitBehavior="newline"
      // Use the measurement as a floor, not a fixed frame. This leaves the
      // native multiline control free to lay out wrapping text and maintain
      // its selection/caret while the surrounding Yoga layout catches up.
      style={[style, { maxHeight: maximumHeight, minHeight: height, textAlignVertical: 'top' }]}
    />;
  }
);
