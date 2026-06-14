import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MapContentSelection } from '@/components/map/map-selection';
import type {
  MapNavigationIsland,
  MapNavigationRegion,
  MapNavigationSubRegion,
} from '@/sanity/types';

type MapRegionsSheetProps = {
  isLoading: boolean;
  navigation: {
    north?: MapNavigationIsland;
    south?: MapNavigationIsland;
  };
  onClose: () => void;
  onSelect: (selection: MapContentSelection) => void;
  selection: MapContentSelection;
  visible: boolean;
};

export function MapRegionsSheet({
  isLoading,
  navigation,
  onClose,
  onSelect,
  selection,
  visible,
}: MapRegionsSheetProps) {
  const [expandedRegionIds, setExpandedRegionIds] = useState<string[]>([]);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}>
      <SafeAreaView style={{ backgroundColor: '#fff', flex: 1 }}>
        <SheetHeader onApply={onClose} onDismiss={onClose} title="Regions" />
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 18 }}>
          {isLoading ? (
            <Text style={{ color: '#717171', fontSize: 15, paddingTop: 24 }}>
              Loading regions...
            </Text>
          ) : (
            <>
              <IslandSection
                expandedRegionIds={expandedRegionIds}
                island={navigation.north}
                onSelect={onSelect}
                onToggleRegion={(regionId) =>
                  setExpandedRegionIds((current) =>
                    current.includes(regionId)
                      ? current.filter((id) => id !== regionId)
                      : [...current, regionId]
                  )
                }
                selection={selection}
              />
              <IslandSection
                expandedRegionIds={expandedRegionIds}
                island={navigation.south}
                onSelect={onSelect}
                onToggleRegion={(regionId) =>
                  setExpandedRegionIds((current) =>
                    current.includes(regionId)
                      ? current.filter((id) => id !== regionId)
                      : [...current, regionId]
                  )
                }
                selection={selection}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function IslandSection({
  expandedRegionIds,
  island,
  onSelect,
  onToggleRegion,
  selection,
}: {
  expandedRegionIds: string[];
  island?: MapNavigationIsland;
  onSelect: (selection: MapContentSelection) => void;
  onToggleRegion: (regionId: string) => void;
  selection: MapContentSelection;
}) {
  const regions = (island?.regions ?? []).filter(Boolean);

  return (
    <View style={{ paddingTop: 24 }}>
      {island?.title ? (
        <Text style={{ fontSize: 23, fontWeight: '800', marginBottom: 8 }}>
          {island.title}
        </Text>
      ) : null}
      {regions.length > 0 ? (
        regions.map((region, index) => (
          <RegionRow
            expandedRegionIds={expandedRegionIds}
            key={region._id ?? region.slug?.current ?? index}
            onSelect={onSelect}
            onToggleRegion={onToggleRegion}
            region={region}
            selection={selection}
          />
        ))
      ) : (
        <Text style={{ color: '#717171', fontSize: 15 }}>
          No regions found.
        </Text>
      )}
    </View>
  );
}

function RegionRow({
  expandedRegionIds,
  onSelect,
  onToggleRegion,
  region,
  selection,
}: {
  expandedRegionIds: string[];
  onSelect: (selection: MapContentSelection) => void;
  onToggleRegion: (regionId: string) => void;
  region: MapNavigationRegion;
  selection: MapContentSelection;
}) {
  const regionId = region._id;
  const isExpanded = Boolean(
    regionId && expandedRegionIds.includes(regionId)
  );
  const subRegions = (region.subRegions ?? []).filter(Boolean);

  return (
    <View style={{ borderBottomColor: '#e7e7e7', borderBottomWidth: 1 }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          minHeight: 58,
        }}>
        <SelectionRow
          isSelected={
            selection.type === 'region' && selection.regionId === regionId
          }
          label={region.name ?? ''}
          onPress={() => {
            if (!regionId || !region.name) {
              return;
            }

            onSelect({
              label: region.name,
              regionId,
              type: 'region',
            });
          }}
          subtitle={region.maori}
        />
        {subRegions.length > 0 ? (
          <Pressable
            accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} sub-regions`}
            accessibilityRole="button"
            onPress={() => {
              if (regionId) {
                onToggleRegion(regionId);
              }
            }}
            style={({ pressed }) => ({
              alignItems: 'center',
              height: 48,
              justifyContent: 'center',
              opacity: pressed ? 0.55 : 1,
              width: 44,
            })}>
            <MaterialIcons
              color="#4a4a4a"
              name={
                isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'
              }
              size={24}
            />
          </Pressable>
        ) : null}
      </View>

      {isExpanded ? (
        <View
          style={{
            backgroundColor: '#f7f7f7',
            marginBottom: 10,
            paddingHorizontal: 12,
          }}>
          {subRegions.map((subRegion, index) => (
            <SubRegionRow
              key={subRegion._id ?? subRegion.slug?.current ?? index}
              onSelect={onSelect}
              selection={selection}
              subRegion={subRegion}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SubRegionRow({
  onSelect,
  selection,
  subRegion,
}: {
  onSelect: (selection: MapContentSelection) => void;
  selection: MapContentSelection;
  subRegion: MapNavigationSubRegion;
}) {
  const subRegionId = subRegion._id;

  return (
    <SelectionRow
      isSelected={
        selection.type === 'subregion' &&
        selection.subRegionId === subRegionId
      }
      label={subRegion.name ?? ''}
      onPress={() => {
        if (!subRegionId || !subRegion.name) {
          return;
        }

        onSelect({
          label: subRegion.name,
          subRegionId,
          type: 'subregion',
        });
      }}
      subtitle={subRegion.maori}
    />
  );
}

function SheetHeader({
  onApply,
  onDismiss,
  title,
}: {
  onApply: () => void;
  onDismiss: () => void;
  title: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        borderBottomColor: '#e5e5e5',
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 14,
      }}>
      <Pressable
        accessibilityLabel="Apply filter"
        accessibilityRole="button"
        onPress={onApply}
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
        <Text style={{ fontSize: 16, fontWeight: '600' }}>Apply</Text>
      </Pressable>
      <Text style={{ fontSize: 19, fontWeight: '800' }}>{title}</Text>
      <Pressable
        accessibilityLabel="Close without applying"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onDismiss}
        style={({ pressed }) => ({
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.55 : 1,
          width: 42,
        })}>
        <MaterialIcons color="#4a4a4a" name="close" size={22} />
      </Pressable>
    </View>
  );
}

function SelectionRow({
  isSelected,
  label,
  onPress,
  subtitle,
}: {
  isSelected: boolean;
  label: string;
  onPress: () => void;
  subtitle?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        minHeight: 54,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: 8,
      })}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700' }}>{label}</Text>
        {subtitle ? (
          <Text style={{ color: '#717171', fontSize: 13, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {isSelected ? (
        <MaterialIcons color="#111" name="check-circle" size={22} />
      ) : null}
    </Pressable>
  );
}
