import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/**
 * UUID v4 from getRandomValues. crypto.randomUUID() (used by Crypto.randomUUID on web) only exists in
 * secure contexts, so it fails when the web app is opened over plain http on a LAN IP.
 */
function uuid(): string {
  const b = Crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const KEY = 'wr.deviceId';
let cached: string | null = null;

/** Anonymous id for this install. Saved searches, favorites and alerts are tied to it (no account needed). */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!id) {
    id = uuid();
    await AsyncStorage.setItem(KEY, id).catch(() => {});
  }
  cached = id;
  return id;
}
