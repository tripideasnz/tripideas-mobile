import { ObjectToolbar } from '@/components/ui/object-toolbar';
import { SavedObjectIcons } from '@/components/ui/saved-object-icons';

const actions = [
  ['Narrative', SavedObjectIcons.narrative], ['Photo', SavedObjectIcons.photo], ['Link', SavedObjectIcons.link],
  ['Place', SavedObjectIcons.tripIdeasPlace], ['Pin', SavedObjectIcons.pin],
] as const;
export type DiaryObjectAction = typeof actions[number][0];
export function DiaryObjectToolbar({ onSelect }: { onSelect: (action: DiaryObjectAction) => void }) {
  return <ObjectToolbar accessibilityLabel="Add Diary object" actions={actions.map(([name, icon]) => ({ name, icon }))} onSelect={onSelect} />;
}
