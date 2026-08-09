import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette, Radius, Space } from '@/constants/design';

export function ExpandableText({
  accessibilityLabel,
  disabled = false,
  onPress,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  placeholder: string;
  value: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  return (
    <View style={{
      borderColor: Palette.border,
      borderRadius: Radius.control,
      borderWidth: 1,
      gap: Space.sm,
      padding: Space.md,
    }}>
      <Pressable
        accessibilityHint="Enters text editing mode."
        accessibilityLabel={value ? `Edit ${accessibilityLabel}` : `Add ${accessibilityLabel}`}
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}>
        <AppText
          color={value ? Palette.textBody : Palette.textMuted}
          numberOfLines={expanded ? undefined : 3}>
          {value || placeholder}
        </AppText>
      </Pressable>
      {value ? (
        <View pointerEvents="none" style={{ left: 0, opacity: 0, position: 'absolute', right: 0 }}>
          <AppText
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onTextLayout={(event) => setOverflows(event.nativeEvent.lines.length > 3)}>
            {value}
          </AppText>
        </View>
      ) : null}
      {overflows || expanded ? (
        <Pressable
          accessibilityLabel={expanded ? `Show less of ${accessibilityLabel}` : `Show more of ${accessibilityLabel}`}
          accessibilityRole="button"
          onPress={() => setExpanded((current) => !current)}
          style={{ alignSelf: 'flex-end' }}>
          <AppText color={Palette.textMuted} style={{ fontStyle: 'italic' }} variant="caption">
            {expanded ? '... show less' : '... show more'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
