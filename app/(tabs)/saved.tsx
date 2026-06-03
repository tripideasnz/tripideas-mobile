import { Text, View } from 'react-native';

export default function SavedScreen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>Saved</Text>
      <Text style={{ marginTop: 8 }}>
        Your saved TripIdeas will appear here.
      </Text>
    </View>
  );
}