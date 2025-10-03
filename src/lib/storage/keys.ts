import type { ProviderId } from '../../types';
import { getMMKV } from './mmkv';

const KEY_PREFIX = 'apiKey:';

export async function setApiKey(provider: ProviderId, key: string) {
  const mm = await getMMKV();
  mm.set(`${KEY_PREFIX}${provider}`, key);
}

export async function getApiKey(provider: ProviderId) {
  const mm = await getMMKV();
  return mm.getString(`${KEY_PREFIX}${provider}`) ?? '';
}
