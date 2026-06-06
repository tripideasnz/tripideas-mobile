import { sanityClient } from '@/sanity/client';
import { COVER_QUERY } from '@/sanity/queries';
import type { CoverResponse } from '@/sanity/types';

export type TripIdeasBranding = {
  logoAlt?: string;
  logoUrl?: string;
};

export async function fetchTripIdeasBranding(): Promise<TripIdeasBranding> {
  const data = await sanityClient.fetch<CoverResponse>(COVER_QUERY);

  return {
    logoAlt: data?.home?.logoAlt,
    logoUrl: data?.home?.logoUrl,
  };
}
