import type { TextProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Palette } from '@/constants/design';

export function StatusText(props: TextProps) {
  return (
    <AppText
      color={Palette.textMuted}
      {...props}
    />
  );
}
