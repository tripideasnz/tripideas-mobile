import AsyncStorage from '@react-native-async-storage/async-storage';

// Pre-account-scoping key. Existing installs may have data here from before
// saved places were split into anonymous vs. per-user storage. Migrated into
// LEGACY_SAVED_PLACE_IDS_KEY -> ANON_SAVED_PLACE_IDS_KEY once, then unused.
const LEGACY_SAVED_PLACE_IDS_KEY = 'tripideas.savedPlaceIds.v1';

// Active whenever there's no signed-in user.
const ANON_SAVED_PLACE_IDS_KEY = 'tripideas.savedPlaceIds.anon.v1';

function userSavedPlaceIdsKey(userId: string) {
  return `tripideas.savedPlaceIds.user.${userId}.v1`;
}

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function parseStoredIds(rawValue: string | null): string[] {
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

async function readIdsAtKey(key: string): Promise<string[]> {
  const rawValue = await AsyncStorage.getItem(key);
  return parseStoredIds(rawValue);
}

async function writeIdsAtKey(key: string, ids: string[]): Promise<string[]> {
  const normalizedIds = normalizeIds(ids);
  await AsyncStorage.setItem(key, JSON.stringify(normalizedIds));
  return normalizedIds;
}

// One-time migration of the legacy single-key store into the anonymous key.
// Safe to call repeatedly: it's a no-op once the legacy key is gone.
async function migrateLegacyIdsIfNeeded(): Promise<void> {
  const legacyRawValue = await AsyncStorage.getItem(LEGACY_SAVED_PLACE_IDS_KEY);

  if (legacyRawValue === null) {
    return;
  }

  const legacyIds = parseStoredIds(legacyRawValue);
  const anonIds = await readIdsAtKey(ANON_SAVED_PLACE_IDS_KEY);
  await writeIdsAtKey(ANON_SAVED_PLACE_IDS_KEY, [...anonIds, ...legacyIds]);
  await AsyncStorage.removeItem(LEGACY_SAVED_PLACE_IDS_KEY);
}

// ─── Anonymous (signed-out) saved places ───────────────────────────────────

export async function getAnonSavedPlaceIds(): Promise<string[]> {
  await migrateLegacyIdsIfNeeded();
  return readIdsAtKey(ANON_SAVED_PLACE_IDS_KEY);
}

export async function setAnonSavedPlaceIds(ids: string[]): Promise<string[]> {
  return writeIdsAtKey(ANON_SAVED_PLACE_IDS_KEY, ids);
}

// ─── Per-user saved places ──────────────────────────────────────────────────
// Scoped by account ID so saves never leak between accounts that sign in on
// the same device. Never cleared on sign-out — it's that user's durable cache.

export async function getUserSavedPlaceIds(userId: string): Promise<string[]> {
  return readIdsAtKey(userSavedPlaceIdsKey(userId));
}

export async function setUserSavedPlaceIds(
  userId: string,
  ids: string[]
): Promise<string[]> {
  return writeIdsAtKey(userSavedPlaceIdsKey(userId), ids);
}
