import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'wr.deviceId';
let cached: string | null = null;

/** Anonymous id for this install. Saved searches, favorites and alerts are tied to it (no account needed). */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(KEY, id).catch(() => {});
  }
  cached = id;
  return id;
}
