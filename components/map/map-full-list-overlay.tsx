// The full Places list as an overlay that slides up over the Map.
//
// The Map screen used to be replaced by the list, which unmounted MapLibre and
// forced it to initialise again on return. The overlay leaves the map mounted
// underneath, so the camera, zoom, filters and selection are simply still there.
// It slides on the UI thread (translateY, 500 ms ease-in-out) and is mounted only while it
// is open or still sliding away.
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Palette } from '@/constants/design';
import { TRAY_TIMING_CONFIG } from '@/components/map/tray-timing';

export function MapFullListOverlay({ children, open }: { children: ReactNode; open: boolean }) {
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(open);

  const unmount = useCallback(() => setMounted(false), []);

  // Mounting the list is the expensive part of opening, so it happens first and the
  // slide starts only once it is in place. The slide then runs on the UI thread with
  // nothing left for the JS thread to do mid-flight. This is sequencing, not a delay.
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    progress.value = withTiming(
      open ? 1 : 0,
      TRAY_TIMING_CONFIG,
      (finished) => {
        // Only a completed slide away unmounts; reopening mid-slide cancels it.
        if (finished && !open) scheduleOnRN(unmount);
      }
    );
  }, [open, mounted, progress, unmount]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * height }] }));

  if (!mounted) return null;
  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, { backgroundColor: Palette.background, zIndex: 10 }, style]}>
      {children}
    </Animated.View>
  );
}
