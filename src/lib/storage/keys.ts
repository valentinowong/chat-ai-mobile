import type { ProviderId } from '../../types';
import { getMMKV } from './mmkv';

const KEY_PREFIX = 'apiKey:';
const CUSTOM_SEARCH_KEY = 'customSearch:key';
const CUSTOM_SEARCH_CX = 'customSearch:cx';

export async function setApiKey(provider: ProviderId, key: string) {
  const mm = await getMMKV();
  mm.set(`${KEY_PREFIX}${provider}`, key);
}

export async function getApiKey(provider: ProviderId) {
  const mm = await getMMKV();
  return mm.getString(`${KEY_PREFIX}${provider}`) ?? '';
}

export async function setCustomSearchKey(key: string) {
  const mm = await getMMKV();
  if (!key) {
    mm.delete(CUSTOM_SEARCH_KEY);
    return;
  }
  mm.set(CUSTOM_SEARCH_KEY, key);
}

export async function getCustomSearchKey() {
  const mm = await getMMKV();
  return mm.getString(CUSTOM_SEARCH_KEY) ?? '';
}

export async function setCustomSearchCx(cx: string) {
  const mm = await getMMKV();
  if (!cx) {
    mm.delete(CUSTOM_SEARCH_CX);
    return;
  }
  mm.set(CUSTOM_SEARCH_CX, cx);
}

export async function getCustomSearchCx() {
  const mm = await getMMKV();
  return mm.getString(CUSTOM_SEARCH_CX) ?? '';
}
