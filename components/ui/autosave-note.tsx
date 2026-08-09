import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { AutosaveStatus, type AutosaveState } from '@/components/ui/autosave-status';
import { AppTextInput } from '@/components/ui/app-text-input';
import { ExpandableText } from '@/components/ui/expandable-text';
import { Space } from '@/constants/design';

export function AutosaveNote({
  accessibilityLabel,
  onSave,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  onSave: (value: string) => Promise<void>;
  placeholder: string;
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<AutosaveState>('idle');
  const [retryRevision, setRetryRevision] = useState(0);
  const onSaveRef = useRef(onSave);
  const revisionRef = useRef(0);
  const awaitingAuthoritativeRef = useRef<string | null>(null);
  const authoritativeValueRef = useRef(value);
  const savedValueRef = useRef(value);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    authoritativeValueRef.current = value;
    if (value === awaitingAuthoritativeRef.current) {
      awaitingAuthoritativeRef.current = null;
      savedValueRef.current = value;
      revisionRef.current = 0;
      setDraft(value);
      setSaveState('idle');
      return;
    }
    if (awaitingAuthoritativeRef.current !== null || revisionRef.current > 0) {
      return;
    }
    savedValueRef.current = value;
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === savedValueRef.current) return;
    const revision = revisionRef.current;
    const timer = setTimeout(() => {
      setSaveState('saving');
      void onSaveRef.current(draft)
        .then(() => {
          if (revisionRef.current === revision) {
            savedValueRef.current = draft;
            revisionRef.current = 0;
            awaitingAuthoritativeRef.current =
              authoritativeValueRef.current === draft ? null : draft;
            setSaveState('idle');
          }
        })
        .catch(() => {
          if (revisionRef.current === revision) setSaveState('failed');
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, retryRevision]);

  return (
    <View style={{ gap: Space.sm }}>
      {editing ? (
        <AppTextInput
          accessibilityLabel={accessibilityLabel}
          autoFocus
          multiline
          onBlur={() => setEditing(false)}
          onChangeText={(next) => {
            revisionRef.current += 1;
            setDraft(next);
            setSaveState('idle');
          }}
          placeholder={placeholder}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
          value={draft}
        />
      ) : (
        <ExpandableText
          accessibilityLabel={accessibilityLabel}
          onPress={() => setEditing(true)}
          placeholder={placeholder}
          value={draft}
        />
      )}
      <AutosaveStatus
        accessibilityLabel={accessibilityLabel}
        onRetry={() => {
            setSaveState('idle');
            setRetryRevision((current) => current + 1);
        }}
        state={saveState}
      />
    </View>
  );
}
