import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

export const SavedObjectIcons = {
  link: 'link',
  narrative: 'notes',
  personalPlace: 'person-pin-circle',
  photo: 'photo-library',
  pin: 'location-on',
  tripIdeasPlace: 'explore',
} as const satisfies Record<string, MaterialIconName>;
