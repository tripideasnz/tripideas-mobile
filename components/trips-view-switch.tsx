// The two views of the Trips feature: owned Trips, and live Trips shared with the user.
import { View } from 'react-native';

import { SegmentedControl } from '@/components/ui/segmented-control';
import { Space } from '@/constants/design';
import type { TripsView } from '@/shared-trips/view-model';

const OPTIONS = [
  { label: 'My Trips', value: 'mine' },
  { label: 'Shared With Me', value: 'shared' },
] as const;

export function TripsViewSwitch({ onChange, value }: { onChange: (view: TripsView) => void; value: TripsView }) {
  return (
    <View style={{ marginBottom: Space.lg }}>
      <SegmentedControl accessibilityLabel="Trips view" onChange={onChange} options={OPTIONS} value={value} />
    </View>
  );
}
