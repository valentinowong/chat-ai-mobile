import { FlashList } from '@shopify/flash-list';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message } from '../types';

export function MessageList({ messages }: { messages: Message[] }) {
  const insets = useSafeAreaInsets();
  return (
    <FlashList
      data={messages}
      keyExtractor={m => m.id}
      contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}
      renderItem={({ item }) => (
        <View style={{ padding: 12 }}>
          <Text style={{ opacity: 0.6 }}>{item.role}</Text>
          <Text>{item.content}</Text>
        </View>
      )}
    />
  );
}