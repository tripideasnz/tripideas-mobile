// Two or more buttons that share a row: side by side in equal slots, equal widths and heights, at every text size.
// Labels that need more room shrink (see AppButton fitLabel) instead of the row changing shape.
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';

import { Space } from '@/constants/design';

export function ButtonRow({ children }: { children: ReactNode }) {
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
