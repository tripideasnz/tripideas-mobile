import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MapActivitySuperTag } from '@/sanity/types';

type MapActivitiesSheetProps = {
  activities: MapActivitySuperTag[];
  isLoading: boolean;
  onApply: (tagIds: string[]) => void;
  onClose: () => void;
  selectedTagIds: string[];
  visible: boolean;
};

export function MapActivitiesSheet({
  activities,
  isLoading,
  onApply,
  onClose,
  selectedTagIds,
  visible,
}: MapActivitiesSheetProps) {
  const [expandedSuperTagIds, setExpandedSuperTagIds] = useState<string[]>([]);
  const [pendingTagIds, setPendingTagIds] = useState<string[]>(selectedTagIds);

  useEffect(() => {
    if (visible) setPendingTagIds(selectedTagIds);
  // Reset to committed state whenever the modal opens; selectedTagIds intentionally omitted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const selectedIds = new Set(pendingTagIds);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}>
      <SafeAreaView style={{ backgroundColor: '#fff', flex: 1 }}>
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
            accessibilityLabel="Apply filters"
            accessibilityRole="button"
            onPress={() => onApply(pendingTagIds)}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>Apply</Text>
          </Pressable>
          <Text style={{ fontSize: 19, fontWeight: '800' }}>Activities</Text>
          <Pressable
            accessibilityLabel="Close without applying"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => ({
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.55 : 1,
              width: 42,
            })}>
            <MaterialIcons color="#4a4a4a" name="close" size={22} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          {isLoading ? (
            <Text style={{ color: '#717171', fontSize: 15 }}>
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
                <View
                  key={superTagId ?? superTag.slug?.current ?? index}
                  style={{
                    borderBottomColor: '#e7e7e7',
                    borderBottomWidth: 1,
                  }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
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
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      flexDirection: 'row',
                      minHeight: 58,
                      opacity: pressed ? 0.6 : 1,
                      paddingVertical: 8,
                    })}>
                    <View style={{ flex: 1 }}>
                      {superTag.name ? (
                        <Text style={{ fontSize: 17, fontWeight: '800' }}>
                          {superTag.name}
                        </Text>
                      ) : null}
                      {selectedCount > 0 ? (
                        <Text
                          style={{
                            color: '#717171',
                            fontSize: 13,
                            marginTop: 2,
                          }}>
                          {selectedCount} selected
                        </Text>
                      ) : null}
                    </View>
                    <MaterialIcons
                      color="#4a4a4a"
                      name={
                        isExpanded
                          ? 'keyboard-arrow-up'
                          : 'keyboard-arrow-down'
                      }
                      size={25}
                    />
                  </Pressable>

                  {isExpanded ? (
                    <View
                      style={{
                        backgroundColor: '#f7f7f7',
                        marginBottom: 10,
                        paddingHorizontal: 12,
                      }}>
                      {tags.map((tag, tagIndex) => {
                        const tagId = tag._id;
                        const isSelected = Boolean(
                          tagId && selectedIds.has(tagId)
                        );

                        return (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            key={tagId ?? tag.slug?.current ?? tagIndex}
                            onPress={() => {
                              if (tagId) {
                                setPendingTagIds((current) =>
                                  current.includes(tagId)
                                    ? current.filter((id) => id !== tagId)
                                    : [...current, tagId]
                                );
                              }
                            }}
                            style={({ pressed }) => ({
                              alignItems: 'center',
                              borderBottomColor: '#e2e2e2',
                              borderBottomWidth: 1,
                              flexDirection: 'row',
                              minHeight: 52,
                              opacity: pressed ? 0.6 : 1,
                              paddingVertical: 8,
                            })}>
                            <View style={{ flex: 1 }}>
                              {tag.name ? (
                                <Text
                                  style={{
                                    fontSize: 16,
                                    fontWeight: isSelected ? '800' : '600',
                                  }}>
                                  {tag.name}
                                </Text>
                              ) : null}
                            </View>
                            <MaterialIcons
                              color={isSelected ? '#111' : '#a0a0a0'}
                              name={
                                isSelected
                                  ? 'check-circle'
                                  : 'radio-button-unchecked'
                              }
                              size={22}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={{ color: '#717171', fontSize: 15 }}>
              No activities found.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
