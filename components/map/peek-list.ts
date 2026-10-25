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

/** Index of the selected place in the list, or -1. */
export const indexOfSelectedPlace = (
  places: readonly { _id?: string; slug?: { current?: string } }[],
  selectedPlaceId: string | null
) =>
  selectedPlaceId === null
    ? -1
    : places.findIndex((place) => (place._id ?? place.slug?.current) === selectedPlaceId);
