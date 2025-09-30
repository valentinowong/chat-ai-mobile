import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import type { Message } from '../../types';

type ProviderId = 'openai' | 'google';

function getModel(provider: ProviderId, model: string, apiKey: string) {
  if (provider === 'openai') return openai({ apiKey })(model);
  if (provider === 'google') return google({ apiKey })(model);
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
  const { textStream, text } = await streamText({
    model: getModel(provider, model, apiKey),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });
  for await (const part of textStream) onToken?.(part);
  return await text;
}