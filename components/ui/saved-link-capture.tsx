import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AppTextInput } from '@/components/ui/app-text-input';
import { Palette, Space } from '@/constants/design';
import { generatedLinkTitle, linkSearchUrl, shouldOfferClipboardLink, validClipboardLink } from '@/lib/saved-link-capture';

export function SavedLinkCapture({ onCancel, onSave }: {
  onCancel: () => void;
  onSave: (input: { title: string; url: string }) => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [candidateUrl, setCandidateUrl] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const searchActive = useRef(false);
  const leftApp = useRef(false);
  const seenClipboardValues = useRef(new Set<string>());

  const accept = (url: string) => {
    const normalized = url.trim();
    setSelectedUrl(normalized);
    setLinkTitle(generatedLinkTitle(normalized));
    setCandidateUrl(null);
    searchActive.current = false;
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (!searchActive.current) return;
      if (state !== 'active') { leftApp.current = true; return; }
      if (!leftApp.current) return;
      leftApp.current = false;
      void Clipboard.getStringAsync().then((clipboard) => {
        const url = shouldOfferClipboardLink({ clipboard, returnedFromBrowser: true, searchActive: searchActive.current, seen: seenClipboardValues.current });
        if (!url) return;
        seenClipboardValues.current.add(url);
        setCandidateUrl(url);
      }).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  if (selectedUrl) {
    return <View accessibilityLabel="Selected link" style={{ gap: Space.md }}>
      <AppText variant="section">Confirm Link</AppText>
      <AppText variant="label">Name</AppText>
      <AppTextInput accessibilityLabel="Link title" maxLength={200} onChangeText={setLinkTitle} placeholder={generatedLinkTitle(selectedUrl)} value={linkTitle} />
      <AppText color={Palette.trip} numberOfLines={2}>{selectedUrl}</AppText>
      <AppButton accessibilityLabel="Save Link" disabled={saving} label="Save Link" onPress={() => {
        setSaving(true);
        void onSave({ title: linkTitle.trim() || generatedLinkTitle(selectedUrl), url: selectedUrl }).finally(() => setSaving(false));
      }} />
      <AppButton label="Change Link" variant="secondary" onPress={() => { setSelectedUrl(null); setLinkTitle(''); }} />
      <AppButton label="Cancel" variant="secondary" onPress={onCancel} />
    </View>;
  }

  if (candidateUrl) {
    return <View accessibilityLabel="Copied link candidate" style={{ gap: Space.md }}>
      <AppText variant="section">Use this link?</AppText>
      <AppText color={Palette.trip} numberOfLines={2}>{candidateUrl}</AppText>
      <AppButton accessibilityLabel="Use copied Link" label="Use Link" onPress={() => accept(candidateUrl)} />
      <AppButton accessibilityLabel="Reject copied Link" label="Cancel" variant="secondary" onPress={() => setCandidateUrl(null)} />
    </View>;
  }

  const trimmed = searchQuery.trim();
  return <View style={{ gap: Space.md }}>
    <AppText variant="section">Find a link</AppText>
    <AppTextInput accessibilityLabel="Search words or URL" autoCapitalize="none" autoCorrect={false} autoFocus onChangeText={(value) => {
      setSearchQuery(value);
      const directUrl = validClipboardLink(value);
      if (directUrl) accept(directUrl);
    }} placeholder="Search words or https://…" value={searchQuery} />
    <AppText color={Palette.textMuted} variant="caption">Enter search words, or paste a complete web address.</AppText>
    <AppButton accessibilityState={{ disabled: !trimmed }} disabled={!trimmed} label="Open web" variant="secondary" onPress={() => {
      if (!trimmed) return;
      searchActive.current = true;
      leftApp.current = false;
      void Linking.openURL(linkSearchUrl(trimmed));
    }} />
    <AppButton label="Cancel" variant="secondary" onPress={onCancel} />
  </View>;
}
