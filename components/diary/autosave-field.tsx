import { useEffect, useRef, useState } from 'react';
import { View, type TextInputProps } from 'react-native';
import { AppTextInput } from '@/components/ui/app-text-input';
import { AutosaveStatus, type AutosaveState } from '@/components/ui/autosave-status';
import { Space } from '@/constants/design';

export function DiaryAutosaveField({ accessibilityLabel, autoFocus = false, inputStyle, maxLength, multiline = false, onSave, placeholder, value }: {
  accessibilityLabel: string; autoFocus?: boolean; maxLength?: number; multiline?: boolean; onSave: (value: string) => Promise<void | string>;
  inputStyle?: TextInputProps['style']; placeholder: string; value: string;
}) {
  const [draft, setDraft] = useState(value); const [state, setState] = useState<AutosaveState>('idle');
  const [inputHeight, setInputHeight] = useState(48);
  const draftRef = useRef(value); const saved = useRef(value); const revision = useRef(0); const saveRef = useRef(onSave); const [retry, setRetry] = useState(0);
  useEffect(() => { saveRef.current = onSave; }, [onSave]);
  useEffect(() => { if (revision.current === 0) { saved.current = value; draftRef.current = value; setDraft(value); } }, [value]);
  useEffect(() => () => { if (draftRef.current !== saved.current) void saveRef.current(draftRef.current); }, []);
  useEffect(() => {
    if (draft === saved.current) return;
    const currentRevision = revision.current;
    const timer = setTimeout(() => { setState('saving'); void saveRef.current(draft).then((normalized) => {
      if (revision.current === currentRevision) { const next = typeof normalized === 'string' ? normalized : draft; saved.current = next; draftRef.current = next; setDraft(next); revision.current = 0; setState('idle'); }
    }).catch(() => { if (revision.current === currentRevision) setState('failed'); }); }, 700);
    return () => clearTimeout(timer);
  }, [draft, retry]);
  return <View style={{ gap: Space.xs }}><AppTextInput accessibilityLabel={accessibilityLabel} autoFocus={autoFocus} maxLength={maxLength} multiline={multiline}
    onContentSizeChange={multiline ? (event) => {
      const nextHeight = Math.min(180, Math.max(48, Math.ceil(event.nativeEvent.contentSize.height)));
      setInputHeight((current) => Math.abs(current - nextHeight) >= 2 ? nextHeight : current);
    } : undefined}
    onChangeText={(next) => { revision.current += 1; draftRef.current = next; setDraft(next); setState('idle'); }} placeholder={placeholder}
    scrollEnabled={multiline} style={[multiline ? { height: inputHeight, maxHeight: 180, minHeight: 48, textAlignVertical: 'top' } : undefined, inputStyle]} value={draft} />
    <AutosaveStatus accessibilityLabel={accessibilityLabel} onRetry={() => { setState('idle'); setRetry((value) => value + 1); }} state={state} />
  </View>;
}
