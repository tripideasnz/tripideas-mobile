import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fitMapToPlaces } from '@/components/map/map-bounds';
import { MapControls } from '@/components/map/map-controls';
import { MapPeekSheet } from '@/components/map/map-peek-sheet';
import { MapQuickFilters } from '@/components/map/map-quick-filters';
import { orderMapNavigation } from '@/components/map/map-region-order';
import { MapRegionsSheet } from '@/components/map/map-regions-sheet';
import { MapSavedSheet } from '@/components/map/map-saved-sheet';
import type { MapContentSelection } from '@/components/map/map-selection';
import { MapTileView } from '@/components/map/map-tile-view';
import { useSavedPlaces } from '@/saved/provider';
import {
  fetchMapNavigation,
  fetchMapPlaces,
  fetchPlaceCardsByIds,
} from '@/sanity/place-cards';
import type { MapNavigationResponse, MapPlace } from '@/sanity/types';
import { useMyTrips } from '@/trips/provider';

const DEFAULT_REGION: Region = {
  latitude: -41.28664,
  longitude: 174.77557,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

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
  const params = useLocalSearchParams<{
    lat?: string | string[];
    lng?: string | string[];
    title?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const latitude = parseCoordinate(params.lat);
  const longitude = parseCoordinate(params.lng);
  const title = Array.isArray(params.title) ? params.title[0] : params.title;
  const hasDeepLinkMarker =
    typeof latitude === 'number' && typeof longitude === 'number';
  const focusRegion = useMemo<Region>(
    () =>
      hasDeepLinkMarker
        ? {
            latitude,
            longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }
        : DEFAULT_REGION,
    [hasDeepLinkMarker, latitude, longitude]
  );
  const {
    isLoading: isLoadingSaved,
    savedPlaceIds,
  } = useSavedPlaces();
  const { isLoading: isLoadingTrips, trips } = useMyTrips();
  const [mapPlaces, setMapPlaces] = useState<MapPlace[]>([]);
  const [supplementalPlaces, setSupplementalPlaces] = useState<MapPlace[]>([]);
  const [navigation, setNavigation] = useState<MapNavigationResponse>({});
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [isLoadingNavigation, setIsLoadingNavigation] = useState(true);
  const [isLoadingSupplemental, setIsLoadingSupplemental] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [lastMapRegion, setLastMapRegion] = useState<Region>(focusRegion);
  const [trayState, setTrayState] = useState<MapTrayState>('peek');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<MapContentSelection>({
    type: 'all',
  });
  const [pendingFit, setPendingFit] = useState<MapContentSelection | null>(null);
  const [isRegionsSheetOpen, setIsRegionsSheetOpen] = useState(false);
  const [isSavedSheetOpen, setIsSavedSheetOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    setIsLoadingPlaces(true);
    setIsLoadingNavigation(true);
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

    fetchPlaceCardsByIds(storedPlaceIds)
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
    if (!isMapReady || !hasDeepLinkMarker) {
      return;
    }

    mapRef.current?.animateToRegion(focusRegion, 450);
  }, [focusRegion, hasDeepLinkMarker, isMapReady]);

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
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const displayedPlaces = useMemo(
    () =>
      selectedPlaces.filter((place) =>
        matchesSearch(place, normalizedQuery)
      ),
    [normalizedQuery, selectedPlaces]
  );
  const hasMatchingDeepLinkPlace = displayedPlaces.some(
    (place) =>
      hasDeepLinkMarker &&
      Math.abs(place.coordinates.lat - latitude) < 0.000001 &&
      Math.abs(place.coordinates.lng - longitude) < 0.000001
  );
  const isLoading =
    isLoadingPlaces ||
    isLoadingSaved ||
    isLoadingTrips ||
    isLoadingSupplemental;

  useEffect(() => {
    if (!pendingFit || !isMapReady || !mapRef.current) {
      return;
    }

    const placesToFit = getPlacesForSelection({
      places: availablePlaces,
      savedPlaceIds,
      selection: pendingFit,
      trips,
    });

    const didFit = fitMapToPlaces(mapRef.current, placesToFit);

    if (didFit) {
      setPendingFit(null);
      return;
    }

    if (!isLoadingPlaces && !isLoadingSupplemental) {
      if (pendingFit.type === 'all') {
        mapRef.current.animateToRegion(DEFAULT_REGION, 500);
      }
      setPendingFit(null);
    }
  }, [
    availablePlaces,
    isMapReady,
    isLoadingPlaces,
    isLoadingSupplemental,
    pendingFit,
    savedPlaceIds,
    trips,
  ]);

  const applySelection = (nextSelection: MapContentSelection) => {
    const isDeselecting = isSameSelection(selection, nextSelection);
    const resolvedSelection: MapContentSelection = isDeselecting
      ? { type: 'all' }
      : nextSelection;

    setSelection(resolvedSelection);
    setQuery('');
    setPendingFit(isDeselecting ? null : resolvedSelection);
    setIsRegionsSheetOpen(false);
    setIsSavedSheetOpen(false);
    if (trayState === 'full') {
      setIsMapReady(false);
    }
    setTrayState('peek');
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
          isLoading={isLoading}
          onCollapse={() => {
            setIsMapReady(false);
            setPendingFit(selection);
            setTrayState('peek');
          }}
          onRegionsPress={() => setIsRegionsSheetOpen(true)}
          onQueryChange={setQuery}
          places={displayedPlaces}
          query={query}
          selectedFilterCount={
            selection.type === 'region' || selection.type === 'subregion'
              ? 1
              : 0
          }
        />
        {regionSheet}
        {savedSheet}
      </>
    );
  }

  return (
    <View style={{ backgroundColor: '#fff', flex: 1 }}>
      <MapView
        initialRegion={lastMapRegion}
        onMapReady={() => setIsMapReady(true)}
        onRegionChangeComplete={setLastMapRegion}
        ref={mapRef}
        style={{ flex: 1 }}>
        {displayedPlaces.map((place, index) => (
          <Marker
            coordinate={{
              latitude: place.coordinates.lat,
              longitude: place.coordinates.lng,
            }}
            key={place._id ?? place.slug?.current ?? index}
            title={place.title}
          />
        ))}

        {hasDeepLinkMarker && !hasMatchingDeepLinkPlace ? (
          <Marker
            coordinate={{ latitude, longitude }}
            title={title}
          />
        ) : null}
      </MapView>

      <View
        pointerEvents="box-none"
        style={{
          left: 0,
          position: 'absolute',
          right: 0,
          top: insets.top + 10,
        }}>
        <MapQuickFilters
          isRegionsSelected={
            selection.type === 'region' || selection.type === 'subregion'
          }
          isSavedSelected={
            selection.type === 'favourites' || selection.type === 'trip'
          }
          onActivitiesPress={() => showPlaceholder('Activities')}
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
            if (selection.type === 'all') {
              mapRef.current?.animateToRegion(focusRegion, 450);
              return;
            }

            fitMapToPlaces(mapRef.current, selectedPlaces);
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
          places={displayedPlaces}
          query={query}
          resultCount={displayedPlaces.length}
        />
      </View>

      {regionSheet}
      {savedSheet}
    </View>
  );
}
