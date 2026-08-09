import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { Palette, Radius, Space } from '@/constants/design';

export type AutosaveState = 'idle' | 'saving' | 'failed';

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
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [saveState, setSaveState] = useState<AutosaveState>('idle');
  const [retryRevision, setRetryRevision] = useState(0);
  const onSaveRef = useRef(onSave);
  const revisionRef = useRef(0);
  const savedValueRef = useRef(value);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
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
        <View
          style={{
            borderColor: Palette.border,
            borderRadius: Radius.control,
            borderWidth: 1,
            gap: Space.sm,
            padding: Space.md,
          }}>
          <Pressable
            accessibilityHint="Enters note editing mode."
            accessibilityLabel={draft ? `Edit ${accessibilityLabel}` : `Add ${accessibilityLabel}`}
            accessibilityRole="button"
            onPress={() => setEditing(true)}>
            <AppText
              color={draft ? Palette.textBody : Palette.textMuted}
              numberOfLines={expanded ? undefined : 3}>
              {draft || placeholder}
            </AppText>
          </Pressable>
          {draft ? (
            <View pointerEvents="none" style={{ left: 0, opacity: 0, position: 'absolute', right: 0 }}>
              <AppText
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                onTextLayout={(event) => setOverflows(event.nativeEvent.lines.length > 3)}>
                {draft}
              </AppText>
            </View>
          ) : null}
          {overflows || expanded ? (
            <Pressable
              accessibilityLabel={expanded ? `Show less of ${accessibilityLabel}` : `Show more of ${accessibilityLabel}`}
              accessibilityRole="button"
              onPress={() => setExpanded((current) => !current)}
              style={{ alignSelf: 'flex-end' }}>
              <AppText color={Palette.textMuted} style={{ fontStyle: 'italic' }} variant="caption">
                {expanded ? '... show less' : '... show more'}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      )}
      {saveState !== 'idle' ? (
        <Pressable
          accessibilityLabel={saveState === 'failed' ? `Retry saving ${accessibilityLabel}` : undefined}
          accessibilityRole={saveState === 'failed' ? 'button' : undefined}
          disabled={saveState !== 'failed'}
          onPress={() => {
            setSaveState('idle');
            setRetryRevision((current) => current + 1);
          }}>
          <AppText
            accessibilityLiveRegion="polite"
            color={saveState === 'failed' ? Palette.danger : Palette.textMuted}
            variant="caption">
            {saveState === 'saving' ? 'Saving…' : 'Could not save. Tap to retry.'}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
