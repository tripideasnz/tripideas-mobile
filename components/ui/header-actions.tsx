// Header action options for Saved screens. Every action is a fixed-size circular
// control in the shared Saved header (see saved-header.tsx), never a native
// bar-button item, so it cannot be resized by the system.
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { savedActionHeader, SavedHeaderActionButton, type SavedHeaderAction } from '@/components/ui/saved-header';

function actionOptions(icon: 'add' | 'share', action: SavedHeaderAction): NativeStackNavigationOptions {
  return {
    ...savedActionHeader,
    headerRight: () => <SavedHeaderActionButton action={action} icon={icon} />,
  };
}

export function headerAddAction(action: SavedHeaderAction): NativeStackNavigationOptions {
  return actionOptions('add', action);
}

export function headerShareAction(action: SavedHeaderAction): NativeStackNavigationOptions {
  return actionOptions('share', action);
}

// Screens with no action still use the shared header so the title and back
// control sit in the same place as on their siblings.
export function clearHeaderRightAction(): NativeStackNavigationOptions {
  return { ...savedActionHeader, headerRight: () => null };
}
