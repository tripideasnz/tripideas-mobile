// The two views of the Trips feature: owned Trips, and live Trips shared with the user.
import { View } from 'react-native';

import { AppChip } from '@/components/ui/app-chip';
import { Space } from '@/constants/design';
import type { TripsView } from '@/shared-trips/view-model';

export function TripsViewSwitch({ onChange, value }: { onChange: (view: TripsView) => void; value: TripsView }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: Space.sm, marginBottom: Space.lg }}>
      <AppChip
        accessibilityLabel="My Trips"
        label="My Trips"
        onPress={() => onChange('mine')}
        selected={value === 'mine'}
      />
      <AppChip
        accessibilityLabel="Shared With Me"
        label="Shared With Me"
        onPress={() => onChange('shared')}
        selected={value === 'shared'}
      />
    </View>
  );
}
