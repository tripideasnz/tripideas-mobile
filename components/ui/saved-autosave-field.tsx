import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, type TextInputProps } from 'react-native';
import { AppTextInput, AutoExpandingTextInput } from '@/components/ui/app-text-input';
import { AutosaveStatus, type AutosaveState } from '@/components/ui/autosave-status';
import { Space } from '@/constants/design';

export type SavedAutosaveFieldHandle = { flush: () => Promise<void> };
const AutosaveScopeContext = createContext<((flush: () => Promise<void>) => () => void) | null>(null);
export function SavedAutosaveScope({ children }: { children: (flush: () => Promise<void>) => ReactNode }) {
  const flushers = useRef(new Set<() => Promise<void>>());
  const register = useMemo(() => (flush: () => Promise<void>) => { flushers.current.add(flush); return () => { flushers.current.delete(flush); }; }, []);
  const flush = async () => { const results = await Promise.allSettled([...flushers.current].map((save) => save())); if (results.some(({ status }) => status === 'rejected')) throw new Error('autosave_flush_failed'); };
  return <AutosaveScopeContext.Provider value={register}>{children(flush)}</AutosaveScopeContext.Provider>;
}
export const SavedAutosaveField = forwardRef<SavedAutosaveFieldHandle, { accessibilityLabel: string; autoExpand?: boolean; autoFocus?: boolean; inputStyle?: TextInputProps['style']; maxLength?: number; multiline?: boolean; onSave: (value: string) => Promise<void | string>; placeholder: string; textVariant?: 'body' | 'cardTitle' | 'section' | 'title'; value: string }>(function SavedAutosaveField({ accessibilityLabel, autoExpand = false, autoFocus, inputStyle, maxLength, multiline = false, onSave, placeholder, textVariant = 'body', value }, ref) {
  const [draft, setDraft] = useState(value); const [state, setState] = useState<AutosaveState>('idle'); const [inputHeight, setInputHeight] = useState(48);
  const draftRef = useRef(value); const savedRef = useRef(value); const revisionRef = useRef(0); const saveRef = useRef(onSave); const pendingRef = useRef<Promise<void> | null>(null); const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeRegister = useContext(AutosaveScopeContext);
  useEffect(() => { saveRef.current = onSave; }, [onSave]);
  useEffect(() => { if (revisionRef.current === 0) { savedRef.current = value; draftRef.current = value; setDraft(value); } }, [value]);
  const save = useCallback(async () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null; if (draftRef.current === savedRef.current) return pendingRef.current ?? Promise.resolve(); if (pendingRef.current) await pendingRef.current; const revision = revisionRef.current; const candidate = draftRef.current; setState('saving'); const pending = saveRef.current(candidate).then((normalized) => { if (revisionRef.current === revision) { const authoritative = typeof normalized === 'string' ? normalized : candidate; savedRef.current = authoritative; draftRef.current = authoritative; setDraft(authoritative); revisionRef.current = 0; setState('idle'); } }).catch((error) => { if (revisionRef.current === revision) setState('failed'); throw error; }).finally(() => { pendingRef.current = null; }); pendingRef.current = pending; return pending; }, []);
  useImperativeHandle(ref, () => ({ flush: save }));
  useEffect(() => scopeRegister?.(save), [scopeRegister, save]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); if (draftRef.current !== savedRef.current) void saveRef.current(draftRef.current).catch(() => undefined); }, []);
  const shouldAutoExpand = autoExpand || (!multiline && Boolean(inputStyle)); const Input = shouldAutoExpand ? AutoExpandingTextInput : AppTextInput;
  return <View style={{ gap: Space.xs }}><Input accessibilityLabel={accessibilityLabel} autoFocus={autoFocus} maxLength={maxLength} multiline={multiline || shouldAutoExpand} onContentSizeChange={multiline ? (event) => { const height = Math.min(228, Math.max(48, Math.ceil(event.nativeEvent.contentSize.height))); setInputHeight((current) => Math.abs(current - height) >= 2 ? height : current); } : undefined} onChangeText={(next) => { revisionRef.current += 1; draftRef.current = next; setDraft(next); setState('idle'); if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => void save().catch(() => undefined), 700); }} placeholder={placeholder} scrollEnabled={multiline} style={[multiline ? { height: inputHeight, maxHeight: 228, minHeight: 48, textAlignVertical: 'top' } : undefined, inputStyle]} textVariant={textVariant} value={draft} /><AutosaveStatus accessibilityLabel={accessibilityLabel} onRetry={() => void save().catch(() => undefined)} state={state} /></View>;
});
