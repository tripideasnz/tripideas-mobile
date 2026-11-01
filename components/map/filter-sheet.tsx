// The shared frame and rows of the Map's Regions and Activities filters, so the two look and behave
// alike: Open → Select or Clear → Apply or Cancel.
//
// Header: Cancel (left) · title (centre) · Apply (right), with Clear right-aligned directly below.
// Selections are pending inside each sheet: nothing reaches the Map until Apply; Cancel (or a swipe
// down) discards them. Apply is always available, including with nothing selected. What may be
// selected (one region, or many activities) stays each sheet's own rule.
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CONTROL_MAX_FONT_SCALE } from '@/constants/design';

export const FILTER_ACCENT = '#0080C8';
const DIVIDER = '#e7e7e7';
const PANEL_DIVIDER = '#e2e2e2';
const PANEL = '#f7f7f7';
const MUTED = '#717171';
const ICON = '#4a4a4a';

export const FILTER_GROUP_ROW_HEIGHT = 58;
export const FILTER_ROW_HEIGHT = 54;

const headerAction = {
  color: FILTER_ACCENT,
  fontSize: 17,
  fontWeight: '600',
} as const;

function HeaderAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({ justifyContent: 'center', minHeight: 44, opacity: pressed ? 0.55 : 1 })}>
      <Text maxFontSizeMultiplier={CONTROL_MAX_FONT_SCALE} numberOfLines={1} style={headerAction}>{label}</Text>
    </Pressable>
  );
}

export function FilterSheet({
  canClear,
  children,
  clearLabel,
  onApply,
  onCancel,
  onClear,
  title,
  visible,
}: {
  /** Whether there is anything pending to clear; Clear keeps its place but is dimmed when not. */
  canClear: boolean;
  children: ReactNode;
  /** Spoken label for Clear (the visible word is always "Clear"). */
  clearLabel: string;
  onApply: () => void;
  onCancel: () => void;
  onClear: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
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
            paddingVertical: 8,
          }}>
          {/* Slots are at least 72 pt (as before) but grow with their label, so Cancel and Apply are never split. */}
          <View style={{ alignItems: 'flex-start', flexShrink: 0, minWidth: 72 }}>
            <HeaderAction label="Cancel" onPress={onCancel} />
          </View>
          <Text
            accessibilityRole="header"
            adjustsFontSizeToFit
            maxFontSizeMultiplier={CONTROL_MAX_FONT_SCALE}
            minimumFontScale={0.7}
            numberOfLines={1}
            style={{ flexShrink: 1, fontSize: 19, fontWeight: '800', textAlign: 'center' }}>
            {title}
          </Text>
          <View style={{ alignItems: 'flex-end', flexShrink: 0, minWidth: 72 }}>
            <HeaderAction label="Apply" onPress={onApply} />
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', paddingHorizontal: 18, paddingTop: 6 }}>
          <Pressable
            accessibilityLabel={clearLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canClear }}
            disabled={!canClear}
            hitSlop={8}
            onPress={onClear}
            style={({ pressed }) => ({
              justifyContent: 'center',
              minHeight: 36,
              opacity: !canClear ? 0.35 : pressed ? 0.55 : 1,
            })}>
            <Text maxFontSizeMultiplier={CONTROL_MAX_FONT_SCALE} numberOfLines={1} style={{ color: FILTER_ACCENT, fontSize: 15, fontWeight: '600' }}>Clear</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 18 }}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** One expandable group (a Region, or an Activity category): its row, then its panel when open. */
export function FilterGroup({ children }: { children: ReactNode }) {
  return <View style={{ borderBottomColor: DIVIDER, borderBottomWidth: 1 }}>{children}</View>;
}

/** The grey panel holding a group's own rows (sub-regions, activities). */
export function FilterPanel({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: PANEL, marginBottom: 10, paddingHorizontal: 12 }}>{children}</View>;
}

export function FilterChevron({ expanded }: { expanded: boolean }) {
  return <MaterialIcons color={ICON} name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={24} />;
}

/** The expand/collapse control that sits beside a selectable row (Regions). */
export function FilterExpandToggle({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${expanded ? 'Hide' : 'Show'} sub-regions`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        height: 48,
        justifyContent: 'center',
        opacity: pressed ? 0.55 : 1,
        width: 44,
      })}>
      <FilterChevron expanded={expanded} />
    </Pressable>
  );
}

/** A group row whose whole width expands it (Activity categories). */
export function FilterGroupRow({
  expanded,
  onPress,
  subtitle,
  title,
}: {
  expanded: boolean;
  onPress: () => void;
  subtitle?: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        minHeight: FILTER_GROUP_ROW_HEIGHT,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: 8,
      })}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '800' }}>{title}</Text>
        {subtitle ? <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      {/* The same 44 pt column as the Regions expand control, so the chevrons line up. */}
      <View style={{ alignItems: 'center', width: 44 }}>
        <FilterChevron expanded={expanded} />
      </View>
    </Pressable>
  );
}

/**
 * A selectable row: label (and optional subtitle) with the same indicator in both filters,
 * an outlined circle when not selected and a filled check when selected.
 */
export function FilterSelectRow({
  bordered = false,
  flex = false,
  label,
  onPress,
  selected,
  subtitle,
}: {
  /** A divider under the row, for rows inside a grey panel. */
  bordered?: boolean;
  /** Take the remaining width of a row that also holds an expand control. */
  flex?: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
  subtitle?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        borderBottomColor: PANEL_DIVIDER,
        borderBottomWidth: bordered ? 1 : 0,
        flex: flex ? 1 : undefined,
        flexDirection: 'row',
        minHeight: FILTER_ROW_HEIGHT,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: 8,
      })}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '400' }}>{label}</Text>
        {subtitle ? <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      <MaterialIcons
        color={selected ? '#111' : '#a0a0a0'}
        name={selected ? 'check-circle' : 'radio-button-unchecked'}
        size={22}
      />
    </Pressable>
  );
}
