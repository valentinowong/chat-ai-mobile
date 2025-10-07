export type Role = 'system' | 'user' | 'assistant';

export type ProviderId = 'openai' | 'google' | 'apple' | 'apple-sd';

export type Chat = {
  id: string;
  title: string;
  provider: ProviderId;
  model: string; // e.g. 'gpt-4o' or 'gemini-1.5-pro'
  createdAt: number;
  updatedAt: number;
};

export type Message = {
  id: string;
  chatId: string;
  role: Role;
  content: string;
  createdAt: number;
};
