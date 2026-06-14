import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
  type FilterSpecification,
  type GeoJSONSourceRef,
  type LngLat,
  type LngLatBounds,
  type PressEventWithFeatures,
  type ViewPadding,
} from '@maplibre/maplibre-react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NativeSyntheticEvent, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MapActiveFilter } from '@/components/map/map-active-filters';
import { MapActivitiesSheet } from '@/components/map/map-activities-sheet';
import { fitCameraToPlaces } from '@/components/map/map-bounds';
import { MapControls, MapZoomControls } from '@/components/map/map-controls';
import { MapPeekSheet } from '@/components/map/map-peek-sheet';
import { MapStyleSheet } from '@/components/map/map-style-sheet';
import { MapQuickFilters } from '@/components/map/map-quick-filters';
import { orderMapNavigation } from '@/components/map/map-region-order';
import { MapRegionsSheet } from '@/components/map/map-regions-sheet';
import { MapSavedSheet } from '@/components/map/map-saved-sheet';
import type { MapContentSelection } from '@/components/map/map-selection';
import { MapTileView } from '@/components/map/map-tile-view';
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { MAP_STYLE_URL, MAP_STYLES, type MapStyleId } from '@/constants/map';
import { Palette, Radius, Shadow, Space } from '@/constants/design';
import { useSavedPlaces } from '@/saved/provider';
import {
  fetchMapActivities,
  fetchMapNavigation,
  fetchMapPlaces,
  fetchMapPlacesByIds,
} from '@/sanity/place-cards';
import type {
  MapActivitySuperTag,
  MapNavigationResponse,
  MapPlace,
} from '@/sanity/types';
import { useMyTrips } from '@/trips/provider';

const DEFAULT_CENTER: LngLat = [174.77557, -41.28664];
const DEFAULT_ZOOM = 5;
const NZ_BOUNDS: LngLatBounds = [165.5, -47.5, 179.0, -34.0];
const QUICK_FILTERS_BAR_HEIGHT = 44;
const PEEK_SHEET_FALLBACK = 289;

type MapTrayState = 'minimised' | 'peek' | 'full';

type MappablePlace = MapPlace & {
  coordinates: {
    lat: number;
    lng: number;
  };
};

function hasValidCoordinates(place: MapPlace): place is MappablePlace {
  return (
    Number.isFinite(place.coordinates?.lat) &&
    Number.isFinite(place.coordinates?.lng)
  );
}

function parseCoordinate(value: string | undefined): number | null {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : null;
}

function matchesSearch(place: MapPlace, query: string) {
  if (!query) {
    return true;
  }

  return [
    place.title,
    place.subtitle,
    place.subRegion?.name,
    place.subRegion?.region?.name,
  ]
    .filter(Boolean)
    .some((value) => value?.toLocaleLowerCase().includes(query));
}

function matchesActivityTags(place: MapPlace, selectedTagIds: string[]) {
  if (selectedTagIds.length === 0) {
    return true;
  }

  const selectedIds = new Set(selectedTagIds);
  return (place.activityTags ?? []).some(
    (tag) => Boolean(tag._id && selectedIds.has(tag._id))
  );
}

function isSameSelection(
  left: MapContentSelection,
  right: MapContentSelection
) {
  if (left.type !== right.type) {
    return false;
  }

  if (left.type === 'region' && right.type === 'region') {
    return left.regionId === right.regionId;
  }

  if (left.type === 'subregion' && right.type === 'subregion') {
    return left.subRegionId === right.subRegionId;
  }

  if (left.type === 'trip' && right.type === 'trip') {
    return left.tripId === right.tripId;
  }

  return true;
}

type PlaceContext = { lat: number; lng: number; title: string; slug: string };

function getPlacesForSelection({
  places,
  savedPlaceIds,
  selection,
  trips,
}: {
  places: MappablePlace[];
  savedPlaceIds: string[];
  selection: MapContentSelection;
  trips: ReturnType<typeof useMyTrips>['trips'];
}) {
  if (selection.type === 'region') {
    return places.filter(
      (place) => place.subRegion?.region?._id === selection.regionId
    );
  }

  if (selection.type === 'subregion') {
    return places.filter(
      (place) => place.subRegion?._id === selection.subRegionId
    );
  }

  if (selection.type === 'favourites') {
    const savedIds = new Set(savedPlaceIds);
    return places.filter((place) => Boolean(place._id && savedIds.has(place._id)));
  }

  if (selection.type === 'trip') {
    const trip = trips.find((candidate) => candidate.id === selection.tripId);
    const tripPlaceIds = new Set(
      (trip?.places ?? []).map((place) => place.placeId)
    );
    return places.filter((place) =>
      Boolean(place._id && tripPlaceIds.has(place._id))
    );
  }

  return places;
}

