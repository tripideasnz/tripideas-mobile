import { ActivityIndicator, View } from 'react-native';

import { Palette } from '@/constants/design';

export function LoadingView() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <ActivityIndicator color={Palette.text} />
    </View>
  );
}
