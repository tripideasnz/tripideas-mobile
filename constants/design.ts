import type { TextStyle, ViewStyle } from 'react-native';

export const BrandName = 'TripIdeas.nz';

export const Palette = {
  background: '#ffffff',
  border: '#dededb',
  danger: '#c62828',
  favourite: '#e31b23',
  primary: '#111111',
  success: '#238636',
  surface: '#ffffff',
  surfaceMuted: '#f7f7f5',
  text: '#111111',
  textBody: '#333333',
  textMuted: '#717171',
  textOnPrimary: '#ffffff',
  trip: '#1473e6',
} as const;

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const Radius = {
  small: 8,
  control: 10,
  input: 12,
  card: 14,
  sheet: 18,
  pill: 999,
} as const;

export const Type: Record<
  | 'display'
  | 'title'
  | 'section'
  | 'cardTitle'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption',
  TextStyle
> = {
  display: { fontSize: 34, fontWeight: '700', lineHeight: 40 },
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  section: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  cardTitle: { fontSize: 18, fontWeight: '700', lineHeight: 23 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodyStrong: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 17 },
};

export const Shadow: Record<'card' | 'floating' | 'sheet', ViewStyle> = {
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  floating: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
  },
  sheet: {
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { height: -3, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
};

export const Screen = {
  gutter: Space.xxl,
  top: Space.xl,
  bottom: Space.xxxl,
} as const;
