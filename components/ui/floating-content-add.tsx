import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type ReactNode, useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Palette, Radius, Screen, Shadow, Space } from '@/constants/design';

export function FloatingContentAdd({ children, disabled = false }: { children: (close: () => void) => ReactNode; disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const close = () => setOpen(false);
  return <><Pressable accessibilityLabel="Add content" accessibilityRole="button" disabled={disabled} onPress={() => setOpen(true)} style={({ pressed }) => ({ ...Shadow.floating, alignItems: 'center', backgroundColor: Palette.trip, borderRadius: Radius.pill, bottom: Math.max(insets.bottom, Screen.bottom) + keyboardHeight, flexDirection: 'row', gap: Space.xs, height: 52, left: Screen.gutter, opacity: disabled ? 0.35 : pressed ? 0.65 : 1, paddingHorizontal: Space.lg, position: 'absolute', zIndex: 20 })}>
    <MaterialIcons color={Palette.surface} name="add" size={22} /><AppText color={Palette.surface} variant="bodyStrong">Add content</AppText>
  </Pressable>
  <Modal animationType="slide" onRequestClose={close} transparent visible={open}><Pressable accessibilityLabel="Close content picker" accessibilityRole="button" onPress={close} style={{ backgroundColor: 'rgba(0,0,0,0.28)', flex: 1, justifyContent: 'flex-end' }}><Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, gap: Space.md, padding: Screen.gutter }}>{children(close)}</Pressable></Pressable></Modal></>;
}
