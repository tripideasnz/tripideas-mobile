// The single timing used by every Map tray transition: minimise/expand, and the
// full list opening and closing. 500 ms, ease-in-out.
import { Easing } from 'react-native-reanimated';

import { TRAY_ANIMATION_MS } from '@/components/map/tray-motion';

export const TRAY_TIMING_CONFIG = {
  duration: TRAY_ANIMATION_MS,
  easing: Easing.inOut(Easing.cubic),
} as const;
