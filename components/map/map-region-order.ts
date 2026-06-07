import type {
  MapNavigationIsland,
  MapNavigationRegion,
  MapNavigationResponse,
} from '@/sanity/types';

const NORTH_REGION_ORDER = [
  ['northland'],
  ['auckland'],
  ['coromandel'],
  ['waikato'],
  ['bay of plenty'],
  ['gisborne', 'east cape'],
  ['hawke bay', "hawke's bay", 'hawkes bay'],
  ['taranaki'],
  ['manawatu whanganui', 'manawatu-wanganui'],
  ['wellington'],
];

const SOUTH_REGION_ORDER = [
  ['tasman', 'nelson'],
  ['marlborough'],
  ['west coast'],
  ['canterbury'],
  ['otago'],
  ['southland'],
];

function normalizeRegionValue(value?: string) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getRegionRank(
  region: MapNavigationRegion,
  order: string[][]
) {
  const values = [
    normalizeRegionValue(region.name),
    normalizeRegionValue(region.slug?.current),
  ];
  const rank = order.findIndex((aliases) =>
    aliases.some((alias) =>
      values.some(
        (value) =>
          value === normalizeRegionValue(alias) ||
          value.includes(normalizeRegionValue(alias))
      )
    )
  );

  return rank === -1 ? order.length : rank;
}

function orderIsland(
  island: MapNavigationIsland | undefined,
  order: string[][]
) {
  return {
    ...island,
    regions: [...(island?.regions ?? [])]
      .filter(Boolean)
      .sort((left, right) => {
        const rankDifference =
          getRegionRank(left, order) - getRegionRank(right, order);

        if (rankDifference !== 0) {
          return rankDifference;
        }

        return (left.name ?? '').localeCompare(right.name ?? '');
      }),
  };
}

export function orderMapNavigation(
  navigation: MapNavigationResponse
): MapNavigationResponse {
  return {
    north: orderIsland(navigation.north, NORTH_REGION_ORDER),
    south: orderIsland(navigation.south, SOUTH_REGION_ORDER),
  };
}
