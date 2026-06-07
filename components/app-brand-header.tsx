import { View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { AppText } from '@/components/ui/app-text';
import { Space } from '@/constants/design';

export function AppBrandHeader({
  compact = false,
  subtitle,
}: {
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <View style={{ marginBottom: compact ? Space.md : Space.xl }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
        <BrandLogo style={{ height: compact ? 36 : 44 }} />
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
