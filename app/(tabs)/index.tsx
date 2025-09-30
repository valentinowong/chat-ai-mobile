import { PROVIDERS } from '@/src/lib/ai/models';
import { createChat, listChats } from '@/src/lib/db/chat';
import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home() {
  const [chats, setChats] = useState<any[]>([]);
  useEffect(() => { listChats().then(setChats); }, []);

  async function newChat() {
    const provider: 'openai'|'google' = 'openai';
    const model = PROVIDERS[provider].models[0].id;
    const c = await createChat({ provider, model, title: 'New Chat' });
    setChats(await listChats());
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        <Pressable onPress={newChat} style={{ padding: 12 }}><Text>＋ New Chat</Text></Pressable>
        <FlashList
          data={chats}
          keyExtractor={c => c.id}
          contentContainerStyle={{ paddingBottom: 12 }}
          renderItem={({ item }) => (
            <Link href={{ pathname: '/chat/[id]', params: { id: item.id } }}>
              <View style={{ padding: 12 }}><Text>{item.title} · {item.provider}/{item.model}</Text></View>
            </Link>
          )}
        />
      </View>
    </SafeAreaView>
  );
}