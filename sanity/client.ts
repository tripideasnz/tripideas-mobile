import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: 'n1o990un',
  dataset: 'production',
  apiVersion: '2025-01-01',
  useCdn: true,
});