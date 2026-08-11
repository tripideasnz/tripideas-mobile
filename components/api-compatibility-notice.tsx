import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette, Radius, Shadow, Space, Type } from '@/constants/design';
import {
  ApiCompatibility,
  checkApiCompatibility,
} from '@/lib/api-compatibility';

export function ApiCompatibilityNotice() {
  const insets = useSafeAreaInsets();
  const [compatibility, setCompatibility] = useState<ApiCompatibility | null>(null);

  useEffect(() => {
    let active = true;
    void checkApiCompatibility().then((result) => {
      if (active) setCompatibility(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (compatibility?.status !== 'incompatible') return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.position, { bottom: Math.max(insets.bottom, Space.lg) }]}
    >
      <View accessibilityRole="alert" style={styles.notice}>
        <Text style={styles.text}>
          This mobile build is connected to an incompatible TripIdeas API.
          Cached content remains available; online features may not work.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    left: Space.xxl,
    position: 'absolute',
    right: Space.xxl,
  },
  notice: {
    ...Shadow.sheet,
    backgroundColor: Palette.surface,
    borderColor: Palette.danger,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Space.lg,
  },
  text: {
    ...Type.caption,
    color: Palette.danger,
  },
});

