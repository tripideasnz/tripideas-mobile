export type Slug = {
  current?: string;
};

export type PlaceCardData = {
  _id?: string;
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
