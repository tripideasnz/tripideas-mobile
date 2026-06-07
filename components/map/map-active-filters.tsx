import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, Text } from 'react-native';

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
      contentContainerStyle={{ gap: 8, paddingHorizontal: 3 }}
      horizontal
      showsHorizontalScrollIndicator={false}>
      {filters.map((filter) => (
        <Pressable
          accessibilityLabel={`Remove ${filter.label} filter`}
          accessibilityRole="button"
          key={filter.id}
          onPress={() => onRemove(filter.id)}
          style={({ pressed }) => ({
            alignItems: 'center',
            backgroundColor: '#f0f0ee',
            borderColor: '#d8d8d5',
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 5,
            opacity: pressed ? 0.6 : 1,
            paddingHorizontal: 11,
            paddingVertical: 7,
          })}>
          <Text style={{ fontSize: 13, fontWeight: '700' }}>
            {filter.label}
          </Text>
          <MaterialIcons color="#4a4a4a" name="close" size={16} />
        </Pressable>
      ))}
    </ScrollView>
  );
}
