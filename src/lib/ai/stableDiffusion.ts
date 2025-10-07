import { randomUUID } from 'expo-crypto';
import { Directory, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type StableDiffusionNativeModule = {
  isAvailableAsync?: () => Promise<boolean>;
  isSupportedAsync?: () => Promise<boolean>;
  initializeAsync?: () => Promise<void>;
};

type StableDiffusionWrapper = {
  loadModel?: (modelPath: string) => Promise<void>;
  generateImage?: (options: { prompt: string; stepCount?: number; savePath: string }) => Promise<void>;
  addStepListener?: (listener: (event: { step: number; totalSteps?: number }) => void) => { remove: () => void };
  generateImageAsync?: (options: { prompt: string }) => Promise<any>;
  textToImageAsync?: (options: { prompt: string }) => Promise<any>;
  txt2img?: (options: { prompt: string }) => Promise<any>;
};

let nativeModuleRef: StableDiffusionNativeModule | null = null;
let wrapperRef: StableDiffusionWrapper | null = null;
let availabilityPromise: Promise<boolean> | null = null;
let loadedModelPath: string | null = null;
let configuredModelPath: string | null = null;

const DEFAULT_MODEL_SUBDIR = 'models/coreml-stable-diffusion-2-1-base_split_einsum_compiled';
const DEFAULT_OUTPUT_SUBDIR = 'stable-diffusion-outputs';
const DEFAULT_STEP_COUNT = 35;

function fetchNativeModule(): StableDiffusionNativeModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return requireOptionalNativeModule<StableDiffusionNativeModule>('ExpoStableDiffusion') ?? null;
  } catch (err) {
    console.warn('expo-stable-diffusion native module lookup failed', err);
    return null;
  }
}

export function isStableDiffusionNativeModulePresent(): boolean {
  return fetchNativeModule() !== null;
}

function getNativeModule(): StableDiffusionNativeModule | null {
  if (nativeModuleRef) return nativeModuleRef;
  const native = fetchNativeModule();
  if (!native) return null;
  nativeModuleRef = native;
  return nativeModuleRef;
}

function getWrapper(): StableDiffusionWrapper | null {
  if (wrapperRef) return wrapperRef;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-stable-diffusion');
    wrapperRef = mod?.default ?? mod;
    return wrapperRef;
  } catch (err) {
    console.warn('Failed to load expo-stable-diffusion JS wrapper', err);
    return null;
  }
}

async function ensureInitialized(mod: StableDiffusionNativeModule) {
  try {
    if (typeof mod.initializeAsync === 'function') {
      await mod.initializeAsync();
    }
  } catch (err) {
    console.warn('Stable Diffusion initialization failed', err);
  }
}

export function configureStableDiffusionModelPath(path: string) {
  configuredModelPath = path;
  loadedModelPath = null;
}

async function resolveModelPath() {
  if (configuredModelPath) return configuredModelPath;
  const baseDirectory = Paths.document ?? Paths.cache;
  if (!baseDirectory) {
    throw new Error('No writable directory available to locate Stable Diffusion model.');
  }
  return new Directory(baseDirectory, DEFAULT_MODEL_SUBDIR).uri;
}

async function ensureModelLoaded(modelPath: string) {
  if (loadedModelPath === modelPath) return;
  const directory = new Directory(modelPath);
  if (!directory.exists) {
    throw new Error(`Stable Diffusion model path does not exist: ${modelPath}`);
  }
  const wrapper = getWrapper();
  if (!wrapper?.loadModel) {
    throw new Error('Stable Diffusion loadModel API is not available.');
  }
  await wrapper.loadModel(modelPath);
  loadedModelPath = modelPath;
}

function buildDefaultSavePath() {
  const baseDirectory = Paths.document ?? Paths.cache;
  if (!baseDirectory) {
    throw new Error('No writable directory available to save Stable Diffusion output.');
  }
  const directory = new Directory(baseDirectory, DEFAULT_OUTPUT_SUBDIR);
  return { directory, file: `${directory.uri}${randomUUID()}.png` };
}

