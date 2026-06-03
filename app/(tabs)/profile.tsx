import { Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>Profile</Text>
      <Text style={{ marginTop: 8 }}>
        Sign in to sync favourites and trip ideas.
      </Text>
    </View>
  );
}