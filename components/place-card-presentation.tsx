import type { ReactNode } from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { CardSurface } from '@/components/ui/card-surface';
import { Space, Type } from '@/constants/design';

export function PlaceCardPresentation({
  children,
  media,
  overlayActions,
  style,
  title,
  titleTrailing,
}: {
  children?: ReactNode;
  media?: ReactNode;
  overlayActions?: ReactNode;
  style?: ViewProps['style'];
  title: ReactNode;
  titleTrailing?: ReactNode;
}) {
  return (
    <CardSurface style={style}>
      {media}
      {overlayActions}
      <View style={{ padding: Space.lg }}>
        <View style={{ alignItems: 'baseline', flexDirection: 'row' }}>
          <Text numberOfLines={2} style={{ flex: 1, ...Type.cardTitle }}>
            {title}
          </Text>
          {titleTrailing}
        </View>
        {children}
      </View>
    </CardSurface>
  );
}
