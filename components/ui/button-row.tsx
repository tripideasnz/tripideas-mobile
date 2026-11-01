// Two or more buttons that share a row. At normal text sizes they sit side by side with equal widths and heights; at
// larger system text sizes they stack, each button taking the full width, so no label is squeezed or broken.
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';

import { Palette, Space } from '@/constants/design';
import { useStackedRows } from '@/hooks/use-stacked-rows';

export function ButtonRow({ children }: { children: ReactNode }) {
  const stacked = useStackedRows();
  if (stacked) {
    // Outlined buttons carry a 1 pt border that a filled one does not, so give the filled ones a border of their own
    // colour: stacked buttons are then exactly the same height.
    return (
      <View style={{ gap: Space.sm }}>
        {Children.toArray(children).map((child, index) =>
          isValidElement(child) && ((child.props as { variant?: string }).variant ?? 'primary') === 'primary'
            ? cloneElement(child as ReactElement<{ style?: unknown }>, { key: index, style: [(child.props as { style?: unknown }).style, { borderColor: Palette.primary, borderWidth: 1 }] })
            : child)}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: Space.sm }}>
      {Children.toArray(children).map((child, index) => (
        // Equal slots (no padding or border of their own), and each button fills its slot's height.
        <View key={index} style={{ flex: 1 }}>
          {isValidElement(child)
            ? cloneElement(child as ReactElement<{ style?: unknown }>, { style: [(child.props as { style?: unknown }).style, { flexGrow: 1 }] })
            : child}
        </View>
      ))}
    </View>
  );
}
