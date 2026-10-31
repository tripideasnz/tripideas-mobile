// Layout maths for the virtualised peek-sheet thumbnail list.

export const PEEK_ITEM_WIDTH = 142;

/** Fixed-size items let the list skip measuring and jump straight to an index. */
export const peekItemLayout = (index: number, gap: number) => ({
  index,
  length: PEEK_ITEM_WIDTH,
  offset: index * (PEEK_ITEM_WIDTH + gap),
});

/** Same alignment as before: the selected item sits just inside the left edge. */
export const peekScrollOffset = (index: number, gap: number) =>
  Math.max(0, index * (PEEK_ITEM_WIDTH + gap) - gap);

/**
 * Scroll offset that puts the item at `index` in the middle of the visible list,
 * kept within the list's own ends so the first and last items never leave a gap.
 */
export const peekCenteredOffset = (index: number, gap: number, viewportWidth: number, count: number) => {
  const step = PEEK_ITEM_WIDTH + gap;
  const maxOffset = Math.max(0, count * step - gap - viewportWidth);
  const centred = index * step - (viewportWidth - PEEK_ITEM_WIDTH) / 2;
  return Math.min(maxOffset, Math.max(0, centred));
};

/** Index of the selected place in the list, or -1. */
export const indexOfSelectedPlace = (
  places: readonly { _id?: string; slug?: { current?: string } }[],
  selectedPlaceId: string | null
) =>
  selectedPlaceId === null
    ? -1
    : places.findIndex((place) => (place._id ?? place.slug?.current) === selectedPlaceId);
