import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import { Alert, Pressable } from 'react-native';

import { Palette } from '@/constants/design';

export function DiaryViewMenu({ diaryId }: { diaryId: string }) {
  const router = useRouter();
  const open = (view: 'cover' | 'index' | 'map') => {
    if (view === 'cover') router.navigate({ pathname: '/diaries/[diaryId]', params: { diaryId } });
    else if (view === 'index') router.navigate(`/diaries/${diaryId}/contents` as Href);
    else router.navigate({ pathname: '/diaries/[diaryId]/map', params: { diaryId } });
  };
  return <Pressable accessibilityLabel="Diary views" accessibilityRole="button" hitSlop={12}
    onPress={() => Alert.alert('Diary', undefined, [
      { text: 'Cover', onPress: () => open('cover') },
      { text: 'Index', onPress: () => open('index') },
      { text: 'Map', onPress: () => open('map') },
      { text: 'Cancel', style: 'cancel' },
    ])} style={({ pressed }) => ({ alignItems: 'center', height: 44, justifyContent: 'center', opacity: pressed ? 0.55 : 1, width: 44 })}>
    <MaterialIcons color={Palette.trip} name="menu-book" size={27} />
  </Pressable>;
}
