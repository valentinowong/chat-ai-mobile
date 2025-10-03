import { apple } from '@react-native-ai/apple';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
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
}) {
  const { provider, model, prompt, apiKey } = options;
  if (provider === 'apple') {
    throw new Error('Image generation is not supported by Apple Intelligence.');
  }
  const result = await generateText({
    model: getModel(provider, model, apiKey),
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

async function saveImageToCache(base64: string, mediaType: string) {
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
