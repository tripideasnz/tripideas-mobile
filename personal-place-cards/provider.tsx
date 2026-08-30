import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSession } from '@/auth/provider';
import { ApiError } from '@/lib/api-client';
import { authorizePhotoRead } from '@/notebooks/api';
import {
  attachPersonalPlaceCardMedia,
  createPersonalPlaceCard,
  deletePersonalPlaceCard,
  listPersonalPlaceCards,
  readPersonalPlaceCard,
  removePersonalPlaceCardMedia,
  reorderPersonalPlaceCardMedia,
  updatePersonalPlaceCard,
} from './api';
import { personalPlaceCardStorage } from './storage';
import type { PersonalPlaceCard, PersonalPlaceCardInput } from './types';
import { removePersonalPlaceCard, upsertPersonalPlaceCard } from './model';

type Context = {
  authorizePhoto: (photoAssetId: string) => Promise<string>;
  cards: PersonalPlaceCard[];
  create: (input?: PersonalPlaceCardInput) => Promise<PersonalPlaceCard>;
  deleteCard: (id: string) => Promise<void>;
  get: (id?: string | null) => PersonalPlaceCard | undefined;
  isLoading: boolean;
  load: (id: string) => Promise<PersonalPlaceCard>;
  invalidatePhotoAuthorization: (photoAssetId: string) => void;
  mutate: {
    attachPhoto: (
      id: string,
      photoAssetId: string,
      role: 'main' | 'body'
    ) => Promise<PersonalPlaceCard>;
    removePhoto: (id: string, mediaId: string) => Promise<PersonalPlaceCard>;
    reorderPhotos: (id: string, mediaIds: string[]) => Promise<PersonalPlaceCard>;
    update: (id: string, input: PersonalPlaceCardInput) => Promise<PersonalPlaceCard>;
  };
  refresh: () => Promise<void>;
};

const PersonalPlaceCardContext = createContext<Context | null>(null);
const requestId = () =>
  `personal-place-card:${Date.now()}:${Math.random().toString(36).slice(2)}`;

