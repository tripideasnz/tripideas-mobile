// A compact two-or-more segment switch for choosing one view of the same screen (for example
// My Trips / Shared With Me). One muted track, equal-width segments, the selected one filled with the
// app's primary colour, no borders or shadows. Each segment keeps a 44-point touch target through hitSlop.
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Radius, Space } from '@/constants/design';

const SEGMENT_HEIGHT = 32;

export type SegmentedOption<T extends string> = { label: string; value: T };

export function SegmentedControl<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: {
  accessibilityLabel?: string;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  value: T;
}) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={{
        backgroundColor: Palette.surfaceMuted,
        borderRadius: Radius.control,
        flexDirection: 'row',
        padding: Space.xs,
      }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ bottom: 6, top: 6 }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: selected ? Palette.primary : 'transparent',
              borderRadius: Radius.small,
              flex: 1,
              height: SEGMENT_HEIGHT,
              justifyContent: 'center',
              opacity: pressed && !selected ? 0.6 : 1,
            })}>
            <AppText color={selected ? Palette.textOnPrimary : Palette.textBody} variant="label">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
