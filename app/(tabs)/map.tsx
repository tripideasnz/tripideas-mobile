import {
  Camera,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
  type LngLat,
} from '@maplibre/maplibre-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MapActiveFilter } from '@/components/map/map-active-filters';
import { MapActivitiesSheet } from '@/components/map/map-activities-sheet';
import { fitCameraToPlaces } from '@/components/map/map-bounds';
import { MapControls } from '@/components/map/map-controls';
import { MapPeekSheet } from '@/components/map/map-peek-sheet';
import { MapQuickFilters } from '@/components/map/map-quick-filters';
import { orderMapNavigation } from '@/components/map/map-region-order';
import { MapRegionsSheet } from '@/components/map/map-regions-sheet';
import { MapSavedSheet } from '@/components/map/map-saved-sheet';
import type { MapContentSelection } from '@/components/map/map-selection';
import { MapTileView } from '@/components/map/map-tile-view';
import { MAP_STYLE_URL } from '@/constants/map';
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

type MapTrayState = 'minimised' | 'peek' | 'full';

type MappablePlace = MapPlace & {
  coordinates: {
    lat: number;
    lng: number;
  };
};

function parseCoordinate(value?: string | string[]) {
  const selectedValue = Array.isArray(value) ? value[0] : value;
  const coordinate = Number(selectedValue);

  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function hasValidCoordinates(place: MapPlace): place is MappablePlace {
  return (
    Number.isFinite(place.coordinates?.lat) &&
    Number.isFinite(place.coordinates?.lng)
  );
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
  const params = useLocalSearchParams<{
    lat?: string | string[];
    lng?: string | string[];
    title?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const latitude = parseCoordinate(params.lat);
  const longitude = parseCoordinate(params.lng);
  const hasDeepLinkMarker =
    typeof latitude === 'number' && typeof longitude === 'number';

  const focusCenter: LngLat = hasDeepLinkMarker
    ? [longitude, latitude]
    : DEFAULT_CENTER;
  const focusZoom = hasDeepLinkMarker ? 13 : DEFAULT_ZOOM;

  // Tracks the last camera state so the map restores position after tile view collapses.
  const lastCameraRef = useRef({ center: focusCenter, zoom: focusZoom });

  const {
    isLoading: isLoadingSaved,
    savedPlaceIds,
  } = useSavedPlaces();
  const { isLoading: isLoadingTrips, trips } = useMyTrips();
  const [mapPlaces, setMapPlaces] = useState<MapPlace[]>([]);
  const [supplementalPlaces, setSupplementalPlaces] = useState<MapPlace[]>([]);
  const [navigation, setNavigation] = useState<MapNavigationResponse>({});
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
  const [isActivitiesSheetOpen, setIsActivitiesSheetOpen] = useState(false);
  const [isRegionsSheetOpen, setIsRegionsSheetOpen] = useState(false);
  const [isSavedSheetOpen, setIsSavedSheetOpen] = useState(false);

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
          setNavigation(orderMapNavigation(data));
        }
      })
      .catch((error) => {
        console.error(error);

        if (isMounted) {
          setNavigation({});
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

  useEffect(() => {
    if (!isMapReady || !hasDeepLinkMarker || latitude === undefined || longitude === undefined) {
      return;
    }
    cameraRef.current?.easeTo({ center: [longitude, latitude], zoom: 13, duration: 450 });
  }, [hasDeepLinkMarker, isMapReady, latitude, longitude]);

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
  const hasMatchingDeepLinkPlace =
    hasDeepLinkMarker &&
    latitude !== undefined &&
    longitude !== undefined &&
    displayedPlaces.some(
      (place) =>
        Math.abs(place.coordinates.lat - latitude) < 0.000001 &&
        Math.abs(place.coordinates.lng - longitude) < 0.000001
    );
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

  useEffect(() => {
    if (!isFitPending || !isMapReady) {
      return;
    }

    const didFit = fitCameraToPlaces(cameraRef.current, activityFilteredPlaces);

    if (didFit) {
      setIsFitPending(false);
      return;
    }

    if (!isLoadingPlaces && !isLoadingSupplemental) {
      setIsFitPending(false);
    }
  }, [
    activityFilteredPlaces,
    isFitPending,
    isMapReady,
    isLoadingPlaces,
    isLoadingSupplemental,
  ]);

  const applySelection = (nextSelection: MapContentSelection) => {
    const isDeselecting = isSameSelection(selection, nextSelection);
    const resolvedSelection: MapContentSelection = isDeselecting
      ? { type: 'all' }
      : nextSelection;

    setSelection(resolvedSelection);
    setQuery('');
    setIsFitPending(!isDeselecting);
    setIsActivitiesSheetOpen(false);
    setIsRegionsSheetOpen(false);
    setIsSavedSheetOpen(false);
    if (trayState === 'full') {
      setIsMapReady(false);
    }
    setTrayState('peek');
  };

  const toggleActivityTag = (tagId: string) => {
    setSelectedActivityTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    );
    setIsFitPending(true);
  };

  const removeActiveFilter = (filterId: string) => {
    if (filterId === 'scope') {
      setSelection({ type: 'all' });
      return;
    }

    const activityPrefix = 'activity:';
    if (filterId.startsWith(activityPrefix)) {
      toggleActivityTag(filterId.slice(activityPrefix.length));
    }
  };

  const showPlaceholder = (heading: string) => {
    Alert.alert(
      heading,
      'This control will be connected in a later map phase.'
    );
  };

  const regionSheet = (
    <MapRegionsSheet
      isLoading={isLoadingNavigation}
      navigation={navigation}
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
      onClose={() => setIsActivitiesSheetOpen(false)}
      onToggleTag={toggleActivityTag}
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
          places={displayedPlaces}
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
        mapStyle={MAP_STYLE_URL}
        touchPitch={false}
        touchRotate={false}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
        onRegionDidChange={(event) => {
          lastCameraRef.current = {
            center: event.nativeEvent.center,
            zoom: event.nativeEvent.zoom,
          };
        }}
        style={{ flex: 1 }}>
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: lastCameraRef.current.center,
            zoom: lastCameraRef.current.zoom,
          }}
        />

        {displayedPlaces.map((place) => {
          const placeKey =
            place._id ??
            place.slug?.current ??
            `${place.coordinates.lat}-${place.coordinates.lng}`;
          return (
            <Marker
              key={placeKey}
              id={placeKey}
              lngLat={[place.coordinates.lng, place.coordinates.lat]}
              onPress={() => {
                if (place.slug?.current) {
                  router.push({
                    pathname: '/place/[slug]',
                    params: { slug: place.slug.current },
                  });
                }
              }}>
              <View
                style={{
                  borderColor: '#fff',
                  borderRadius: 6,
                  borderWidth: 2,
                  backgroundColor: '#0080C8',
                  height: 12,
                  width: 12,
                }}
              />
            </Marker>
          );
        })}

        {hasDeepLinkMarker && !hasMatchingDeepLinkPlace && latitude !== undefined && longitude !== undefined ? (
          <Marker lngLat={[longitude, latitude]}>
            <View
              style={{
                borderColor: '#fff',
                borderRadius: 7,
                borderWidth: 2.5,
                backgroundColor: '#E74C3C',
                height: 14,
                width: 14,
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
      </View>

      <View
        style={{
          position: 'absolute',
          right: 12,
          top: insets.top + 62,
        }}>
        <MapControls
          onLayersPress={() => showPlaceholder('Map layers')}
          onRecenterPress={() => {
            if (
              selection.type === 'all' &&
              selectedActivityTagIds.length === 0
            ) {
              cameraRef.current?.easeTo({
                center: focusCenter,
                zoom: focusZoom,
                duration: 450,
              });
              return;
            }

            fitCameraToPlaces(cameraRef.current, activityFilteredPlaces);
          }}
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

      <View style={{ bottom: 0, left: 0, position: 'absolute', right: 0 }}>
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
          places={displayedPlaces}
          query={query}
          resultCount={displayedPlaces.length}
        />
      </View>

      {regionSheet}
      {activitiesSheet}
      {savedSheet}
    </View>
  );
}
