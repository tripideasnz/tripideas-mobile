import { type ReactNode, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/app-text';
import { ContainedRemoveButton } from '@/components/ui/contained-remove-button';
import { DragReorderRow } from '@/components/ui/drag-reorder-row';
import { FinishEditAction } from '@/components/ui/finish-edit-action';
import { SavedAutosaveScope } from '@/components/ui/saved-autosave-field';
import { useSavedObjectFocus } from '@/components/ui/saved-object-focus';
import { Palette, Space } from '@/constants/design';

export function SavedObjectEditorShell({ canMoveDown, canMoveUp, children, collapsed, editable = true, expanded, label, onCollapse, onExpand, onMove, onRemove }: {
  canMoveDown: boolean; canMoveUp: boolean; children: ReactNode; collapsed: ReactNode; editable?: boolean; expanded: boolean; label: string;
  onCollapse: () => void; onExpand: () => void; onMove: (offset: -1 | 1) => void; onRemove: () => void;
}) {
  const accessibleType = label.charAt(0) + label.slice(1).toLowerCase();
  const focusObject = useSavedObjectFocus();
  const objectRef = useRef<View>(null);
  useEffect(() => { if (expanded && objectRef.current) focusObject?.(objectRef.current); }, [expanded, focusObject]);
  return <View ref={objectRef}><DragReorderRow canMoveDown={canMoveDown} canMoveUp={canMoveUp} label={accessibleType} onMove={onMove} header={<AppText color={Palette.textMuted} variant="label">{label}</AppText>}><SavedAutosaveScope>{(flush) => <>
    {!editable ? <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><View style={{ flex: 1, paddingVertical: Space.xs }}>{collapsed}</View><ContainedRemoveButton label={`Remove ${accessibleType}`} onPress={onRemove} /></View>
      : expanded ? <View style={{ gap: Space.xs }}>{children}<View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm, justifyContent: 'flex-end' }}><FinishEditAction accessibilityLabel={`Finish editing ${accessibleType}`} onPress={() => void flush().then(onCollapse)} /><ContainedRemoveButton label={`Remove ${accessibleType}`} onPress={onRemove} /></View></View>
      : <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: Space.sm }}><Pressable accessibilityLabel={`Edit ${accessibleType}`} accessibilityRole="button" onPress={onExpand} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.55 : 1, paddingBottom: Space.xs, paddingTop: Space.xs })}>{collapsed}</Pressable><ContainedRemoveButton label={`Remove ${accessibleType}`} onPress={onRemove} /></View>}
  </>}</SavedAutosaveScope></DragReorderRow></View>;
}
