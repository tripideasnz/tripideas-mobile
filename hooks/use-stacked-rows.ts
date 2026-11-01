import { useWindowDimensions } from 'react-native';

import { shouldStackRows } from '@/lib/text-scale';

/** Whether side-by-side button rows should stack for the current system text size. */
export function useStackedRows(): boolean {
  return shouldStackRows(useWindowDimensions().fontScale);
}