export async function isStableDiffusionAvailable(): Promise<boolean> {
  if (availabilityPromise) return availabilityPromise;
  availabilityPromise = (async () => {
    if (!isStableDiffusionNativeModulePresent()) return false;
    const mod = getNativeModule();
    if (!mod) return false;
    try {
      if (typeof mod.isAvailableAsync === 'function') {
        const available = await mod.isAvailableAsync();
        if (!available) return false;
      } else if (typeof mod.isSupportedAsync === 'function') {
        const supported = await mod.isSupportedAsync();
        if (!supported) return false;
      }
      await ensureInitialized(mod);
      return true;
    } catch (err) {
      console.warn('Stable Diffusion availability check failed', err);
      return false;
    }
  })();
  return availabilityPromise;
}

export async function generateStableDiffusionImage(options: {
  prompt: string;
  negativePrompt?: string;
  modelPath?: string;
  stepCount?: number;
  guidanceScale?: number;
  seed?: number;
  onStep?: (event: { step: number; totalSteps?: number }) => void;
  savePath?: string;
}): Promise<{ uri: string | null; base64?: string | null }> {
  const native = getNativeModule();
  const wrapper = getWrapper();
  if (!native || !wrapper) {
    throw new Error('Stable Diffusion module is not available.');
  }

  await ensureInitialized(native);

  const modelPath = options.modelPath ?? (await resolveModelPath());
  if (__DEV__) {
    console.log('[StableDiffusion] generate request', {
      prompt: options.prompt,
      hasNegativePrompt: Boolean(options.negativePrompt),
      modelPath,
    });
  }
  await ensureModelLoaded(modelPath);

  const { directory, file } = buildDefaultSavePath();
  const savePath = options.savePath ?? file;
  const outputDirectoryUri = savePath.split('/').slice(0, -1).join('/') || directory.uri;

  try {
    new Directory(outputDirectoryUri).create({ intermediates: true, idempotent: true });
  } catch (err: any) {
    if (!/Directory.*exist/i.test(String(err?.message ?? ''))) {
      console.warn('Stable Diffusion output directory creation failed', err);
    }
  }

  if (typeof wrapper.generateImage === 'function') {
    let subscription: { remove?: () => void } | null = null;
    try {
      if (options.onStep && typeof wrapper.addStepListener === 'function') {
        subscription = wrapper.addStepListener(options.onStep);
      } else if (__DEV__ && typeof wrapper.addStepListener === 'function') {
        subscription = wrapper.addStepListener(({ step, totalSteps }) => {
          console.log('[StableDiffusion] step', step, '/', totalSteps ?? '?');
        });
      }

      const payload = {
        prompt: options.prompt,
        savePath,
        stepCount: options.stepCount ?? DEFAULT_STEP_COUNT,
      };

      if (__DEV__) {
        console.log('[StableDiffusion] calling generateImage', payload);
      }

      await wrapper.generateImage(payload);

      if (__DEV__) {
        console.log('[StableDiffusion] generateImage resolved', savePath);
      }
    } catch (err) {
      console.error('[StableDiffusion] generateImage failed', err);
      throw err;
    } finally {
      subscription?.remove?.();
    }

    return { uri: savePath, base64: null };
  }

  // Fallback to legacy async APIs if present
  const payload = { prompt: options.prompt, stepCount: options.stepCount ?? DEFAULT_STEP_COUNT };

  try {
    if (__DEV__) {
      console.log('[StableDiffusion] using async fallback APIs');
    }
    let result: any;
    if (typeof wrapper.generateImageAsync === 'function') {
      result = await wrapper.generateImageAsync(payload);
    } else if (typeof wrapper.textToImageAsync === 'function') {
      result = await wrapper.textToImageAsync(payload);
    } else if (typeof wrapper.txt2img === 'function') {
      result = await wrapper.txt2img(payload);
    } else {
      throw new Error('Stable Diffusion generate method not found.');
    }

    if (!result) {
      if (__DEV__) {
        console.warn('[StableDiffusion] no result returned from async fallback');
      }
      return { uri: null, base64: null };
    }

    if (typeof result === 'string') {
      return { uri: result, base64: null };
    }

    if (Array.isArray(result)) {
      const first = result[0];
      if (first?.uri || first?.base64) {
        return { uri: first.uri ?? null, base64: first.base64 };
      }
    }

    if (result.uri || result.base64) {
      return { uri: result.uri ?? null, base64: result.base64 };
    }

    return { uri: null, base64: null };
  } catch (err) {
    console.error('[StableDiffusion] async fallback generation failed', err);
    throw err;
  }
}
