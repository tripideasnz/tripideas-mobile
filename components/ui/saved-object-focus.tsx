import { createContext, type ReactNode, type RefObject, useCallback, useContext, useEffect, useRef } from 'react';
import { Keyboard, type ScrollView, useWindowDimensions, View } from 'react-native';

const SavedObjectFocusContext = createContext<((target: View) => void) | null>(null);

export function SavedObjectFocusScope({ children, contentRef, scrollRef }: { children: ReactNode; contentRef: RefObject<View>; scrollRef: RefObject<ScrollView | null> }) {
  const { height } = useWindowDimensions();
  const focus = useCallback((target: View) => {
    setTimeout(() => {
      const scroll = scrollRef.current;
      const inner = contentRef.current;
      if (!scroll || !inner) return;
      target.measureLayout(inner, (_x, y) => {
        const keyboardHeight = Keyboard.metrics()?.height ?? 0;
        const visibleHeight = Math.max(280, height - keyboardHeight - 120);
        scroll.scrollTo({ animated: true, y: Math.max(0, y - visibleHeight * 0.38) });
      });
    }, 80);
  }, [contentRef, height, scrollRef]);
  return <SavedObjectFocusContext.Provider value={focus}>{children}</SavedObjectFocusContext.Provider>;
}

export function useSavedObjectFocus() {
  return useContext(SavedObjectFocusContext);
}

export function SavedObjectReveal({ children, revealKey }: { children: ReactNode; revealKey?: string | null }) {
  const ref = useRef<View>(null);
  const focus = useSavedObjectFocus();
  useEffect(() => { if (revealKey && ref.current) focus?.(ref.current); }, [focus, revealKey]);
  return <View ref={ref}>{children}</View>;
}
