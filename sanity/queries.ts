export const COVER_QUERY = `
{
  "welcomePage": *[_type == "customPage" && slug.current == "app-welcome"][0]{
    title,
    subtitle,
    "fallbackSubtitle": content[_type == "block" && style == "normal"][0].children[0].text,
    "backgroundAlt": mainImage.alt,
    "backgroundUrl": mainImage.asset->url
  },
  "home": *[_type == "home"][0]{
    "backgroundAlt": coalesce(heroImage.alt, mainImage.alt, image.alt),
    "backgroundUrl": coalesce(heroImage.asset->url, mainImage.asset->url, image.asset->url),
    "logoAlt": logo.alt,
    "logoUrl": logo.asset->url
  },
  "islands": *[_type == "islands"][0]{
    "backgroundAlt": coalesce(north.heroImage.alt, north.mainImage.alt, north.image.alt),
    "backgroundUrl": coalesce(north.heroImage.asset->url, north.mainImage.asset->url, north.image.asset->url)
  }
}
`;

export const ISLANDS_QUERY = `
*[_type == "islands"][0]{
  north{
    title,
    maori,
    "imageAlt": coalesce(heroImage.alt, mainImage.alt, image.alt),
    "imageUrl": coalesce(heroImage.asset->url, mainImage.asset->url, image.asset->url),
    "preview": description[_type == "block" && style == "normal"][0].children[0].text,
    regions[]->{
      _id,
      name,
      maori,
      slug,
      "imageAlt": coalesce(heroImage.alt, mainImage.alt, image.alt),
      "imageUrl": coalesce(heroImage.asset->url, mainImage.asset->url, image.asset->url),
      "subRegions": *[_type == "subRegion" && region._ref == ^._id] | order(name asc){
        _id,
        name,
        maori,
        slug,
        "imageAlt": coalesce(heroImage.alt, mainImage.alt, image.alt),
        "imageUrl": coalesce(heroImage.asset->url, mainImage.asset->url, image.asset->url),
        "placeCount": count(*[_type == "page" && subRegion._ref == ^._id])
      }
    }
  },
  south{
    title,
    maori,
    "imageAlt": coalesce(heroImage.alt, mainImage.alt, image.alt),
    "imageUrl": coalesce(heroImage.asset->url, mainImage.asset->url, image.asset->url),
    "preview": description[_type == "block" && style == "normal"][0].children[0].text,
    regions[]->{
      _id,
      name,
      maori,
      slug,
      "imageAlt": coalesce(heroImage.alt, mainImage.alt, image.alt),
      "imageUrl": coalesce(heroImage.asset->url, mainImage.asset->url, image.asset->url),
      "subRegions": *[_type == "subRegion" && region._ref == ^._id] | order(name asc){
        _id,
        name,
        maori,
        slug,
        "imageAlt": coalesce(heroImage.alt, mainImage.alt, image.alt),
        "imageUrl": coalesce(heroImage.asset->url, mainImage.asset->url, image.asset->url),
        "placeCount": count(*[_type == "page" && subRegion._ref == ^._id])
      }
    }
  }
}
`;

export const ISLAND_QUERY = `
*[_type == "islands"][0]{
  "island": select(
    $slug == "north" => north{
      title,
      maori,
      "imageAlt": coalesce(article->mainImage.alt, heroImage.alt, mainImage.alt, image.alt),
      "imageUrl": coalesce(article->mainImage.asset->url, heroImage.asset->url, mainImage.asset->url, image.asset->url),
      "preview": coalesce(
        article->excerpt,
        article->seo.description,
        article->body[_type == "block" && style == "normal"][0].children[0].text,
        description[_type == "block" && style == "normal"][0].children[0].text
      ),
      "textBlocks": coalesce(article->body[_type == "block" && style in ["normal", "h3"]], description[_type == "block" && style in ["normal", "h3"]])
    },
    $slug == "south" => south{
      title,
      maori,
      "imageAlt": coalesce(article->mainImage.alt, heroImage.alt, mainImage.alt, image.alt),
      "imageUrl": coalesce(article->mainImage.asset->url, heroImage.asset->url, mainImage.asset->url, image.asset->url),
      "preview": coalesce(
        article->excerpt,
        article->seo.description,
        article->body[_type == "block" && style == "normal"][0].children[0].text,
        description[_type == "block" && style == "normal"][0].children[0].text
      ),
      "textBlocks": coalesce(article->body[_type == "block" && style in ["normal", "h3"]], description[_type == "block" && style in ["normal", "h3"]])
    }
  )
}
`;

