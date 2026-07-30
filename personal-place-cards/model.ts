import type { PersonalPlaceCard } from './types';

export function hasAttachedPhoto(card: PersonalPlaceCard, photoAssetId: string) {
  return card.media.some((item) => item.photoAssetId === photoAssetId);
}

export function upsertPersonalPlaceCard(
  cards: PersonalPlaceCard[],
  card: PersonalPlaceCard
) {
  return cards.some((item) => item.id === card.id)
    ? cards.map((item) => item.id === card.id ? card : item)
    : [card, ...cards];
}

export function removePersonalPlaceCard(cards: PersonalPlaceCard[], id: string) {
  return cards.filter((card) => card.id !== id);
}
