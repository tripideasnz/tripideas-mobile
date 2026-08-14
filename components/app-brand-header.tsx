import { Pressable, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { AppText } from '@/components/ui/app-text';
import { Space } from '@/constants/design';

export function AppBrandHeader({
  compact = false,
  onLogoPress,
  subtitle,
}: {
  compact?: boolean;
  onLogoPress?: () => void;
  subtitle?: string;
}) {
  return (
    <View style={{ marginBottom: compact ? Space.md : Space.xl }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
        <Pressable
          accessibilityLabel={onLogoPress ? 'Open TripIdeas cover page' : undefined}
          accessibilityRole={onLogoPress ? 'button' : undefined}
          disabled={!onLogoPress}
          hitSlop={8}
          onPress={onLogoPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <BrandLogo style={{ height: compact ? 36 : 44 }} />
        </Pressable>
      </View>
      {subtitle ? (
        <AppText
          color="#4a4a4a"
          style={{ marginTop: Space.sm }}
          variant={compact ? 'body' : 'body'}>
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