export const ISLAND_REGIONS_QUERY = `
*[_type == "islands"][0]{
  "island": select(
    $slug == "north" => north{
      title,
      regions[]->{
        _id,
        name,
        maori,
        slug
      }
    },
    $slug == "south" => south{
      title,
      regions[]->{
        _id,
        name,
        maori,
        slug
      }
    }
  )
}
`;

export const REGION_QUERY = `
*[_type == "region" && slug.current == $slug][0]{
  _id,
  name,
  maori,
  slug,
  "subRegions": *[_type == "subRegion" && region._ref == ^._id] | order(name asc){
    _id,
    name,
    slug
  }
}
`;

export const SUBREGION_QUERY = `
*[_type == "subRegion" && slug.current == $slug][0]{
  _id,
  name,
  slug,
  "places": *[_type == "page" && subRegion._ref == ^._id] | order(title asc){
    _id,
    title,
    subtitle,
    excerpt,
    "h3": body[_type == "block" && style == "h3"][0].children[0].text,
    "imageAlt": mainImage.alt,
    "imageUrl": mainImage.asset->url,
    "preview": body[_type == "block" && style == "normal"][0].children[0].text,
    "seoDescription": seo.description,
    slug
  }
}
`;

export const PLACE_QUERY = `
*[_type == "page" && (_id == $editorialPlaceId || slug.current == $slug)][0]{
  _id,
  title,
  subtitle,
  excerpt,
  "h3": body[_type == "block" && style == "h3"][0].children[0].text,
  "imageAlt": mainImage.alt,
  "imageUrl": mainImage.asset->url,
  "galleryCollections": body[_type == "imageCollection"]{
    "images": images[]{
      _key,
      alt,
      "url": asset->url
    }
  },
  "preview": body[_type == "block" && style == "normal"][0].children[0].text,
  "textBlocks": body[_type == "block" && style in ["normal", "h3"]],
  "seoDescription": seo.description,
  coordinates,
  subRegion->{
    _id,
    name,
    slug,
    region->{
      name,
      maori,
      slug
    }
  },
  "nearbyPlaces": select(
    placeType == "supercluster" =>
      (nearbyPlaces[
        defined(place._ref) &&
        place._ref != ^._id &&
        defined(place->._id) &&
        defined(place->slug.current) &&
        status in ["approved", "manual"]
      ] | order(sortOrder asc))[0...12]{
        distanceKm,
        "_id": place->_id,
        "title": place->title,
        "subtitle": place->subtitle,
        "excerpt": place->excerpt,
        "h3": place->body[_type == "block" && style == "h3"][0].children[0].text,
        "imageAlt": place->mainImage.alt,
        "imageUrl": place->mainImage.asset->url,
        "preview": place->body[_type == "block" && style == "normal"][0].children[0].text,
        "seoDescription": place->seo.description,
        "slug": place->slug
      },
    (nearbyPlaces[
      defined(place._ref) &&
      place._ref != ^._id &&
      defined(place->._id) &&
      defined(place->slug.current) &&
      status in ["approved", "manual"]
    ] | order(sortOrder asc))[0...6]{
      distanceKm,
      "_id": place->_id,
      "title": place->title,
      "subtitle": place->subtitle,
      "excerpt": place->excerpt,
      "h3": place->body[_type == "block" && style == "h3"][0].children[0].text,
      "imageAlt": place->mainImage.alt,
      "imageUrl": place->mainImage.asset->url,
      "preview": place->body[_type == "block" && style == "normal"][0].children[0].text,
      "seoDescription": place->seo.description,
      "slug": place->slug
    }
  ),
  slug
}
`;

