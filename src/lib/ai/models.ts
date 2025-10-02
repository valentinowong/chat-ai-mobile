export type ProviderId = 'openai' | 'google';

export const PROVIDERS: Record<ProviderId, { label: string; models: { id: string; label: string }[] }> = {
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
      { id: 'gpt-5-nano', label: 'GPT-5 Nano' },
    ],
  },
  google: {
    label: 'Google (Gemini)',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
  },
};
