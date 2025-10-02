import { FlashList } from '@shopify/flash-list';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message } from '../types';

const ACCENT = '#2563EB';
const ROLE_LABEL: Record<Message['role'], string> = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
};

type MessageListProps = {
  messages: Message[];
  onRequestDelete?: (message: Message) => void;
};

export function MessageList({ messages, onRequestDelete }: MessageListProps) {
  const insets = useSafeAreaInsets();

  return (
    <FlashList
      data={messages}
      keyExtractor={m => m.id}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }]}
      estimatedItemSize={96}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const isUser = item.role === 'user';
        const isAssistant = item.role === 'assistant';
        const isSystem = item.role === 'system';
        const trimmedContent = item.content.trim();
        const showTyping = isAssistant && trimmedContent.length === 0;

        return (
          <Pressable
            onLongPress={onRequestDelete ? () => onRequestDelete(item) : undefined}
            delayLongPress={300}
            style={({ pressed }) => [
              styles.messageWrapper,
              isUser ? styles.alignEnd : styles.alignStart,
              onRequestDelete && pressed ? styles.messagePressed : null,
            ]}
          >
            <Text style={[styles.meta, isUser ? styles.metaRight : styles.metaLeft]}>{ROLE_LABEL[item.role]}</Text>
            <View
              style={[
                styles.bubble,
                isUser ? styles.userBubble : null,
                isAssistant ? styles.assistantBubble : null,
                isSystem ? styles.systemBubble : null,
              ]}
            >
              {showTyping ? (
                <TypingIndicator />
              ) : (
                <Text style={[styles.content, isUser ? styles.userContent : null]}>{trimmedContent || '…'}</Text>
              )}
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Say hello 👋</Text>
          <Text style={styles.emptySubtitle}>Start the conversation to see your messages here.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    backgroundColor: '#F3F4F6',
    flexGrow: 1,
  },
  messageWrapper: {
    maxWidth: '90%',
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  messagePressed: {
    opacity: 0.8,
  },
  alignStart: {
    alignSelf: 'flex-start',
  },
  alignEnd: {
    alignSelf: 'flex-end',
  },
  meta: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    color: '#94A3B8',
  },
  metaLeft: {
    textAlign: 'left',
  },
  metaRight: {
    textAlign: 'right',
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
    shadowColor: ACCENT,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
  },
  systemBubble: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5F5',
  },
  content: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1F2937',
  },
  userContent: {
    color: '#FFFFFF',
  },
  emptyState: {
    marginTop: 72,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 2,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    backgroundColor: '#CBD5F5',
  },
});

function TypingIndicator() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const animations = dots.map((value, index) => {
      value.setValue(0.3);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 120),
          Animated.timing(value, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.3,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: true }
      );
    });

    animations.forEach((anim) => anim.start());
    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [dots]);

  return (
    <View style={styles.typingDots}>
      {dots.map((value, index) => (
        <Animated.View key={index} style={[styles.typingDot, { opacity: value }]} />
      ))}
    </View>
  );
}
