import { apple } from '@react-native-ai/apple';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { experimental_generateImage as generateImage, generateText, streamText } from 'ai';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { fetch as expoFetch } from 'expo/fetch';
import type { Message, ProviderId } from '../../types';

type NormalizedMessage = { role: Message['role']; content: string };

const fetchImpl = expoFetch as unknown as typeof globalThis.fetch;

function getModel(provider: ProviderId, model: string, apiKey: string) {
  if (provider === 'openai') {
    const client = createOpenAI({ apiKey, fetch: fetchImpl });
    return client(model);
  }

  if (provider === 'google') {
    const client = createGoogleGenerativeAI({ apiKey, fetch: fetchImpl });
    return client(model);
  }

  if (provider === 'apple') {
    if (typeof apple?.isAvailable === 'function' && !apple.isAvailable()) {
      throw new Error('Apple Intelligence is not available on this device.');
    }
    return apple();
  }

  throw new Error('Unsupported provider');
}

export async function streamReply(options: {
  provider: ProviderId;
  model: string;
  messages: Pick<Message, 'role' | 'content'>[];
  apiKey: string;
  onToken?: (chunk: string) => void;
}) {
  const { provider, model, messages, apiKey, onToken } = options;
  const normalizedMessages: NormalizedMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = await streamText({
    model: getModel(provider, model, apiKey),
    messages: normalizedMessages,
  });

  if (!onToken) {
    console.log('[streamReply] no onToken handler provided; awaiting full response');
    return await result.text;
  }

  console.log('[streamReply] started streaming response', { provider, model, messageCount: normalizedMessages.length });
  let acc = '';
  for await (const chunk of result.textStream) {
    if (!chunk) continue;
    acc += chunk;
    console.log('[streamReply] received chunk', chunk);
    onToken(chunk);
  }

  if (acc) return acc;

  try {
    console.log('[streamReply] stream yielded no chunks; awaiting full response');
    return await result.text;
  } catch {
    return acc;
  }
}

export async function generateImageFromPrompt(options: {
  provider: ProviderId;
  model: string;
  prompt: string;
  apiKey: string;
  images?: { base64: string; mediaType?: string; uri?: string | null }[];
}) {
  const { provider, model, prompt, apiKey, images = [] } = options;
  if (provider === 'apple') {
    throw new Error('Image generation is not supported by Apple Intelligence.');
  }
  if (provider === 'openai') {
    const client = createOpenAI({ apiKey, fetch: fetchImpl });
    if (images.length > 0) {
      return await editOpenAIImage({
        apiKey,
        prompt,
        image: images[0],
      });
    }

    const resolvedModel = client.image(model);
    const result = await generateImage({
      model: resolvedModel,
      prompt,
    });

    const file = result.image;
    if (!file?.base64) {
      return { uri: null as string | null, metadata: result, text: '' };
    }

    const uri = await saveImageToCache(file.base64, file.mediaType ?? 'image/png');
    return { uri, metadata: result, text: '' };
  }

  if (provider === 'google') {
    const resolvedModel = getModel(provider, model, apiKey);
    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: string; mediaType?: string }
    > = [];

    const trimmed = prompt.trim();
    if (trimmed.length > 0) {
      userContent.push({ type: 'text', text: trimmed });
    }

    for (const image of images) {
      if (!image?.base64) continue;
      userContent.push({ type: 'image', image: image.base64, mediaType: image.mediaType });
    }

    if (userContent.length === 0) {
      userContent.push({ type: 'text', text: ' ' });
    }

    const result = await generateText({
      model: resolvedModel,
      messages: [{ role: 'user', content: userContent }],
    });

    const imageFile = result.files?.find((file) => file.mediaType?.startsWith('image/'));
    if (!imageFile) {
      return { uri: null as string | null, metadata: result, text: result.text ?? '' };
    }

    const uri = await saveImageToCache(imageFile.base64, imageFile.mediaType ?? 'image/png');
    return { uri, metadata: result, text: result.text ?? '' };
  }

  const resolvedModel = getModel(provider, model, apiKey);
  const result = await generateText({
    model: resolvedModel,
    prompt,
  });

  const imageFile = result.files?.find((file) => file.mediaType?.startsWith('image/'));
  if (!imageFile) {
    return { uri: null as string | null, metadata: result, text: result.text ?? '' };
  }

  const uri = await saveImageToCache(imageFile.base64, imageFile.mediaType ?? 'image/png');
  return { uri, metadata: result, text: result.text ?? '' };
}

