import type { ContentBlock } from '@/components/content-blocks';
import type { PlaceCardData } from '@/components/place-card';

export type Slug = {
  current?: string;
};

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
  maori?: string;
  name?: string;
  slug?: Slug;
};

export type SubRegionSummary = {
  _id?: string;
  name?: string;
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

export type Coordinates = {
  lat?: number;
  lng?: number;
};

export type RegionContext = {
  name?: string;
  maori?: string;
  slug?: Slug;
};

export type SubRegionContext = {
  name?: string;
  slug?: Slug;
  region?: RegionContext;
};

export type PlacePage = PlaceCardData & {
  textBlocks?: ContentBlock[];
  coordinates?: Coordinates;
  subRegion?: SubRegionContext;
};
