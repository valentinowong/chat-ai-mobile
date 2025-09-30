import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

const ENC_KEY_NAME = 'mmkv.enc.v1';

async function getOrCreateEncKey() {
  let k = await SecureStore.getItemAsync(ENC_KEY_NAME);
  if (!k) {
    // 32 random bytes -> hex
    const bytes = Crypto.getRandomBytes(32);
    k = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(ENC_KEY_NAME, k, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return k;
}

let _storage: MMKV | null = null;
export async function getMMKV() {
  if (_storage) return _storage;
  const encryptionKey = await getOrCreateEncKey();
  _storage = new MMKV({ id: 'secure', encryptionKey });
  return _storage;
}