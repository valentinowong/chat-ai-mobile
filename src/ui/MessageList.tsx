import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { File, cacheDirectory, documentDirectory } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message } from '../types';
import { FullscreenImageModal } from './FullscreenImageModal';
import { MessageActionSheet, type MessageActionSheetOption } from './MessageActionSheet';

const ACCENT = '#2563EB';
const ROLE_LABEL: Record<Message['role'], string> = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
};
const BASE64_ENCODING = 'base64';

type MessageListProps = {
  messages: Message[];
  onRequestDelete?: (message: Message) => void;
};

export function MessageList({ messages, onRequestDelete }: MessageListProps) {
  const insets = useSafeAreaInsets();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);

  const isImageContent = useCallback((content: string) => {
    const trimmed = content.trim();
    return trimmed.startsWith('file://') || /^data:image\//i.test(trimmed);
  }, []);

  const closeActionSheet = useCallback(() => setActionMessage(null), []);

  const copyText = useCallback(async (content: string) => {
    try {
      await Clipboard.setStringAsync(content.trim());
      Alert.alert('Copied', 'Message copied to clipboard.');
    } catch (err: any) {
      Alert.alert('Unable to copy', err?.message ?? 'Please try again.');
    }
  }, []);

  const copyImage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    let base64: string | null = null;

    if (trimmed.startsWith('data:image/')) {
      const [, data] = trimmed.split(',', 2);
      base64 = data ?? null;
    } else if (trimmed.startsWith('file://')) {
      try {
        const file = new File(trimmed);
        if (typeof file.base64 === 'function') {
          const result = file.base64();
          base64 = typeof result === 'string' ? result : await result;
        }
        if (!base64 && typeof (FileSystem as any).readAsStringAsync === 'function') {
          base64 = await (FileSystem as any).readAsStringAsync(trimmed, { encoding: BASE64_ENCODING });
        }
      } catch (err: any) {
        console.warn('Failed to read image file', err);
      }
    }

    if (!base64) {
      Alert.alert('Unable to copy', 'This image format is not supported.');
      return;
    }

    try {
      await Clipboard.setImageAsync(base64);
      Alert.alert('Copied', 'Image copied to clipboard.');
    } catch (err: any) {
      Alert.alert('Unable to copy', err?.message ?? 'Please try again.');
    }
  }, []);

  const saveImage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to save images.');
      return;
    }

    let uriToSave = trimmed;
    let tempFileUri: string | null = null;

    if (trimmed.startsWith('data:image/')) {
      const match = trimmed.match(/^data:image\/(\w+);base64,(.*)$/i);
      if (!match) {
        Alert.alert('Unable to save', 'This image format is not supported.');
        return;
      }
      const extension = match[1]?.toLowerCase?.() ?? 'png';
      const data = match[2];
      const baseCacheDir = cacheDirectory ?? documentDirectory ?? '';
      tempFileUri = `${baseCacheDir}chat-image-${Date.now()}.${extension}`;
      try {
        const file = new File(tempFileUri);
        if (!file.exists) {
          file.create({ intermediates: true, overwrite: true });
        }
        file.write(data, { encoding: BASE64_ENCODING });
      } catch (err: any) {
        Alert.alert('Unable to save', err?.message ?? 'Please try again.');
        return;
      }
      uriToSave = tempFileUri;
    }

    try {
      await MediaLibrary.saveToLibraryAsync(uriToSave);
      Alert.alert('Saved', 'Image saved to your library.');
    } catch (err: any) {
      Alert.alert('Unable to save', err?.message ?? 'Please try again.');
    } finally {
      if (tempFileUri) {
        try {
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        } catch (cleanupErr) {
          console.warn('Failed to clean up temp file', cleanupErr);
        }
      }
    }
  }, []);

  const actionOptions: MessageActionSheetOption[] = actionMessage
    ? (() => {
        const trimmed = actionMessage.content.trim();
        const options: MessageActionSheetOption[] = [];
        const isImage = isImageContent(trimmed);

        const wrap = (run: () => Promise<void> | void): (() => void) => () => {
          closeActionSheet();
          requestAnimationFrame(() => {
            void run();
          });
        };

        if (isImage) {
          options.push({ key: 'copy-image', label: 'Copy Image', onPress: wrap(() => copyImage(trimmed)) });
          options.push({ key: 'save-image', label: 'Save Image', onPress: wrap(() => saveImage(trimmed)) });
        } else if (trimmed.length > 0) {
          options.push({ key: 'copy-text', label: 'Copy Text', onPress: wrap(() => copyText(trimmed)) });
        }

        if (onRequestDelete) {
          options.push({
            key: 'delete',
            label: 'Delete Message',
            destructive: true,
            onPress: wrap(() => onRequestDelete(actionMessage)),
          });
        }

        return options;
      })()
    : [];

  return (
    <>
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
          const isLocalImage = trimmedContent.startsWith('file://');
          const isDataUrlImage = /^data:image\//i.test(trimmedContent);
          const isImageMessage = isLocalImage || isDataUrlImage;

          return (
            <Pressable
              onLongPress={() => setActionMessage(item)}
              onPress={isImageMessage ? () => setSelectedImageUri(trimmedContent) : undefined}
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
                  isImageMessage ? styles.imageBubble : null,
                ]}
              >
                {showTyping ? (
                  <TypingIndicator />
                ) : isImageMessage ? (
                  <Image
                    source={{ uri: trimmedContent }}
                    style={styles.generatedImage}
                    contentFit="cover"
                    accessibilityRole="image"
                    accessibilityLabel="Generated image"
                  />
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
      <FullscreenImageModal uri={selectedImageUri} onClose={() => setSelectedImageUri(null)} />
      <MessageActionSheet
        visible={actionMessage !== null}
        onDismiss={closeActionSheet}
        options={actionOptions}
      />
    </>
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
  imageBubble: {
    paddingHorizontal: 8,
    paddingVertical: 8,
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
  generatedImage: {
    width: 240,
    maxWidth: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
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