export const SEARCH_QUERY = `
*[
  _type == "page" &&
  slug.current != null &&
  (
    title match $term ||
    subtitle match $term ||
    body[_type == "block" && style == "h3"].children[].text match $term ||
    tags[]->name match $term ||
    tags[]->title match $term ||
    seo.keywords[] match $term ||
    seo.description match $term ||
    subRegion->name match $term ||
    subRegion->region->name match $term
  )
] | order(title asc)[0...30]{
  _id,
  title,
  subtitle,
  excerpt,
  "h3": body[_type == "block" && style == "h3"][0].children[0].text,
  "imageAlt": mainImage.alt,
  "imageUrl": mainImage.asset->url,
  "preview": body[_type == "block" && style == "normal"][0].children[0].text,
  "seoDescription": seo.description,
  subRegion->{
    _id,
    name,
    slug,
    region->{
      _id,
      name,
      slug
    }
  },
  slug
}
`;

export const PLACE_CARDS_BY_IDS_QUERY = `
*[_type == "page" && _id in $ids]{
  _id,
  coordinates,
  title,
  subtitle,
  excerpt,
  "h3": body[_type == "block" && style == "h3"][0].children[0].text,
  "imageAlt": mainImage.alt,
  "imageUrl": mainImage.asset->url,
  "preview": body[_type == "block" && style == "normal"][0].children[0].text,
  "seoDescription": seo.description,
  "activityTags": tags[]->{
    _id,
    name,
    slug,
    "superTagId": superTag._ref
  },
  subRegion->{
    _id,
    name,
    slug,
    region->{
      _id,
      name,
      slug
    }
  },
  slug
}
`;

export const MAP_PLACES_QUERY = `
*[
  _type == "page" &&
  slug.current != null &&
  defined(coordinates.lat) &&
  defined(coordinates.lng)
] | order(title asc){
  _id,
  coordinates,
  title,
  "imageUrl": mainImage.asset->url + "?w=640&h=480&fit=crop&auto=format",
  "activityTags": tags[]->{
    _id,
    name,
    slug,
    "superTagId": superTag._ref
  },
  slug,
  subRegion->{
    _id,
    name,
    slug,
    region->{
      _id,
      name,
      slug
    }
  }
}
`;

export const MAP_PLACES_BY_IDS_QUERY = `
*[
  _type == "page" &&
  _id in $ids &&
  defined(coordinates.lat) &&
  defined(coordinates.lng)
]{
  _id,
  coordinates,
  title,
  "imageUrl": mainImage.asset->url + "?w=640&h=480&fit=crop&auto=format",
  "activityTags": tags[]->{
    _id,
    name,
    slug,
    "superTagId": superTag._ref
  },
  slug,
  subRegion->{
    _id,
    name,
    slug,
    region->{
      _id,
      name,
      slug
    }
  }
}
`;

export const MAP_NAVIGATION_QUERY = `
*[_type == "islands"][0]{
  north{
    title,
    maori,
    regions[]->{
      _id,
      name,
      maori,
      slug,
      "subRegions": *[
        _type == "subRegion" &&
        region._ref == ^._id
      ] | order(name asc){
        _id,
        name,
        maori,
        slug
      }
    }
  },
  south{
    title,
    maori,
    regions[]->{
      _id,
      name,
      maori,
      slug,
      "subRegions": *[
        _type == "subRegion" &&
        region._ref == ^._id
      ] | order(name asc){
        _id,
        name,
        maori,
        slug
      }
    }
  }
}
`;

export const MAP_ACTIVITIES_QUERY = `
*[_type == "superTag"] | order(name asc){
  _id,
  name,
  slug,
  "tags": *[
    _type == "tag" &&
    superTag._ref == ^._id
  ] | order(name asc){
    _id,
    name,
    slug
  }
}
`;
