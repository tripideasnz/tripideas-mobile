// Editorial Place cards for a set of Trips' Place IDs (used by the Trips list).
//
// The cards follow the Place IDs and nothing else. A background refresh that leaves
// the IDs unchanged neither clears the cards nor asks Sanity again. A change to the
// IDs fetches the new set, a response for an outdated set is ignored, and cards for
// Places that are no longer in the Trips are never returned, even before the refetch
// has landed.
//
// `isPending` is true from the very first render for a set of IDs until its request
// has settled (success or failure), so a screen can show placeholders immediately
// instead of flipping from "nothing" to "loading" after mounting. `didFail` reports a
// settled failure for the current IDs.
import { useEffect, useMemo, useState } from 'react';

import { fetchPlaceCardsByIds } from '@/sanity/place-cards';
import type { PlaceCardData } from '@/types/content';

export function useTripPlaceCards(tripPlaceIds: string[]) {
  const key = tripPlaceIds.join('|');
  const [cards, setCards] = useState<PlaceCardData[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [settled, setSettled] = useState<{ failed: boolean; key: string } | null>(null);

  useEffect(() => {
    if (tripPlaceIds.length === 0) {
      setCards([]);
      setIsLoadingCards(false);
      return;
    }
    let isCurrent = true;
    setIsLoadingCards(true);
    fetchPlaceCardsByIds(tripPlaceIds)
      .then((data) => {
        if (isCurrent) {
          setCards(data);
          setSettled({ failed: false, key });
        }
      })
      .catch((error) => {
        console.error(error);
        if (isCurrent) {
          setCards([]);
          setSettled({ failed: true, key });
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCards(false);
      });
    return () => {
      isCurrent = false;
    };
    // The key stands for the IDs; Trip names, notes and refreshes must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const visibleCards = useMemo(() => {
    const current = new Set(tripPlaceIds);
    return cards.filter((card) => card._id !== undefined && current.has(card._id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cards]);

  const isPending = tripPlaceIds.length > 0 && settled?.key !== key;
  const didFail = settled?.key === key && settled.failed;

  return { cards: visibleCards, didFail, isLoadingCards, isPending };
}
