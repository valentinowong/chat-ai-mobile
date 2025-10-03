import { apple } from '@react-native-ai/apple';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { ProviderId } from '../../types';

export type ModelKind = 'text' | 'image';

export type ProviderModel = { id: string; label: string; kind: ModelKind };

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  models: ProviderModel[];
  requiresApiKey: boolean;
};

const OPENAI_PROVIDER: ProviderDefinition = {
  id: 'openai',
  label: 'OpenAI',
  requiresApiKey: true,
  models: [
    { id: 'gpt-5', label: 'GPT-5', kind: 'text' },
    { id: 'gpt-5-mini', label: 'GPT-5 Mini', kind: 'text' },
    { id: 'gpt-5-nano', label: 'GPT-5 Nano', kind: 'text' },
  ],
};

const GOOGLE_PROVIDER: ProviderDefinition = {
  id: 'google',
  label: 'Google (Gemini)',
  requiresApiKey: true,
  models: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', kind: 'text' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', kind: 'text' },
    { id: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image Preview', kind: 'image' },
  ],
};

const APPLE_PROVIDER: ProviderDefinition = {
  id: 'apple',
  label: 'Apple Intelligence',
  requiresApiKey: false,
  models: [{ id: 'system-default', label: 'Apple Intelligence (On Device)', kind: 'text' }],
};

const CORE_PROVIDERS: ProviderDefinition[] = [OPENAI_PROVIDER, GOOGLE_PROVIDER];

let cachedProviders: ProviderDefinition[] | null = null;

async function detectProviders(): Promise<ProviderDefinition[]> {
  const providers: ProviderDefinition[] = [...CORE_PROVIDERS];
  if (await isAppleAvailable()) {
    providers.push(APPLE_PROVIDER);
  }
  return providers;
}

async function isAppleAvailable(): Promise<boolean> {
  try {
    if (Platform.OS !== 'ios') {
      return false;
    }
    if (typeof apple?.isAvailable === 'function') {
      return apple.isAvailable();
    }
  } catch (err) {
    console.warn('Apple Intelligence availability check failed', err);
  }
  return false;
}

function getBaseProviders(): ProviderDefinition[] {
  return cachedProviders ?? CORE_PROVIDERS;
}

export async function loadAvailableProviders(): Promise<ProviderDefinition[]> {
  if (!cachedProviders) {
    cachedProviders = await detectProviders();
  }
  return cachedProviders;
}

export function getCachedProviders(): ProviderDefinition[] {
  return getBaseProviders();
}

export function useAvailableProviders(): ProviderDefinition[] {
  const [providers, setProviders] = useState<ProviderDefinition[]>(getBaseProviders());

  useEffect(() => {
    let mounted = true;
    loadAvailableProviders()
      .then((list) => {
        if (mounted) setProviders(list);
      })
      .catch((err) => {
        console.warn('Failed to load providers', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return providers;
}

function findProvider(providers: ProviderDefinition[], providerId: ProviderId) {
  return providers.find((provider) => provider.id === providerId);
}

export function getModelInfo(
  providerId: ProviderId,
  modelId: string,
  providers: ProviderDefinition[] = getBaseProviders()
): ProviderModel | null {
  const provider = findProvider(providers, providerId);
  return provider?.models.find((model) => model.id === modelId) ?? null;
}

export function isImageModel(
  providerId: ProviderId,
  modelId: string,
  providers: ProviderDefinition[] = getBaseProviders()
): boolean {
  return getModelInfo(providerId, modelId, providers)?.kind === 'image';
}

export function providerRequiresApiKey(
  providerId: ProviderId,
  providers: ProviderDefinition[] = getBaseProviders()
): boolean {
  const provider = findProvider(providers, providerId);
  return provider?.requiresApiKey ?? false;
}

export function findFirstTextModel(providers: ProviderDefinition[] = getBaseProviders()) {
  const groups: ProviderDefinition[][] = [
    providers.filter((provider) => !provider.requiresApiKey),
    providers.filter((provider) => provider.requiresApiKey),
  ];

  for (const group of groups) {
    for (const provider of group) {
      const textModel = provider.models.find((model) => model.kind === 'text');
      if (textModel) {
        return { provider: provider.id, model: textModel.id } as const;
      }
    }
    if (group.length > 0) {
      break;
    }
  }

  for (const provider of providers) {
    const textModel = provider.models.find((model) => model.kind === 'text');
    if (textModel) {
      return { provider: provider.id, model: textModel.id } as const;
    }
  }

  return null;
}

export function providersToMap(providers: ProviderDefinition[]) {
  return new Map(providers.map((provider) => [provider.id, provider] as const));
}
