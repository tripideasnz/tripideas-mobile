export type Slug = {
  current?: string;
};

export type Coordinates = {
  lat?: number;
  lng?: number;
};

export type PlaceCardData = {
  _id?: string;
  coordinates?: Coordinates;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  h3?: string;
  imageAlt?: string;
  imageUrl?: string;
  preview?: string;
  seoDescription?: string;
  slug?: Slug;
};
