import { getMMKV } from './mmkv';

type Provider = 'openai' | 'google';
const KEY_PREFIX = 'apiKey:';

export async function setApiKey(provider: Provider, key: string) {
  const mm = await getMMKV();
  mm.set(`${KEY_PREFIX}${provider}`, key);
}

export async function getApiKey(provider: Provider) {
  const mm = await getMMKV();
  return mm.getString(`${KEY_PREFIX}${provider}`) ?? '';
}