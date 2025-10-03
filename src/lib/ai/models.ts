export type ProviderId = 'openai' | 'google';

export type ModelKind = 'text' | 'image';

export type ProviderModel = { id: string; label: string; kind: ModelKind };

export const PROVIDERS: Record<ProviderId, { label: string; models: ProviderModel[] }> = {
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-5', label: 'GPT-5', kind: 'text' },
      { id: 'gpt-5-mini', label: 'GPT-5 Mini', kind: 'text' },
      { id: 'gpt-5-nano', label: 'GPT-5 Nano', kind: 'text' },
    ],
  },
  google: {
    label: 'Google (Gemini)',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', kind: 'text' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', kind: 'text' },
      { id: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image Preview', kind: 'image' },
    ],
  },
};

export function getModelInfo(provider: ProviderId, modelId: string): ProviderModel | null {
  const providerModels = PROVIDERS[provider]?.models ?? [];
  return providerModels.find((model) => model.id === modelId) ?? null;
}

export function isImageModel(provider: ProviderId, modelId: string): boolean {
  return getModelInfo(provider, modelId)?.kind === 'image';
}
