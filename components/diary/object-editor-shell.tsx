import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { ContainedRemoveButton } from '@/components/diary/contained-remove-button';
import { DragReorderRow } from '@/components/diary/drag-reorder-row';
import { FinishEditAction } from '@/components/diary/finish-edit-action';
import { AppText } from '@/components/ui/app-text';
import { Palette, Space } from '@/constants/design';

export type DiaryObjectLabel = 'NARRATIVE' | 'PHOTO' | 'LINK' | 'PLACE' | 'PIN';

export function DiaryObjectEditorShell({ canMoveDown, canMoveUp, children, collapsed, editable = true, expanded, label, onCollapse, onExpand, onMove, onRemove }: {
  canMoveDown: boolean; canMoveUp: boolean; children: ReactNode; collapsed: ReactNode; expanded: boolean; label: DiaryObjectLabel;
  editable?: boolean; onCollapse: () => void; onExpand: () => void; onMove: (offset: -1 | 1) => void; onRemove: () => void;
}) {
  const accessibleType = label.charAt(0) + label.slice(1).toLowerCase();
  return <DragReorderRow canMoveDown={canMoveDown} canMoveUp={canMoveUp} label={accessibleType} onMove={onMove}
    header={<AppText color={Palette.textMuted} variant="label">{label}</AppText>}>
    {!editable ? <View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><View style={{ flex: 1, paddingVertical: Space.xs }}>{collapsed}</View><ContainedRemoveButton label={`Remove ${accessibleType}`} onPress={onRemove} /></View> : expanded ? <View style={{ gap: Space.xs }}>{children}<View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm, justifyContent: 'flex-end' }}>
      <FinishEditAction accessibilityLabel={`Finish editing ${accessibleType}`} onPress={onCollapse} /><ContainedRemoveButton label={`Remove ${accessibleType}`} onPress={onRemove} />
    </View></View> : <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: Space.sm }}><Pressable accessibilityLabel={`Edit ${accessibleType}`} accessibilityRole="button" onPress={onExpand} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.55 : 1, paddingBottom: Space.xs, paddingTop: Space.xs })}>{collapsed}</Pressable><ContainedRemoveButton label={`Remove ${accessibleType}`} onPress={onRemove} /></View>}
  </DragReorderRow>;
}
