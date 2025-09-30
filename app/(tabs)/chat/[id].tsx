import { streamReply } from '@/src/lib/ai/clients';
import { addMessage, getChat, listMessages, updateMessageContent } from '@/src/lib/db/chat';
import { getApiKey } from '@/src/lib/storage/keys';
import type { Message } from '@/src/types';
import { InputBar } from '@/src/ui/InputBar';
import { MessageList } from '@/src/ui/MessageList';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [chat, setChat] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => { (async () => {
    const c = await getChat(id); if (!c) return; setChat(c);
    setMessages(await listMessages(id));
  })(); }, [id]);

  async function send(text: string) {
    if (!chat || isSending) return;
    setIsSending(true);
    try {
      const user = await addMessage(chat.id, 'user', text);
      setMessages(prev => [...prev, user]);

      const key = await getApiKey(chat.provider);
      if (!key) { Alert.alert('Missing API key', `Add your ${chat.provider} key in Settings`); return; }

      const assistant = await addMessage(chat.id, 'assistant', '');
      setMessages(prev => [...prev, { ...assistant }]);

      let acc = '';
      const final = await streamReply({
        provider: chat.provider,
        model: chat.model,
        apiKey: key,
        messages: [...messages, user].map(({ role, content }) => ({ role, content })),
        onToken: (chunk) => {
          acc += chunk;
          setMessages(prev => prev.map(m => m.id === assistant.id ? { ...m, content: acc } : m));
        },
      });

      await updateMessageContent(assistant.id, final);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}> 
      <View style={{ flex: 1 }}>
        <MessageList messages={messages} />
        <InputBar onSend={send} disabled={isSending} />
      </View>
    </SafeAreaView>
  );
}