// How the system text size (iOS Dynamic Type) changes layout. Kept apart from React so it can be tested.
import { STACK_ROWS_AT_FONT_SCALE } from '@/constants/design';

/** True when the system text scale is large enough that two-up button rows should stack instead of squeezing labels. */
export const shouldStackRows = (fontScale: number): boolean => fontScale >= STACK_ROWS_AT_FONT_SCALE;
