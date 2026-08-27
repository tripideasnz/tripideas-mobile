import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PlaceSearch } from '@/components/place-search';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { FinishEditAction } from '@/components/ui/finish-edit-action';
import { Palette, Radius, Space } from '@/constants/design';
import type { PersonalPlaceCard } from '@/personal-place-cards/types';
import type { PlaceCardData } from '@/types/content';

export type SavedPlaceSelection = { kind: 'editorial'; place: PlaceCardData } | { kind: 'personal'; card: PersonalPlaceCard };
export function SavedPlaceSelector({ cards, onCancel, onConfirm }: { cards: PersonalPlaceCard[]; onCancel: () => void; onConfirm: (selection: SavedPlaceSelection) => Promise<void> }) {
  const [selected, setSelected] = useState<SavedPlaceSelection | null>(null); const [saving, setSaving] = useState(false);
  const title = selected?.kind === 'editorial' ? selected.place.title || 'TripIdeas Place' : selected?.kind === 'personal' ? selected.card.title || 'Personal Place' : null;
  return <><View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}><AppText style={{ flex: 1 }} variant="section">Choose a Place</AppText>{selected ? <FinishEditAction accessibilityLabel="Add selected Place" onPress={() => { if (saving) return; setSaving(true); void onConfirm(selected).finally(() => setSaving(false)); }} /> : null}</View>
    {selected ? <View accessibilityLabel="Selected Place" style={{ backgroundColor: Palette.surfaceMuted, borderColor: Palette.trip, borderRadius: Radius.control, borderWidth: 2, padding: Space.md }}><AppText variant="bodyStrong">{title}</AppText><AppText color={Palette.textMuted} variant="caption">Selected — tap the checkmark to add</AppText></View> : null}
    {cards.length ? <ScrollView><AppText color={Palette.textMuted} variant="label">PERSONAL PLACES</AppText>{cards.map((card) => { const active = selected?.kind === 'personal' && selected.card.id === card.id; return <Pressable key={card.id} accessibilityLabel={`Select ${card.title || 'Personal Place'}`} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setSelected({ kind: 'personal', card })} style={({ pressed }) => ({ backgroundColor: active ? Palette.surfaceMuted : 'transparent', borderColor: active ? Palette.trip : 'transparent', borderRadius: Radius.control, borderWidth: 1, opacity: pressed ? 0.55 : 1, padding: Space.sm })}><AppText>{card.title || 'Personal Place'}</AppText></Pressable>; })}</ScrollView> : null}
    <AppText color={Palette.textMuted} variant="label">TRIPIDEAS PLACES</AppText><PlaceSearch onPlacePress={(place) => { if (place._id) setSelected({ kind: 'editorial', place }); }} /><AppButton label="Cancel" variant="secondary" onPress={onCancel} /></>;
}
