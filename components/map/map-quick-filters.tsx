import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, Text } from 'react-native';

type MapQuickFiltersProps = {
  isRegionsSelected: boolean;
  isSavedSelected: boolean;
  onActivitiesPress: () => void;
  onRegionsPress: () => void;
  onSavedPress: () => void;
};

export function MapQuickFilters({
  isRegionsSelected,
  isSavedSelected,
  onActivitiesPress,
  onRegionsPress,
  onSavedPress,
}: MapQuickFiltersProps) {
  return (
    <ScrollView
      contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
      horizontal
      showsHorizontalScrollIndicator={false}>
      <FilterChip
        icon="map"
        isSelected={isRegionsSelected}
        label="Regions"
        onPress={onRegionsPress}
      />
      <FilterChip
        icon="hiking"
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: isSelected ? '#111' : 'rgba(255,255,255,0.96)',
        borderColor: isSelected ? '#111' : '#dedede',
        borderRadius: 999,
        borderWidth: 1,
        elevation: 3,
        flexDirection: 'row',
        gap: 6,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 13,
        paddingVertical: 9,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 5,
      })}>
      <MaterialIcons
        color={isSelected ? '#fff' : '#111'}
        name={icon}
        size={17}
      />
      <Text
        style={{
          color: isSelected ? '#fff' : '#111',
          fontSize: 14,
          fontWeight: '700',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
