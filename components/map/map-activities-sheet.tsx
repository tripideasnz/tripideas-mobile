import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { clearPendingActivities, toggleActivity } from '@/components/map/filter-pending';
import {
  FilterGroup,
  FilterGroupRow,
  FilterPanel,
  FilterSelectRow,
  FilterSheet,
} from '@/components/map/filter-sheet';
import type { MapActivitySuperTag } from '@/sanity/types';

type MapActivitiesSheetProps = {
  activities: MapActivitySuperTag[];
  isLoading: boolean;
  /** Commits every pending selection together (Apply). Nothing reaches the Map before this. */
  onApply: (tagIds: string[]) => void;
  /** Discards the pending selections (Cancel, or a swipe down). */
  onCancel: () => void;
  /** The activities currently applied to the Map. */
  selectedTagIds: string[];
  visible: boolean;
};

export function MapActivitiesSheet({
  activities,
  isLoading,
  onApply,
  onCancel,
  selectedTagIds,
  visible,
}: MapActivitiesSheetProps) {
  const [expandedSuperTagIds, setExpandedSuperTagIds] = useState<string[]>([]);
  // Any number of activities at once; the Map is only told on Apply.
  const [pendingTagIds, setPendingTagIds] = useState<string[]>(selectedTagIds);

  useEffect(() => {
    if (visible) setPendingTagIds(selectedTagIds);
  // Staging restarts from the applied activities each time the sheet opens; `selectedTagIds` is
  // intentionally omitted so an applied change elsewhere cannot rewrite a sheet being edited.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const selectedIds = new Set(pendingTagIds);

  return (
    <FilterSheet
      canClear={pendingTagIds.length > 0}
      clearLabel="Clear all selected activities"
      onApply={() => onApply(pendingTagIds)}
      onCancel={onCancel}
      onClear={() => setPendingTagIds(clearPendingActivities())}
      title="Activities"
      visible={visible}>
      {isLoading ? (
        <Text style={{ color: '#717171', fontSize: 15, paddingTop: 24 }}>
          Loading activities...
        </Text>
      ) : activities.length > 0 ? (
        activities.map((superTag, index) => {
          const superTagId = superTag._id;
          const isExpanded = Boolean(
            superTagId && expandedSuperTagIds.includes(superTagId)
          );
          const tags = (superTag.tags ?? []).filter(Boolean);
          const selectedCount = tags.filter(
            (tag) => tag._id && selectedIds.has(tag._id)
          ).length;

          return (
            <FilterGroup key={superTagId ?? superTag.slug?.current ?? index}>
              <FilterGroupRow
                expanded={isExpanded}
                onPress={() => {
                  if (!superTagId) {
                    return;
                  }

                  setExpandedSuperTagIds((current) =>
                    current.includes(superTagId)
                      ? current.filter((id) => id !== superTagId)
                      : [...current, superTagId]
                  );
                }}
                subtitle={selectedCount > 0 ? `${selectedCount} selected` : undefined}
                title={superTag.name ?? ''}
              />

              {isExpanded ? (
                <FilterPanel>
                  {tags.map((tag, tagIndex) => {
                    const tagId = tag._id;

                    return (
                      <FilterSelectRow
                        bordered
                        key={tagId ?? tag.slug?.current ?? tagIndex}
                        label={tag.name ?? ''}
                        onPress={() => {
                          if (tagId) {
                            setPendingTagIds((current) => toggleActivity(current, tagId));
                          }
                        }}
                        selected={Boolean(tagId && selectedIds.has(tagId))}
                      />
                    );
                  })}
                </FilterPanel>
              ) : null}
            </FilterGroup>
          );
        })
      ) : (
        <Text style={{ color: '#717171', fontSize: 15 }}>
          No activities found.
        </Text>
      )}
    </FilterSheet>
  );
}
