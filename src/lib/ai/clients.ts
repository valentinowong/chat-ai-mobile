import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import type { Message } from '../../types';

type ProviderId = 'openai' | 'google';

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
