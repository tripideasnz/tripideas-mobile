import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Space } from '@/constants/design';

export function ShowMoreText({
  accessibilityLabel,
  expandedContent,
  forceExpandable = false,
  value,
}: {
  accessibilityLabel: string;
  expandedContent?: ReactNode;
  forceExpandable?: boolean;
  value: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const canExpand = forceExpandable || overflows;

  return (
    <View style={{ gap: Space.sm }}>
      {expanded && expandedContent ? expandedContent : (
        <AppText
          color={Palette.textBody}
          numberOfLines={expanded ? undefined : 3}>
          {value}
        </AppText>
      )}
      <View pointerEvents="none" style={{ left: 0, opacity: 0, position: 'absolute', right: 0 }}>
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(event) => setOverflows(event.nativeEvent.lines.length > 3)}>
          {value}
        </AppText>
      </View>
      {canExpand || expanded ? (
        <Pressable
          accessibilityLabel={expanded ? `Show less of ${accessibilityLabel}` : `Show more of ${accessibilityLabel}`}
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            setExpanded((current) => !current);
          }}
          style={{ alignSelf: 'flex-end' }}>
          <AppText color={Palette.textMuted} style={{ fontStyle: 'italic' }} variant="caption">
            {expanded ? '... show less' : '... show more'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
