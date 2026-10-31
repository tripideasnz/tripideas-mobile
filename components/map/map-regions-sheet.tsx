import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  FILTER_GROUP_ROW_HEIGHT,
  FilterExpandToggle,
  FilterGroup,
  FilterPanel,
  FilterSelectRow,
  FilterSheet,
} from '@/components/map/filter-sheet';
import { chooseRegion, clearPendingRegions } from '@/components/map/filter-pending';
import { clearRegionScope, type MapContentSelection } from '@/components/map/map-selection';
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
  /** Commits the pending selection (Apply). Nothing reaches the Map before this. */
  onApply: (selection: MapContentSelection) => void;
  /** Discards the pending selection (Cancel, or a swipe down). */
  onCancel: () => void;
  /** The selection currently applied to the Map. */
  selection: MapContentSelection;
  visible: boolean;
};

export function MapRegionsSheet({
  isLoading,
  navigation,
  onApply,
  onCancel,
  selection,
  visible,
}: MapRegionsSheetProps) {
  const [expandedRegionIds, setExpandedRegionIds] = useState<string[]>([]);
  // One region or sub-region at a time: choosing another replaces it, choosing it again clears it.
  const [pending, setPending] = useState<MapContentSelection>(selection);

  useEffect(() => {
    if (visible) setPending(selection);
  // Staging restarts from the applied selection each time the sheet opens; `selection` is
  // intentionally omitted so an applied change elsewhere cannot rewrite a sheet being edited.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const choose = (next: MapContentSelection) => setPending((current) => chooseRegion(current, next));
  const toggleRegion = (regionId: string) =>
    setExpandedRegionIds((current) =>
      current.includes(regionId) ? current.filter((id) => id !== regionId) : [...current, regionId]
    );

  return (
    <FilterSheet
      canClear={clearRegionScope(pending) !== pending}
      clearLabel="Clear region selection"
      onApply={() => onApply(pending)}
      onCancel={onCancel}
      onClear={() => setPending((current) => clearPendingRegions(current))}
      title="Regions"
      visible={visible}>
      {isLoading ? (
        <Text style={{ color: '#717171', fontSize: 15, paddingTop: 24 }}>
          Loading regions...
        </Text>
      ) : (
        <>
          <IslandSection
            expandedRegionIds={expandedRegionIds}
            island={navigation.north}
            onSelect={choose}
            onToggleRegion={toggleRegion}
            selection={pending}
          />
          <IslandSection
            expandedRegionIds={expandedRegionIds}
            island={navigation.south}
            onSelect={choose}
            onToggleRegion={toggleRegion}
            selection={pending}
          />
        </>
      )}
    </FilterSheet>
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
    <FilterGroup>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          minHeight: FILTER_GROUP_ROW_HEIGHT,
        }}>
        <FilterSelectRow
          flex
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
          selected={selection.type === 'region' && selection.regionId === regionId}
          subtitle={region.maori}
        />
        {subRegions.length > 0 ? (
          <FilterExpandToggle
            expanded={isExpanded}
            onPress={() => {
              if (regionId) {
                onToggleRegion(regionId);
              }
            }}
          />
        ) : null}
      </View>

      {isExpanded ? (
        <FilterPanel>
          {subRegions.map((subRegion, index) => (
            <SubRegionRow
              key={subRegion._id ?? subRegion.slug?.current ?? index}
              onSelect={onSelect}
              selection={selection}
              subRegion={subRegion}
            />
          ))}
        </FilterPanel>
      ) : null}
    </FilterGroup>
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
    <FilterSelectRow
      bordered
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
      selected={selection.type === 'subregion' && selection.subRegionId === subRegionId}
      subtitle={subRegion.maori}
    />
  );
}
