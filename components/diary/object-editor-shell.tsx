import type { ComponentProps } from 'react';
import { SavedObjectEditorShell } from '@/components/ui/saved-object-editor-shell';
export type DiaryObjectLabel = 'NARRATIVE' | 'PHOTO' | 'LINK' | 'TRIPIDEAS PLACE' | 'PERSONAL PLACE' | 'PIN';
export function DiaryObjectEditorShell(props: Omit<ComponentProps<typeof SavedObjectEditorShell>, 'label'> & { label: DiaryObjectLabel }) { return <SavedObjectEditorShell {...props} />; }