let resolvedBaseDirectory: Directory | null = null;
let resolvedImageDirectory: Directory | null = null;
let ensureDirPromise: Promise<Directory> | null = null;

function resolveBaseDirectory(): Directory | null {
  if (resolvedBaseDirectory) return resolvedBaseDirectory;

  const candidates: (Directory | null)[] = [
    tryGetDirectory(() => Paths.document),
    tryGetDirectory(() => Paths.cache),
  ];

  const base = candidates.find((dir): dir is Directory => !!dir) ?? null;
  resolvedBaseDirectory = base;
  return base;
}

function tryGetDirectory(resolver: () => Directory): Directory | null {
  try {
    const dir = resolver();
    return dir ?? null;
  } catch {
    return null;
  }
}

async function ensureImageDirectory(): Promise<Directory> {
  if (resolvedImageDirectory) return resolvedImageDirectory;
  if (!ensureDirPromise) {
    ensureDirPromise = (async () => {
      const base = resolveBaseDirectory();
      if (!base) throw new Error('No writable directory available for image caching.');

      const directory = new Directory(base, 'ai-images');
      try {
        directory.create({ intermediates: true, idempotent: true });
      } catch (err: any) {
        if (!directory.exists) throw err;
      }
      resolvedImageDirectory = directory;
      return directory;
    })();
  }
  return ensureDirPromise;
}

export async function saveImageToCache(base64: string, mediaType: string) {
  const directory = await ensureImageDirectory();
  const extension = mediaType.split('/')[1] ?? 'png';
  const filename = `${randomUUID()}.${extension}`;
  const file = new File(directory, filename);

  try {
    file.create({ overwrite: true, intermediates: true });
  } catch (err: any) {
    if (!file.exists) throw err;
  }

  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

async function editOpenAIImage(options: {
  apiKey: string;
  prompt: string;
  image: { base64: string; mediaType?: string; uri?: string | null };
}) {
  const { apiKey, prompt, image } = options;

  let sourceUri = image.uri ?? null;
  let mediaType = image.mediaType ?? 'image/png';
  if (!sourceUri) {
    sourceUri = await saveImageToCache(image.base64, mediaType);
  }
  if (!sourceUri) {
    throw new Error('No image data available for OpenAI image editing.');
  }

  const allowedMediaTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowedMediaTypes.has(mediaType)) {
    const converted = await ImageManipulator.manipulateAsync(
      sourceUri,
      [],
      { compress: 1, format: ImageManipulator.SaveFormat.PNG }
    );
    sourceUri = converted.uri;
    mediaType = 'image/png';
  }

  const parameters: Record<string, string> = {
    model: 'gpt-image-1',
  };
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 0) {
    parameters.prompt = trimmedPrompt;
  }

  const uploadResult = await LegacyFileSystem.uploadAsync('https://api.openai.com/v1/images/edits', sourceUri, {
    httpMethod: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    fieldName: 'image',
    parameters,
    mimeType: mediaType,
    uploadType: LegacyFileSystem.FileSystemUploadType.MULTIPART,
  });

  if (uploadResult.status !== 200) {
    let message = `OpenAI image edit failed with status ${uploadResult.status}`;
    try {
      const payload = JSON.parse(uploadResult.body ?? '');
      if (payload?.error?.message) {
        message = payload.error.message;
      }
    } catch {
      if (uploadResult.body) {
        message = uploadResult.body;
      }
    }
    throw new Error(message);
  }

  const payload = JSON.parse(uploadResult.body ?? '{}');
  const base64 = payload?.data?.[0]?.b64_json;
  if (!base64) {
    return { uri: null as string | null, metadata: payload, text: '' };
  }

  const resultUri = await saveImageToCache(base64, 'image/png');
  return { uri: resultUri, metadata: payload, text: '' };
}
