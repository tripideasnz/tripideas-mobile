import { ScrollView } from 'react-native';

import { AppChip } from '@/components/ui/app-chip';
import { Space } from '@/constants/design';
export type MapActiveFilter = {
  id: string;
  label: string;
};

type MapActiveFiltersProps = {
  filters: MapActiveFilter[];
  onRemove: (filterId: string) => void;
};

export function MapActiveFilters({
  filters,
  onRemove,
}: MapActiveFiltersProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <ScrollView
      contentContainerStyle={{ gap: Space.sm, paddingHorizontal: Space.xs }}
      horizontal
      showsHorizontalScrollIndicator={false}>
      {filters.map((filter) => (
        <AppChip
          accessibilityLabel={`Remove ${filter.label} filter`}
          icon="close"
          key={filter.id}
          label={filter.label}
          onPress={() => onRemove(filter.id)}
        />
      ))}
    </ScrollView>
  );
}
