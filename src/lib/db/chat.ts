import { randomUUID } from 'expo-crypto';
import type { Chat, Message, Role } from '../../types';
import { dbReady } from './index';

export async function createChat(input: Pick<Chat, 'provider' | 'model' | 'title'>): Promise<Chat> {
  const db = await dbReady; const now = Date.now(); const id = randomUUID();
  await db.runAsync(
    'INSERT INTO chats (id, title, provider, model, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
    id, input.title, input.provider, input.model, now, now
  );
  return { id, title: input.title, provider: input.provider, model: input.model, createdAt: now, updatedAt: now };
}

export async function listChats(): Promise<Chat[]> {
  const db = await dbReady;
  return db.getAllAsync<Chat>('SELECT * FROM chats ORDER BY updatedAt DESC');
}

export async function getChat(id: string): Promise<Chat | null> {
  const db = await dbReady;
  return (await db.getFirstAsync<Chat>('SELECT * FROM chats WHERE id=?', id)) ?? null;
}

export async function addMessage(chatId: string, role: Role, content: string): Promise<Message> {
  const db = await dbReady; const id = randomUUID(); const now = Date.now();
  await db.runAsync('INSERT INTO messages (id, chatId, role, content, createdAt) VALUES (?,?,?,?,?)', id, chatId, role, content, now);
  await db.runAsync('UPDATE chats SET updatedAt=? WHERE id=?', now, chatId);
  return { id, chatId, role, content, createdAt: now };
}

export async function listMessages(chatId: string): Promise<Message[]> {
  const db = await dbReady;
  return db.getAllAsync<Message>('SELECT * FROM messages WHERE chatId=? ORDER BY createdAt ASC', chatId);
}

export async function updateMessageContent(id: string, content: string): Promise<void> {
  const db = await dbReady;
  await db.runAsync('UPDATE messages SET content=? WHERE id=?', content, id);
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await dbReady;
  await db.runAsync('DELETE FROM messages WHERE id=?', id);
}

export async function updateChatTitle(id: string, title: string): Promise<Chat | null> {
  const db = await dbReady;
  const now = Date.now();
  await db.runAsync('UPDATE chats SET title=?, updatedAt=? WHERE id=?', title, now, id);
  return (await db.getFirstAsync<Chat>('SELECT * FROM chats WHERE id=?', id)) ?? null;
}

export async function updateChatModel(
  id: string,
  provider: Chat['provider'],
  model: string,
): Promise<Chat | null> {
  const db = await dbReady;
  const now = Date.now();
  await db.runAsync(
    'UPDATE chats SET provider=?, model=?, updatedAt=? WHERE id=?',
    provider,
    model,
    now,
    id,
  );
  return (await db.getFirstAsync<Chat>('SELECT * FROM chats WHERE id=?', id)) ?? null;
}

export async function deleteChat(id: string): Promise<void> {
  const db = await dbReady;
  await db.runAsync('DELETE FROM messages WHERE chatId=?', id);
  await db.runAsync('DELETE FROM chats WHERE id=?', id);
}
