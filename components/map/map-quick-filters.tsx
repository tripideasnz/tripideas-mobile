import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScrollView } from 'react-native';

import { AppChip } from '@/components/ui/app-chip';
import { Space } from '@/constants/design';
type MapQuickFiltersProps = {
  isActivitiesSelected: boolean;
  isRegionsSelected: boolean;
  isSavedSelected: boolean;
  onActivitiesPress: () => void;
  onRegionsPress: () => void;
  onSavedPress: () => void;
};

export function MapQuickFilters({
  isActivitiesSelected,
  isRegionsSelected,
  isSavedSelected,
  onActivitiesPress,
  onRegionsPress,
  onSavedPress,
}: MapQuickFiltersProps) {
  return (
    <ScrollView
      contentContainerStyle={{ gap: Space.sm, paddingHorizontal: Space.md }}
      horizontal
      showsHorizontalScrollIndicator={false}>
      <FilterChip
        icon="map"
        isSelected={isRegionsSelected}
        label="Regions"
        onPress={onRegionsPress}
      />
      <FilterChip
        icon={isActivitiesSelected ? 'check-circle' : 'hiking'}
        isSelected={isActivitiesSelected}
        label="Activities"
        onPress={onActivitiesPress}
      />
      <FilterChip
        icon={isSavedSelected ? 'favorite' : 'favorite-border'}
        isSelected={isSavedSelected}
        label="Saved"
        onPress={onSavedPress}
      />
    </ScrollView>
  );
}

function FilterChip({
  icon,
  isSelected = false,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  isSelected?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <AppChip
      elevated
      icon={icon}
      label={label}
      onPress={onPress}
      selected={isSelected}
    />
  );
}
