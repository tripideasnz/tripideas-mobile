import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersonalPlaceCard } from './types';
import { parsePersonalPlaceCard } from './api';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (userId: string) => `tripideas.personalPlaceCards.user.${userId}.v1`;

export function createPersonalPlaceCardStorage(storage: Storage = AsyncStorage) {
  return {
    async get(userId: string): Promise<PersonalPlaceCard[]> {
      const raw = await storage.getItem(key(userId));
      if (!raw) return [];
      try {
        const values = JSON.parse(raw);
        if (!Array.isArray(values)) return [];
        return values.flatMap((value) => {
          try { return [parsePersonalPlaceCard(value)]; } catch { return []; }
        });
      } catch {
        return [];
      }
    },
    async set(userId: string, cards: PersonalPlaceCard[]) {
      await storage.setItem(key(userId), JSON.stringify(cards));
    },
    async clear(userId: string) {
      await storage.removeItem(key(userId));
    },
  };
}

export const personalPlaceCardStorage = createPersonalPlaceCardStorage();
