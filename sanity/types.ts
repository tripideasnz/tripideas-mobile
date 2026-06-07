import type { ContentBlock } from '@/components/content-blocks';
import type { Coordinates, PlaceCardData, Slug } from '@/types/content';

export type { Coordinates, PlaceCardData, Slug };

export type CoverContent = {
  backgroundAlt?: string;
  backgroundUrl?: string;
  logoAlt?: string;
  logoUrl?: string;
};

export type CoverResponse = {
  home?: CoverContent;
  islands?: CoverContent;
};

export type Region = {
  _id?: string;
  _key?: string;
  imageAlt?: string;
  imageUrl?: string;
  maori?: string;
  name?: string;
  slug?: Slug;
  subRegions?: SubRegionSummary[];
};

export type SubRegionSummary = {
  _id?: string;
  imageAlt?: string;
  imageUrl?: string;
  maori?: string;
  name?: string;
  placeCount?: number;
  slug?: Slug;
};

export type RegionDetail = Region & {
  subRegions?: SubRegionSummary[];
};

export type IslandSlug = 'north' | 'south';

export type IslandSummary = {
  imageAlt?: string;
  imageUrl?: string;
  maori?: string;
  preview?: string;
  regions?: Region[];
  slug: IslandSlug;
  title?: string;
};

export type IslandsResponse = {
  north?: Omit<IslandSummary, 'slug'>;
  south?: Omit<IslandSummary, 'slug'>;
};

export type IslandArticle = {
  imageAlt?: string;
  imageUrl?: string;
  maori?: string;
  preview?: string;
  textBlocks?: ContentBlock[];
  title?: string;
};

export type IslandResponse = {
  island?: IslandArticle;
};

export type IslandRegions = {
  regions?: Region[];
  title?: string;
};

export type IslandRegionsResponse = {
  island?: IslandRegions;
};

export type SubRegionDetail = {
  _id?: string;
  name?: string;
  slug?: Slug;
  places?: PlaceCardData[];
};

export type RegionContext = {
  name?: string;
  maori?: string;
  slug?: Slug;
};

export type SubRegionContext = {
  _id?: string;
  name?: string;
  slug?: Slug;
  region?: RegionContext;
};

export type PlacePage = PlaceCardData & {
  textBlocks?: ContentBlock[];
  coordinates?: Coordinates;
  nearbyPlaces?: PlaceCardData[];
  subRegion?: SubRegionContext;
};

export type MapPlace = PlaceCardData & {
  activityTags?: MapActivityTag[];
  subRegion?: {
    _id?: string;
    name?: string;
    slug?: Slug;
    region?: {
      _id?: string;
      name?: string;
      slug?: Slug;
    };
  };
};

export type MapNavigationSubRegion = {
  _id?: string;
  maori?: string;
  name?: string;
  slug?: Slug;
};

export type MapNavigationRegion = {
  _id?: string;
  maori?: string;
  name?: string;
  slug?: Slug;
  subRegions?: MapNavigationSubRegion[];
};

export type MapNavigationIsland = {
  maori?: string;
  regions?: MapNavigationRegion[];
  title?: string;
};

export type MapNavigationResponse = {
  north?: MapNavigationIsland;
  south?: MapNavigationIsland;
};

export type MapActivityTag = {
  _id?: string;
  name?: string;
  slug?: Slug;
  superTagId?: string;
};

export type MapActivitySuperTag = {
  _id?: string;
  name?: string;
  slug?: Slug;
  tags?: MapActivityTag[];
};
