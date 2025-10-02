import { PROVIDERS } from '@/src/lib/ai/models';
import { createChat, deleteChat, listChats } from '@/src/lib/db/chat';
import type { Chat } from '@/src/types';
import { FlashList } from '@shopify/flash-list';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);

  const refreshChats = useCallback(async () => {
    const nextChats = await listChats();
    setChats(nextChats);
  }, []);

  useEffect(() => { refreshChats(); }, [refreshChats]);

  useFocusEffect(
    useCallback(() => {
      refreshChats();
    }, [refreshChats]),
  );

  async function newChat() {
    const provider: 'openai'|'google' = 'openai';
    const model = PROVIDERS[provider].models[0].id;
    await createChat({ provider, model, title: 'New Chat' });
    await refreshChats();
  }

  const handleDelete = useCallback(async (chatId: string) => {
    try {
      await deleteChat(chatId);
      setChats(prev => prev.filter(c => c.id !== chatId));
    } catch (e: any) {
      Alert.alert('Unable to delete chat', e?.message ?? String(e));
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Welcome back</Text>
            <Text style={styles.heroTitle}>Pick up the conversation</Text>
            <Text style={styles.heroSubtitle}>Resume a recent chat or start something new.</Text>
          </View>
          <Pressable
            onPress={newChat}
            style={({ pressed }) => [styles.newChatButton, pressed && styles.newChatButtonPressed]}
          >
            <Text style={styles.newChatText}>＋ New Chat</Text>
          </Pressable>
        </View>

        <View style={styles.listWrapper}>
          <FlashList
            data={chats}
            estimatedItemSize={96}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              chats.length === 0 ? styles.emptyListContent : null,
            ]}
            ListHeaderComponent={
              chats.length === 0 ? null : (
                <Text style={styles.sectionLabel}>Recent conversations</Text>
              )
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No chats yet</Text>
                <Text style={styles.emptySubtitle}>Tap the + New Chat button to create your first conversation.</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              let swipeRef: Swipeable | null = null;
              const close = () => swipeRef?.close();
              const onDelete = () => {
                close();
                handleDelete(item.id);
              };
              const isLast = index === chats.length - 1;

              return (
                <View style={[styles.chatItem, isLast && styles.chatItemLast]}>
                  <Swipeable
                    ref={(ref) => { swipeRef = ref; }}
                    renderRightActions={() => (
                      <View style={styles.deleteActionContainer}>
                        <Pressable
                          onPress={onDelete}
                          style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteActionPressed]}
                        >
                          <Text style={styles.deleteActionText}>Delete</Text>
                        </Pressable>
                      </View>
                    )}
                  >
                    <Link
                      href={{ pathname: '/chat/[id]', params: { id: item.id } }}
                      asChild
                    >
                      <Pressable
                        style={({ pressed }) => [styles.chatCard, pressed && styles.chatCardPressed]}
                      >
                        <View style={styles.chatCardHeader}>
                          <Text style={styles.chatTitle}>{item.title || 'Untitled chat'}</Text>
                          <Text style={styles.chatMeta}>{formatProviderLabel(item)}</Text>
                        </View>
                        <Text style={styles.chatTimestamp}>Updated {formatTimestamp(item.updatedAt)}</Text>
                      </Pressable>
                    </Link>
                  </Swipeable>
                  {!isLast ? <View style={styles.chatSeparator} /> : null}
                </View>
              );
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function formatProviderLabel(chat: Chat) {
  const providerName = chat.provider === 'openai' ? 'OpenAI' : 'Google';
  return `${providerName} · ${chat.model}`;
}

function formatTimestamp(timestamp: number) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (diffSeconds < 60) {
    return 'just now';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 min ago' : `${diffMinutes} mins ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hr ago' : `${diffHours} hrs ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

const ACCENT = '#2563EB';
const CANVAS = '#0F172A';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: CANVAS,
  },
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: CANVAS,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroCopy: {
    marginBottom: 20,
  },
  heroEyebrow: {
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  newChatButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 3,
  },
  newChatButtonPressed: {
    opacity: 0.85,
  },
  newChatText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT,
  },
  listWrapper: {
    flex: 1,
    marginTop: -16,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingTop: 28,
    paddingBottom: 72,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748B',
    marginBottom: 12,
  },
  chatItem: {
    marginBottom: 0,
  },
  chatItemLast: {
    marginBottom: 18,
  },
  chatSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
    marginTop: 18,
    marginHorizontal: 10,
  },
  chatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  chatCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  chatCardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  chatTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  chatMeta: {
    fontSize: 13,
    color: ACCENT,
    marginLeft: 12,
  },
  chatTimestamp: {
    fontSize: 14,
    color: '#475569',
  },
  deleteActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 20,
  },
  deleteAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
    backgroundColor: '#DC2626',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  deleteActionPressed: {
    opacity: 0.85,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