export function PersonalPlaceCardProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const activeUser = useRef<string | null>(null);
  const cardsRef = useRef<PersonalPlaceCard[]>([]);
  const photoAuthorizationRef = useRef(new Map<string, { expiresAt: string; url: string }>());
  const photoAuthorizationInFlightRef = useRef(new Map<string, Promise<string>>());
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const [cards, setCards] = useState<PersonalPlaceCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const store = useCallback(async (ownerId: string, next: PersonalPlaceCard[]) => {
    if (activeUser.current !== ownerId) return;
    cardsRef.current = next;
    setCards(next);
    await personalPlaceCardStorage.set(ownerId, next);
  }, []);

  const storeOne = useCallback(async (ownerId: string, card: PersonalPlaceCard) => {
    const next = upsertPersonalPlaceCard(cardsRef.current, card);
    await store(ownerId, next);
    return card;
  }, [store]);

  const refresh = useCallback(() => {
    const ownerId = activeUser.current;
    if (!ownerId) return Promise.resolve();
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    setIsLoading(true);
    const request = listPersonalPlaceCards()
      .then((next) => store(ownerId, next))
      .then(() => undefined)
      .finally(() => {
        if (refreshInFlightRef.current === request) {
          refreshInFlightRef.current = null;
        }
        if (activeUser.current === ownerId) setIsLoading(false);
      });
    refreshInFlightRef.current = request;
    return request;
  }, [store]);

  const invalidatePhotoAuthorization = useCallback((photoAssetId: string) => {
    photoAuthorizationRef.current.delete(photoAssetId);
  }, []);

  const authorizePhoto = useCallback(async (photoAssetId: string) => {
    const ownerId = activeUser.current;
    if (!ownerId) throw new ApiError(401, 'mobile_session_required');
    const cached = photoAuthorizationRef.current.get(photoAssetId);
    if (cached && Date.parse(cached.expiresAt) > Date.now() + 30_000) {
      return cached.url;
    }
    const inFlight = photoAuthorizationInFlightRef.current.get(photoAssetId);
    if (inFlight) return inFlight;
    const request = authorizePhotoRead(photoAssetId)
      .then((authorization) => {
        if (activeUser.current === ownerId) {
          photoAuthorizationRef.current.set(photoAssetId, authorization);
        }
        return authorization.url;
      })
      .finally(() => {
        if (photoAuthorizationInFlightRef.current.get(photoAssetId) === request) {
          photoAuthorizationInFlightRef.current.delete(photoAssetId);
        }
      });
    photoAuthorizationInFlightRef.current.set(photoAssetId, request);
    return request;
  }, []);

  useEffect(() => {
    let mounted = true;
    activeUser.current = userId;
    cardsRef.current = [];
    photoAuthorizationRef.current.clear();
    photoAuthorizationInFlightRef.current.clear();
    refreshInFlightRef.current = null;
    setCards([]);
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void personalPlaceCardStorage.get(userId).then((cached) => {
      if (mounted && activeUser.current === userId) {
        cardsRef.current = cached;
        setCards(cached);
      }
    }).finally(() => {
      if (mounted && activeUser.current === userId) {
        void refresh().catch(() => {
          // Preserve the readable user-scoped cache when the network is unavailable.
        });
      }
    });
    return () => {
      mounted = false;
      if (activeUser.current === userId) activeUser.current = null;
    };
  }, [refresh, userId]);

  const create = useCallback(async (input: PersonalPlaceCardInput = {}) => {
    const ownerId = activeUser.current;
    if (!ownerId) throw new ApiError(401, 'mobile_session_required');
    return storeOne(ownerId, await createPersonalPlaceCard({
      clientRequestId: requestId(),
      ...input,
    }));
  }, [storeOne]);

  const load = useCallback(async (id: string) => {
    const ownerId = activeUser.current;
    if (!ownerId) throw new ApiError(401, 'mobile_session_required');
    return storeOne(ownerId, await readPersonalPlaceCard(id));
  }, [storeOne]);

  const current = (id: string) => {
    const card = cardsRef.current.find((item) => item.id === id);
    if (!card) throw new ApiError(404, 'not_found');
    return card;
  };

  const mutate = useMemo(() => ({
    update: async (id: string, input: PersonalPlaceCardInput) => {
      const ownerId = activeUser.current;
      if (!ownerId) throw new ApiError(401, 'mobile_session_required');
      return storeOne(
        ownerId,
        await updatePersonalPlaceCard(id, current(id).version, input)
      );
    },
    attachPhoto: async (
      id: string,
      photoAssetId: string,
      role: 'main' | 'body'
    ) => {
      const ownerId = activeUser.current;
      if (!ownerId) throw new ApiError(401, 'mobile_session_required');
      const card = current(id);
      return storeOne(ownerId, await attachPersonalPlaceCardMedia(id, {
        expectedVersion: card.version,
        photoAssetId,
        role,
        position: role === 'body'
          ? card.media.filter((item) => item.role === 'body').length
          : undefined,
      }));
    },
    removePhoto: async (id: string, mediaId: string) => {
      const ownerId = activeUser.current;
      if (!ownerId) throw new ApiError(401, 'mobile_session_required');
      return storeOne(
        ownerId,
        await removePersonalPlaceCardMedia(id, mediaId, current(id).version)
      );
    },
    reorderPhotos: async (id: string, mediaIds: string[]) => {
      const ownerId = activeUser.current;
      if (!ownerId) throw new ApiError(401, 'mobile_session_required');
      return storeOne(
        ownerId,
        await reorderPersonalPlaceCardMedia(id, current(id).version, mediaIds)
      );
    },
  }), [storeOne]);

  const deleteCard = useCallback(async (id: string) => {
    const ownerId = activeUser.current;
    if (!ownerId) throw new ApiError(401, 'mobile_session_required');
    await deletePersonalPlaceCard(id, current(id).version);
    await store(ownerId, removePersonalPlaceCard(cardsRef.current, id));
  }, [store]);

  const value = useMemo<Context>(() => ({
    authorizePhoto, cards, create, deleteCard,
    get: (id) => cards.find((card) => card.id === id),
    invalidatePhotoAuthorization, isLoading, load, mutate, refresh,
  }), [
    authorizePhoto,
    cards,
    create,
    deleteCard,
    invalidatePhotoAuthorization,
    isLoading,
    load,
    mutate,
    refresh,
  ]);
  return (
    <PersonalPlaceCardContext.Provider value={value}>
      {children}
    </PersonalPlaceCardContext.Provider>
  );
}

export function usePersonalPlaceCards() {
  const value = useContext(PersonalPlaceCardContext);
  if (!value) throw new Error('PersonalPlaceCardProvider is required.');
  return value;
}
