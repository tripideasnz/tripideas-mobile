import { ObjectToolbar } from '@/components/ui/object-toolbar';
import { SavedObjectIcons } from '@/components/ui/saved-object-icons';

const actions = [
  { name: 'Text', icon: SavedObjectIcons.narrative },
  { name: 'Photo', icon: SavedObjectIcons.photo },
  { name: 'Link', icon: SavedObjectIcons.link },
  { name: 'Place', icon: SavedObjectIcons.tripIdeasPlace },
  { name: 'Pin', icon: SavedObjectIcons.pin },
] as const;

export type NotebookObjectAction = typeof actions[number]['name'];

export function NotebookObjectToolbar({ disabled, onSelect }: {
  disabled?: boolean;
  onSelect: (action: NotebookObjectAction) => void;
}) {
  return <ObjectToolbar accessibilityLabel="Add Notebook object" actions={actions} disabled={disabled} onSelect={onSelect} />;
}
