export type ProviderId = 'openai' | 'google';

export const PROVIDERS: Record<ProviderId, { label: string; models: { id: string; label: string }[] }> = {
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT‑4o' },
      { id: 'gpt-4o-mini', label: 'GPT‑4o mini' },
    ],
  },
  google: {
    label: 'Google (Gemini)',
    models: [
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
  },
};