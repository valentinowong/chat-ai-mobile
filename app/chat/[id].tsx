import { generateImageFromPrompt, streamReply } from '@/src/lib/ai/clients';
import { isImageModel } from '@/src/lib/ai/models';
import { addMessage, deleteMessage, getChat, listMessages, updateChatModel, updateChatTitle, updateMessageContent } from '@/src/lib/db/chat';
import { File } from 'expo-file-system';
import { getApiKey } from '@/src/lib/storage/keys';
import type { Chat, Message } from '@/src/types';
import { InputBar } from '@/src/ui/InputBar';
import { MessageList } from '@/src/ui/MessageList';
import { ModelPicker } from '@/src/ui/ModelPicker';
import { useHeaderHeight } from '@react-navigation/elements';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [selection, setSelection] = useState<{ provider: Chat['provider']; model: string } | null>(null);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);

  useEffect(() => { (async () => {
    const c = await getChat(id); if (!c) return; setChat(c);
    setMessages(await listMessages(id));
  })(); }, [id]);

  useEffect(() => {
    navigation.setOptions?.({ title: chat?.title ?? 'Chat' });
  }, [navigation, chat?.title]);

  useEffect(() => {
    if (!chat) return;
    setSelection({ provider: chat.provider, model: chat.model });
  }, [chat]);

  const handleModelChange = useCallback(async (next: { provider: Chat['provider']; model: string }) => {
    if (!chat || isUpdatingModel) return;
    const previous = selection;
    setSelection(next);
    setIsUpdatingModel(true);
    try {
      const updated = await updateChatModel(chat.id, next.provider, next.model);
      setChat(updated ?? { ...chat, provider: next.provider, model: next.model });
    } catch (e: any) {
      Alert.alert('Could not update model', e?.message ?? String(e));
      if (previous) setSelection(previous);
    } finally {
      setIsUpdatingModel(false);
    }
  }, [chat, isUpdatingModel, selection]);

  async function send(text: string) {
    if (!chat || isSending) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const provider = selection?.provider ?? chat.provider;
    const model = selection?.model ?? chat.model;
    const imageModelSelected = isImageModel(provider, model);
    setIsSending(true);
    try {
      const user = await addMessage(chat.id, 'user', trimmed);
      setMessages(prev => [...prev, user]);

      const shouldRename = !chat.title?.trim() || chat.title === 'New Chat';
      if (shouldRename) {
        const derivedTitle = deriveChatTitleFromMessage(trimmed);
        if (derivedTitle) {
          try {
            const renamed = await updateChatTitle(chat.id, derivedTitle);
            setChat((prev) => renamed ?? (prev ? { ...prev, title: derivedTitle, updatedAt: Date.now() } : prev));
          } catch (err) {
            console.error('Failed to update chat title', err);
          }
        }
      }

      const key = await getApiKey(provider);
      if (!key) {
        Alert.alert('Missing API key', `Add your ${provider} key in Settings`);
        return;
      }

      const assistant = await addMessage(chat.id, 'assistant', '');
      setMessages(prev => [...prev, { ...assistant }]);

      if (imageModelSelected) {
        const image = await generateImageFromPrompt({
          provider,
          model,
          prompt: trimmed,
          apiKey: key,
        });

        if (image.uri) {
          setMessages(prev => prev.map(m => (m.id === assistant.id ? { ...m, content: image.uri } : m)));
          await updateMessageContent(assistant.id, image.uri);
        } else {
          const fallback = image.text?.trim() || 'No image was generated.';
          setMessages(prev => prev.map(m => (m.id === assistant.id ? { ...m, content: fallback } : m)));
          await updateMessageContent(assistant.id, fallback);
          Alert.alert('Image unavailable', 'The model did not return an image for this prompt.');
        }
        return;
      }

      let acc = '';
      const final = await streamReply({
        provider,
        model,
        apiKey: key,
        messages: [...messages, user].map(({ role, content }) => ({ role, content })),
        onToken: (chunk) => {
          acc += chunk;
          setMessages(prev => prev.map(m => m.id === assistant.id ? { ...m, content: acc } : m));
        },
      });

      await updateMessageContent(assistant.id, final);
    } catch (e: any) {
      console.error('Failed to stream reply', e);
      const message = e?.message ?? String(e);
      if (e?.data?.error?.message) {
        Alert.alert('Error', e.data.error.message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setIsSending(false);
    }
  }

  const handleMessageDeleteRequest = useCallback((message: Message) => {
    Alert.alert('Delete message?', 'This will remove the message from the conversation.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const content = message.content?.trim?.();
            if (content && content.startsWith('file://')) {
              try {
                new File(content).delete();
              } catch (fileErr) {
                console.warn('Failed to delete image file', fileErr);
              }
            }
            await deleteMessage(message.id);
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
          } catch (err: any) {
            console.error('Failed to delete message', err);
            Alert.alert('Unable to delete', err?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea]} edges={['left', 'right']}>
      <View style={[styles.root, { paddingTop: headerHeight }] }>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Model</Text>
          {selection ? (
            <ModelPicker
              value={selection}
              onChange={handleModelChange}
              buttonStyle={styles.modelPickerButton}
              textStyle={styles.modelPickerText}
              placeholderText="Select a model"
            />
          ) : (
            <View style={[styles.modelPickerButton, styles.modelPickerLoading]}>
              <Text style={styles.modelPickerLoadingText}>Loading models…</Text>
            </View>
          )}
          {isUpdatingModel ? <Text style={styles.modelStatus}>Updating…</Text> : null}
        </View>
        <View style={styles.conversation}>
          <MessageList messages={messages} onRequestDelete={handleMessageDeleteRequest} />
          <InputBar onSend={send} disabled={isSending} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function deriveChatTitleFromMessage(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim().length > 0) ?? trimmed;
  const normalized = firstLine.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const MAX_LENGTH = 48;
  if (normalized.length <= MAX_LENGTH) return normalized;

  return `${normalized.slice(0, MAX_LENGTH - 1).trimEnd()}…`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  root: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.3)',
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: 4,
  },
  modelPickerButton: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modelPickerText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  modelPickerLoading: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  modelPickerLoadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  modelStatus: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 6,
  },
  conversation: {
    flex: 1,
    paddingTop: 0,
  },
});
