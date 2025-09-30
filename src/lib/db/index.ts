import * as SQLite from 'expo-sqlite';

export const dbReady = (async () => {
  const db = await SQLite.openDatabaseAsync('llm-chat.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      chatId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(chatId) REFERENCES chats(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chatId, createdAt);
  `);
  return db;
})();