export default function MapScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);

  // Tracks the last camera state so the map restores position after tile view collapses.
  const lastCameraRef = useRef({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });

  // URL params are the arrival signal — read-only, never written back.
  const { lat: rawLat, lng: rawLng, title: rawTitle, slug: rawSlug, tripId: rawTripId, tripLabel: rawTripLabel } =
    useLocalSearchParams<{ lat?: string; lng?: string; title?: string; slug?: string; tripId?: string; tripLabel?: string }>();

  // Place context lives in local state; URL params only trigger it on focus.
  const [placeContext, setPlaceContext] = useState<PlaceContext | null>(null);
  const hasPlaceContext = placeContext !== null;

  const {
    isLoading: isLoadingSaved,
    savedPlaceIds,
  } = useSavedPlaces();
  const { isLoading: isLoadingTrips, trips } = useMyTrips();
  const [mapPlaces, setMapPlaces] = useState<MapPlace[]>([]);
  const [supplementalPlaces, setSupplementalPlaces] = useState<MapPlace[]>([]);
  const [navigation2, setNavigation2] = useState<MapNavigationResponse>({});
  const [activities, setActivities] = useState<MapActivitySuperTag[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [isLoadingNavigation, setIsLoadingNavigation] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingSupplemental, setIsLoadingSupplemental] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [trayState, setTrayState] = useState<MapTrayState>('peek');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<MapContentSelection>({
    type: 'all',
  });
  const [selectedActivityTagIds, setSelectedActivityTagIds] = useState<
    string[]
  >([]);
  const [isFitPending, setIsFitPending] = useState(false);
  const [fitResetTrigger, setFitResetTrigger] = useState(0);
  const hasInitialFittedRef = useRef(false);
  const prevPeekSheetHeightRef = useRef(0);
  const mapPaddingRef = useRef<ViewPadding>({ top: 0, right: 56, bottom: PEEK_SHEET_FALLBACK + 16, left: 56 });
  const displayedPlacesRef = useRef<MappablePlace[]>([]);
  const [peekSheetHeight, setPeekSheetHeight] = useState(0);
  const [isActivitiesSheetOpen, setIsActivitiesSheetOpen] = useState(false);
  const [isRegionsSheetOpen, setIsRegionsSheetOpen] = useState(false);
  const [isSavedSheetOpen, setIsSavedSheetOpen] = useState(false);
  const [isStyleSheetOpen, setIsStyleSheetOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [mapStyleId, setMapStyleId] = useState<MapStyleId>('streets');
  const [visibleBounds, setVisibleBounds] = useState<LngLatBounds | null>(null);

  // Activate place context from URL params on focus; clear local state on blur.
  // Trip selection from URL params is applied once then the param is cleared so
  // re-focusing the tab does not toggle the selection off.
  // Never writes back to route params (rules 1 & 2).
  useFocusEffect(
    useCallback(() => {
      const lat = parseCoordinate(rawLat);
      const lng = parseCoordinate(rawLng);
      if (lat !== null && lng !== null && rawSlug) {
        setPlaceContext({ lat, lng, title: rawTitle ?? '', slug: rawSlug });
      }

      if (rawTripId) {
        setSelection({ type: 'trip', tripId: rawTripId, label: rawTripLabel ?? rawTripId });
        setIsFitPending(true);
        setTrayState('peek');
        router.setParams({ tripId: undefined, tripLabel: undefined } as any);
      }

      return () => {
        setPlaceContext(null);
        // Trip selection intentionally persists across tab switches.
      };
    }, [rawLat, rawLng, rawTitle, rawSlug, rawTripId, rawTripLabel])
  );

  // Dismiss local place context; never touches route params (rule 5).
  const clearPlaceContext = useCallback(() => {
    setPlaceContext(null);
    setSelectedPlaceId(null);
  }, []);

  // Navigate back to the originating place using the preserved slug (rule 4).
  const handlePlaceContextBack = useCallback(() => {
    if (placeContext?.slug) {
      router.push({ pathname: '/place/[slug]', params: { slug: placeContext.slug } });
    }
  }, [placeContext, router]);

  // Exit rule 2: re-tapping the Map tab while already on it resets place context and filters,
  // clears URL params so useFocusEffect doesn't re-hydrate on next focus, and schedules
  // a camera fit via fitResetTrigger (useEffect fires after commit; raw event handler calls drop).
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', () => {
      if (!(navigation as any).isFocused()) return;
      const isResetting =
        hasPlaceContext || selection.type !== 'all' || selectedActivityTagIds.length > 0;
      if (!isResetting) return;
      console.log('[Map] tab re-press reset: clearing place context and fitting full map');
      // Clear URL params so useFocusEffect sees null coords on next focus and does not
      // re-activate place context when the user leaves and returns to this tab.
      router.setParams({ lat: undefined, lng: undefined, title: undefined, slug: undefined, tripId: undefined, tripLabel: undefined } as any);
      setPlaceContext(null);
      setSelectedPlaceId(null);
      setSelection({ type: 'all' });
      setSelectedActivityTagIds([]);
      setFitResetTrigger((n) => n + 1);
    });
    return unsubscribe;
  }, [navigation, hasPlaceContext, selection, selectedActivityTagIds, router]);

  // Animate camera to the focused place when context is active and map is ready.
  useEffect(() => {
    if (!placeContext || !isMapReady) return;
    cameraRef.current?.easeTo({
      center: [placeContext.lng, placeContext.lat] as LngLat,
      zoom: 13,
      duration: 500,
    });
  }, [placeContext, isMapReady]);

  useEffect(() => {
    let isMounted = true;

    setIsLoadingPlaces(true);
    setIsLoadingNavigation(true);
    setIsLoadingActivities(true);
    setErrorMessage(null);

    fetchMapPlaces()
      .then((data) => {
        if (isMounted) {
          setMapPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setMapPlaces([]);
          setErrorMessage('Unable to load map places right now.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingPlaces(false);
        }
      });

    fetchMapNavigation()
      .then((data) => {
        if (isMounted) {
          setNavigation2(orderMapNavigation(data));
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setNavigation2({});
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingNavigation(false);
        }
      });

    fetchMapActivities()
      .then((data) => {
        if (isMounted) {
          setActivities(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setActivities([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingActivities(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const storedPlaceIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...savedPlaceIds,
          ...trips.flatMap((trip) =>
            trip.places.map((place) => place.placeId)
          ),
        ])
      ),
    [savedPlaceIds, trips]
  );
  const storedPlaceIdsKey = storedPlaceIds.join('|');

  useEffect(() => {
    if (isLoadingSaved || isLoadingTrips || storedPlaceIds.length === 0) {
      setSupplementalPlaces([]);
      setIsLoadingSupplemental(false);
      return;
    }

    let isMounted = true;

    setIsLoadingSupplemental(true);

    fetchMapPlacesByIds(storedPlaceIds)
      .then((data) => {
        if (isMounted) {
          setSupplementalPlaces(data);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setSupplementalPlaces([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSupplemental(false);
        }
      });

    return () => {
      isMounted = false;
    };
    // IDs are the stable dependency; trip notes and names do not require refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingSaved, isLoadingTrips, storedPlaceIdsKey]);

  const availablePlaces = useMemo(() => {
    const placesById = new Map<string, MapPlace>();

    supplementalPlaces.forEach((place) => {
      if (place._id) {
        placesById.set(place._id, place);
      }
    });
    mapPlaces.forEach((place) => {
      if (place._id) {
        placesById.set(place._id, place);
      }
    });

    return Array.from(placesById.values()).filter(hasValidCoordinates);
  }, [mapPlaces, supplementalPlaces]);

  const selectedPlaces = useMemo(
    () =>
      getPlacesForSelection({
        places: availablePlaces,
        savedPlaceIds,
        selection,
        trips,
      }),
    [availablePlaces, savedPlaceIds, selection, trips]
  );
  const activityFilteredPlaces = useMemo(
    () =>
      selectedPlaces.filter((place) =>
        matchesActivityTags(place, selectedActivityTagIds)
      ),
    [selectedActivityTagIds, selectedPlaces]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const displayedPlaces = useMemo(
    () =>
      activityFilteredPlaces.filter((place) =>
        matchesSearch(place, normalizedQuery)
      ),
    [activityFilteredPlaces, normalizedQuery]
  );

  // Subset of displayedPlaces that falls within the current map viewport.
  // Falls back to the full filtered set until the first region-change event fires.
  const visiblePlaces = useMemo(() => {
    if (!visibleBounds) return displayedPlaces;
    const [west, south, east, north] = visibleBounds;
    return displayedPlaces.filter(
      (place) =>
        place.coordinates.lng >= west &&
        place.coordinates.lng <= east &&
        place.coordinates.lat >= south &&
        place.coordinates.lat <= north
    );
  }, [displayedPlaces, visibleBounds]);

  const placesGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: displayedPlaces.map((place) => {
      const featureId =
        place._id ??
        place.slug?.current ??
        `${place.coordinates.lat}-${place.coordinates.lng}`;
      const slugCurrent = place.slug?.current ?? null;
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [place.coordinates.lng, place.coordinates.lat],
        },
        properties: {
          id: featureId,
          slug: slugCurrent,
          isSelected: featureId === selectedPlaceId,
          isFocused: placeContext !== null && slugCurrent === placeContext.slug,
        },
      };
    }),
  }), [displayedPlaces, selectedPlaceId, placeContext]);

  // True when the focused place appears in the dataset (can be highlighted via layer paint).
  const hasFocusedInDataset =
    placeContext !== null &&
    displayedPlaces.some((p) => p.slug?.current === placeContext.slug);

  const handleSourcePress = async (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    event.stopPropagation();
    const feature = event.nativeEvent.features[0];
    if (!feature || feature.geometry.type !== 'Point') return;

    const { properties, geometry } = feature;
    const coords = geometry.coordinates as [number, number];

    if (properties?.cluster_id !== undefined) {
      const expansionZoom = await sourceRef.current?.getClusterExpansionZoom(
        properties.cluster_id as number
      );
      // Cap the jump to +3 zoom levels per tap for a smooth progressive expansion.
      const targetZoom =
        expansionZoom !== undefined
          ? Math.min(expansionZoom, lastCameraRef.current.zoom + 3)
          : lastCameraRef.current.zoom + 2;
      cameraRef.current?.easeTo({ center: coords, zoom: targetZoom, duration: 400 });
      return;
    }

    const id = properties?.id as string | null;
    const slug = properties?.slug as string | null;

    if (id && id === selectedPlaceId) {
      // Second tap on the same pin — open place detail.
      if (slug) router.push({ pathname: '/place/[slug]', params: { slug } });
      return;
    }

    // First tap — select and recenter. Don't navigate yet.
    setSelectedPlaceId(id);
    const targetZoom = Math.max(lastCameraRef.current.zoom, 12);
    cameraRef.current?.easeTo({ center: coords, zoom: targetZoom, duration: 350 });
  };

  const isLoading =
    isLoadingPlaces ||
    isLoadingSaved ||
    isLoadingTrips ||
    isLoadingSupplemental;
  const activeFilters = useMemo<MapActiveFilter[]>(() => {
    const filters: MapActiveFilter[] = [];

    if (selection.type === 'region' || selection.type === 'subregion') {
      filters.push({
        id: 'scope',
        label: selection.label,
      });
    } else if (selection.type === 'favourites') {
      filters.push({
        id: 'scope',
        label: 'Favourites',
      });
    } else if (selection.type === 'trip') {
      filters.push({
        id: 'scope',
        label: selection.label,
      });
    }

    const activityTags = activities.flatMap((activity) => activity.tags ?? []);
    selectedActivityTagIds.forEach((tagId) => {
      const tag = activityTags.find((candidate) => candidate._id === tagId);

      if (tag?.name) {
        filters.push({
          id: `activity:${tagId}`,
          label: tag.name,
        });
      }
    });

    return filters;
  }, [activities, selectedActivityTagIds, selection]);

  const mapPadding: ViewPadding = useMemo(
    () => ({
      top: insets.top + QUICK_FILTERS_BAR_HEIGHT,
      right: 56,
      bottom: (peekSheetHeight > 0 ? peekSheetHeight : PEEK_SHEET_FALLBACK) + 16,
      left: 56,
    }),
    [insets.top, peekSheetHeight]
  );
  // Keep refs current so the tabPress handler always reads the latest values without
  // needing to add these to its own deps (which would resubscribe on every render).
  useEffect(() => { mapPaddingRef.current = mapPadding; }, [mapPadding]);
  useEffect(() => { displayedPlacesRef.current = displayedPlaces; }, [displayedPlaces]);

  useEffect(() => {
    if (!isFitPending || !isMapReady) {
      return;
    }

    const didFit = fitCameraToPlaces(cameraRef.current, activityFilteredPlaces, mapPadding);

    if (didFit) {
      setIsFitPending(false);
      return;
    }

    if (!isLoadingPlaces && !isLoadingSupplemental) {
      // No places in the filtered set — fall back to NZ overview.
      if (activityFilteredPlaces.length === 0) {
        cameraRef.current?.fitBounds(NZ_BOUNDS, { padding: mapPadding, duration: 450 });
      }
      setIsFitPending(false);
    }
  }, [
    activityFilteredPlaces,
    isFitPending,
    isMapReady,
    isLoadingPlaces,
    isLoadingSupplemental,
    mapPadding,
  ]);

  // Dedicated camera reset triggered by the Map tab re-press dismiss.
  // Uses a useEffect (not a raw event handler) so the camera command is issued
  // after React commits, which is required for MapLibre bridge commands to fire.
  useEffect(() => {
    if (fitResetTrigger === 0 || !isMapReady) return;
    const places = displayedPlacesRef.current;
    const padding = mapPaddingRef.current;
    if (places.length > 0) {
      fitCameraToPlaces(cameraRef.current, places, padding);
    } else {
      cameraRef.current?.fitBounds(NZ_BOUNDS, { padding, duration: 450 });
    }
  }, [fitResetTrigger, isMapReady]);

  useEffect(() => {
    if (
      !isMapReady ||
      isLoadingPlaces ||
      hasInitialFittedRef.current ||
      peekSheetHeight === 0 ||
      hasPlaceContext
    ) {
      return;
    }

    hasInitialFittedRef.current = true;

    if (displayedPlaces.length > 0) {
      fitCameraToPlaces(cameraRef.current, displayedPlaces, mapPadding);
    }
  }, [isMapReady, isLoadingPlaces, displayedPlaces, peekSheetHeight, mapPadding, hasPlaceContext]);

  useEffect(() => {
    if (!hasInitialFittedRef.current || !isMapReady || peekSheetHeight === 0) return;
    if (peekSheetHeight === prevPeekSheetHeightRef.current) return;
    if (hasPlaceContext) return;
    prevPeekSheetHeightRef.current = peekSheetHeight;
    fitCameraToPlaces(cameraRef.current, displayedPlaces, mapPadding);
  }, [peekSheetHeight, isMapReady, displayedPlaces, mapPadding, hasPlaceContext]);

  const applySelection = (nextSelection: MapContentSelection) => {
    // Exit rule 3: choosing a map filter clears the place context.
    clearPlaceContext();

    const isDeselecting = isSameSelection(selection, nextSelection);
    const resolvedSelection: MapContentSelection = isDeselecting
      ? { type: 'all' }
      : nextSelection;

    setSelection(resolvedSelection);
    setQuery('');
    setIsFitPending(true);
    setIsActivitiesSheetOpen(false);
    setIsRegionsSheetOpen(false);
    setIsSavedSheetOpen(false);
    if (trayState === 'full') {
      setIsMapReady(false);
    }
    setTrayState('peek');
  };

  const toggleActivityTag = (tagId: string) => {
    // Exit rule 3: choosing a map filter clears the place context.
    clearPlaceContext();

    setSelectedActivityTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
    setIsFitPending(true);
  };

  const applyActivityTags = (tagIds: string[]) => {
    clearPlaceContext();
    setSelectedActivityTagIds(tagIds);
    setIsFitPending(true);
    setIsActivitiesSheetOpen(false);
    if (trayState === 'full') setIsMapReady(false);
    setTrayState('peek');
  };

  const removeActiveFilter = (filterId: string) => {
    if (filterId === 'scope') {
      setSelection({ type: 'all' });
      setIsFitPending(true);
      return;
    }

    const activityPrefix = 'activity:';
    if (filterId.startsWith(activityPrefix)) {
      toggleActivityTag(filterId.slice(activityPrefix.length));
    }
  };

  const regionSheet = (
    <MapRegionsSheet
      isLoading={isLoadingNavigation}
      navigation={navigation2}
      onClose={() => setIsRegionsSheetOpen(false)}
      onSelect={applySelection}
      selection={selection}
      visible={isRegionsSheetOpen}
    />
  );
  const activitiesSheet = (
    <MapActivitiesSheet
      activities={activities}
      isLoading={isLoadingActivities}
      onApply={applyActivityTags}
      onClose={() => setIsActivitiesSheetOpen(false)}
      selectedTagIds={selectedActivityTagIds}
      visible={isActivitiesSheetOpen}
    />
  );
  const savedSheet = (
    <MapSavedSheet
      onClose={() => setIsSavedSheetOpen(false)}
      onSelect={applySelection}
      selection={selection}
      trips={trips}
      visible={isSavedSheetOpen}
    />
  );

  if (trayState === 'full') {
    return (
      <>
        <MapTileView
          activeFilters={activeFilters}
          isLoading={isLoading}
          onCollapse={() => {
            setIsMapReady(false);
            setIsFitPending(true);
            setTrayState('peek');
          }}
          onRegionsPress={() => setIsRegionsSheetOpen(true)}
          onQueryChange={setQuery}
          onRemoveFilter={removeActiveFilter}
          places={visiblePlaces}
          query={query}
          selectedFilterCount={
            selection.type === 'region' || selection.type === 'subregion'
              ? 1
              : 0
          }
        />
        {regionSheet}
        {activitiesSheet}
        {savedSheet}
      </>
    );
  }

  return (
    <View style={{ backgroundColor: '#fff', flex: 1 }}>
      <MapLibreMap
        mapStyle={MAP_STYLES.find((s) => s.id === mapStyleId)?.url ?? MAP_STYLE_URL}
        touchPitch={false}
        touchRotate={false}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
        onPress={() => setSelectedPlaceId(null)}
        onRegionDidChange={(event) => {
          lastCameraRef.current = {
            center: event.nativeEvent.center,
            zoom: event.nativeEvent.zoom,
          };
          setVisibleBounds(event.nativeEvent.bounds);
        }}
        style={{ flex: 1 }}>
        <Camera
          ref={cameraRef}
          initialViewState={
            placeContext
              ? { center: [placeContext.lng, placeContext.lat] as LngLat, zoom: 13 }
              : hasInitialFittedRef.current
                ? { center: lastCameraRef.current.center, zoom: lastCameraRef.current.zoom }
                : {
                    bounds: NZ_BOUNDS,
                    padding: {
                      top: insets.top + QUICK_FILTERS_BAR_HEIGHT,
                      right: 56,
                      bottom: PEEK_SHEET_FALLBACK,
                      left: 56,
                    },
                  }
          }
        />

        <GeoJSONSource
          ref={sourceRef}
          id="places"
          data={placesGeoJSON}
          cluster
          clusterRadius={50}
          clusterMaxZoom={12}
          onPress={handleSourcePress}>
          <Layer
            type="circle"
            id="place-clusters"
            filter={['has', 'point_count'] as FilterSpecification}
            paint={{
              'circle-color': '#0080C8',
              'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 24] as unknown as number,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
              'circle-opacity': 0.9,
            }}
          />
          <Layer
            type="symbol"
            id="place-cluster-count"
            filter={['has', 'point_count'] as FilterSpecification}
            layout={{
              'text-field': '{point_count}',
              'text-size': 13,
              'text-font': ['Noto Sans Regular'],
            }}
            paint={{ 'text-color': '#fff' }}
          />
          <Layer
            type="circle"
            id="place-points"
            filter={['!', ['has', 'point_count']] as FilterSpecification}
            paint={{
              'circle-radius': [
                'case',
                ['boolean', ['get', 'isFocused'], false], 11,
                ['boolean', ['get', 'isSelected'], false], 10,
                7,
              ] as unknown as number,
              'circle-color': [
                'case',
                ['boolean', ['get', 'isFocused'], false], '#E74C3C',
                ['boolean', ['get', 'isSelected'], false], '#005FA3',
                '#0080C8',
              ] as unknown as string,
              'circle-stroke-width': [
                'case',
                ['boolean', ['get', 'isFocused'], false], 3,
                ['boolean', ['get', 'isSelected'], false], 3,
                2,
              ] as unknown as number,
              'circle-stroke-color': '#fff',
            }}
          />
        </GeoJSONSource>

        {/* Fallback marker when the focused place is not in the main dataset */}
        {placeContext && !hasFocusedInDataset ? (
          <Marker
            lngLat={[placeContext.lng, placeContext.lat]}
            anchor="center">
            <View
              style={{
                backgroundColor: '#E74C3C',
                borderColor: '#fff',
                borderRadius: 8,
                borderWidth: 3,
                height: 16,
                width: 16,
              }}
            />
          </Marker>
        ) : null}

      </MapLibreMap>

      <View
        pointerEvents="box-none"
        style={{
          left: 0,
          position: 'absolute',
          right: 0,
          top: insets.top + 10,
        }}>
        {hasPlaceContext ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: Radius.control,
              flexDirection: 'row',
              marginHorizontal: Space.lg,
              paddingRight: Space.md,
              ...Shadow.floating,
            }}>
            <HeaderBackButton onPress={handlePlaceContextBack} />
            <Pressable
              onPress={handlePlaceContextBack}
              style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: Palette.text,
                  fontSize: 15,
                  fontWeight: '600',
                }}>
                {placeContext?.title || 'Place'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <MapQuickFilters
            isActivitiesSelected={selectedActivityTagIds.length > 0}
            isRegionsSelected={
              selection.type === 'region' || selection.type === 'subregion'
            }
            isSavedSelected={
              selection.type === 'favourites' || selection.type === 'trip'
            }
            onActivitiesPress={() => setIsActivitiesSheetOpen(true)}
            onRegionsPress={() => setIsRegionsSheetOpen(true)}
            onSavedPress={() => setIsSavedSheetOpen(true)}
          />
        )}
      </View>

      <View
        style={{
          position: 'absolute',
          right: 12,
          top: insets.top + 62,
        }}>
        <MapControls
          onLayersPress={() => setIsStyleSheetOpen(true)}
          onRecenterPress={() => {
            if (placeContext) {
              cameraRef.current?.easeTo({
                center: [placeContext.lng, placeContext.lat] as LngLat,
                zoom: 13,
                duration: 450,
              });
              return;
            }

            if (
              selection.type === 'all' &&
              selectedActivityTagIds.length === 0
            ) {
              cameraRef.current?.easeTo({
                center: DEFAULT_CENTER,
                zoom: DEFAULT_ZOOM,
                duration: 450,
              });
              return;
            }

            fitCameraToPlaces(cameraRef.current, activityFilteredPlaces, mapPadding);
          }}
        />
      </View>

      <View
        style={{
          bottom: (peekSheetHeight > 0 ? peekSheetHeight : PEEK_SHEET_FALLBACK) + 16,
          position: 'absolute',
          right: 12,
        }}>
        <MapZoomControls
          onZoomInPress={() =>
            cameraRef.current?.zoomTo(lastCameraRef.current.zoom + 1, { duration: 250 })
          }
          onZoomOutPress={() =>
            cameraRef.current?.zoomTo(lastCameraRef.current.zoom - 1, { duration: 250 })
          }
        />
      </View>

      {errorMessage ? (
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderRadius: 10,
            left: 16,
            padding: 12,
            position: 'absolute',
            right: 16,
            top: insets.top + 122,
          }}>
          <Text style={{ color: '#717171', fontSize: 14, textAlign: 'center' }}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <View
        onLayout={(e) => setPeekSheetHeight(e.nativeEvent.layout.height)}
        style={{ bottom: 0, left: 0, position: 'absolute', right: 0 }}>
        <MapPeekSheet
          activeFilters={activeFilters}
          isLoading={isLoading}
          isMinimised={trayState === 'minimised'}
          onHandlePress={() =>
            setTrayState((current) => {
              if (current === 'minimised') {
                return 'peek';
              }

              setIsMapReady(false);
              return 'full';
            })
          }
          onMinimise={() => setTrayState('minimised')}
          onQueryChange={setQuery}
          onRemoveFilter={removeActiveFilter}
          places={visiblePlaces}
          query={query}
          resultCount={visiblePlaces.length}
        />
      </View>

      {regionSheet}
      {activitiesSheet}
      {savedSheet}
      <MapStyleSheet
        activeStyleId={mapStyleId}
        onClose={() => setIsStyleSheetOpen(false)}
        onSelectStyle={setMapStyleId}
        visible={isStyleSheetOpen}
      />
    </View>
  );
}
