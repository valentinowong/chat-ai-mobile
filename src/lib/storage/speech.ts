import { getMMKV } from './mmkv';

const VOICE_KEY = 'apple:speech:voice';
const LANGUAGE_KEY = 'apple:speech:language';

export const DEFAULT_SPEECH_LANGUAGE = 'en-US';

export type AppleSpeechPreferences = {
  voiceId: string | null;
  language: string | null;
};

export async function getAppleSpeechPreferences(): Promise<AppleSpeechPreferences> {
  const storage = await getMMKV();
  const voiceId = storage.getString(VOICE_KEY) ?? null;
  const storedLanguage = storage.getString(LANGUAGE_KEY);
  const language = storedLanguage && storedLanguage.length > 0 ? storedLanguage : DEFAULT_SPEECH_LANGUAGE;
  return { voiceId, language };
}

export async function setAppleSpeechPreferences(update: Partial<AppleSpeechPreferences>) {
  const storage = await getMMKV();
  if ('voiceId' in update) {
    const voiceId = update.voiceId;
    if (voiceId && voiceId.length > 0) {
      storage.set(VOICE_KEY, voiceId);
    } else {
      storage.delete(VOICE_KEY);
    }
  }
  if ('language' in update) {
    const language = update.language;
    if (language && language.length > 0) {
      storage.set(LANGUAGE_KEY, language);
    } else {
      storage.delete(LANGUAGE_KEY);
    }
  }
}
