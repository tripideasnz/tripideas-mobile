import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_PLACE_IDS_KEY = 'tripideas.savedPlaceIds.v1';

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export async function getSavedPlaceIds() {
  const rawValue = await AsyncStorage.getItem(SAVED_PLACE_IDS_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return normalizeIds(parsedValue.filter((id): id is string => typeof id === 'string'));
  } catch {
    return [];
  }
}

export async function setSavedPlaceIds(ids: string[]) {
  const normalizedIds = normalizeIds(ids);
  await AsyncStorage.setItem(SAVED_PLACE_IDS_KEY, JSON.stringify(normalizedIds));
  return normalizedIds;
}
