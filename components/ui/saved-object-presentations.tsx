import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Linking from 'expo-linking';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { CompletedPlace } from '@/components/ui/completed-place';
import { SavedObjectIcons } from '@/components/ui/saved-object-icons';
import { ShowMoreText } from '@/components/ui/show-more-text';
import { Palette, Space } from '@/constants/design';
import { urlDomain } from '@/lib/url';

export type SavedPlaceKind = 'editorial' | 'personal';

export function savedPlaceLabel(kind: SavedPlaceKind) {
  return kind === 'personal' ? 'PERSONAL PLACE' : 'TRIPIDEAS PLACE';
}

export function SavedLinkObject({ note, title, url }: { note?: string | null; title?: string | null; url: string }) {
  const displayTitle = title || urlDomain(url);
  return <View style={{ gap: Space.xs }}>
    <Pressable accessibilityLabel={`Open ${displayTitle}`} accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.55 : 1 })}>
      <AppText color={Palette.trip} style={{ textDecorationLine: 'underline' }} variant="bodyStrong">{displayTitle}</AppText>
    </Pressable>
    <AppText color={Palette.textMuted} numberOfLines={1} variant="caption">{urlDomain(url)}</AppText>
    {note ? <ShowMoreText accessibilityLabel={`${displayTitle} note`} value={note} /> : null}
  </View>;
}

export function SavedPlaceObject({ available = true, kind = 'editorial', onPress, showLabel = true, title }: { available?: boolean; kind?: SavedPlaceKind; onPress?: () => void; showLabel?: boolean; title: string }) {
  return <View style={{ gap: Space.xs }}>{showLabel ? <AppText color={Palette.textMuted} variant="label">{savedPlaceLabel(kind)}</AppText> : null}<CompletedPlace available={available} icon={kind === 'personal' ? SavedObjectIcons.personalPlace : SavedObjectIcons.tripIdeasPlace} onPress={available ? onPress : undefined} title={title} /></View>;
}

export function SavedPinObject({ detail, onShowMap, title }: { detail?: string | null; onShowMap?: () => void; title?: string | null }) {
  const displayTitle = title || 'Saved Pin';
  const titleContent = <AppText color={onShowMap ? Palette.trip : Palette.text} variant="bodyStrong">{displayTitle}</AppText>;
  return <View><View style={{ alignItems: 'center', flexDirection: 'row', gap: Space.sm }}>
    <MaterialIcons color={Palette.trip} name={SavedObjectIcons.pin} size={20} />
    <View style={{ flex: 1 }}>{onShowMap ? <Pressable accessibilityLabel={`Show ${displayTitle} on map`} accessibilityRole="link" onPress={onShowMap}>{titleContent}</Pressable> : titleContent}{detail ? <AppText color={Palette.textMuted} variant="caption">{detail}</AppText> : null}</View>
  </View></View>;
}
