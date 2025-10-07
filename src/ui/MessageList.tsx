import { Ionicons } from '@expo/vector-icons';
import { AppleSpeech, apple } from '@react-native-ai/apple';
import type { VoiceInfo } from '@react-native-ai/apple';
import { experimental_generateSpeech as speech } from 'ai';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { File, cacheDirectory, documentDirectory } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppleSpeechPreferences } from '../lib/storage/speech';
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

function normalizeLocale(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/_/g, '-');
  const parts = normalized.split('-');
  if (parts.length === 1) {
    return parts[0].toLowerCase();
  }
  return `${parts[0].toLowerCase()}-${parts
    .slice(1)
    .map((part) => (part.length === 2 ? part.toUpperCase() : part))
    .join('-')}`;
}

type MessageListProps = {
  messages: Message[];
  onRequestDelete?: (message: Message) => void;
};

type AppleSpeechPlayback = {
  isSupported: boolean;
  speak: (messageId: string, text: string) => Promise<void>;
  stop: () => Promise<void>;
  playingMessageId: string | null;
  pendingMessageId: string | null;
  isPlaying: boolean;
};

function useAppleSpeechPlayback(): AppleSpeechPlayback {
  const [isSupported, setIsSupported] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const statusDidJustFinish = status.didJustFinish;
  const statusIsPlaying = status.playing;
  const audioUriRef = useRef<string | null>(null);
  const isGeneratingRef = useRef(false);
  const mountedRef = useRef(true);
  const baseDirRef = useRef<string | null>(null);
  const voiceMapRef = useRef<Map<string, VoiceInfo> | null>(null);
  const voiceMapPromiseRef = useRef<Promise<Map<string, VoiceInfo>> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAvailability() {
      if (Platform.OS !== 'ios' || typeof apple?.isAvailable !== 'function') {
        if (mounted) setIsSupported(false);
        return;
      }

      try {
        const available = await apple.isAvailable();
        if (mounted) {
          setIsSupported(Boolean(available));
        }
      } catch (err) {
        console.warn('Failed to check Apple speech availability', err);
        if (mounted) {
          setIsSupported(false);
        }
      }
    }

    void checkAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cleanupAudioFile = useCallback(async () => {
    const currentUri = audioUriRef.current;
    if (!currentUri) {
      return;
    }
    audioUriRef.current = null;
    try {
      const file = new File(currentUri);
      if (file.exists) {
        file.delete();
      }
    } catch (err) {
      console.warn('Failed to delete speech audio file', err);
    }
  }, []);

  const stop = useCallback(
    async ({ skipState = false }: { skipState?: boolean } = {}) => {
      try {
        player.pause();
      } catch {
        // Native object may already be released; ignore.
      }
      try {
        await player.seekTo(0);
      } catch {
        // Seeking is best effort; ignore failures.
      }
      try {
        player.replace(null);
      } catch {
        // Replacing with no source is best effort.
      }

      if (!skipState && mountedRef.current) {
        setPlayingMessageId(null);
      }

      await cleanupAudioFile();
    },
    [cleanupAudioFile, player]
  );

  useEffect(() => {
    return () => {
      void stop({ skipState: true });
    };
  }, [stop]);

  useEffect(() => {
    if (statusDidJustFinish) {
      setPlayingMessageId(null);
      void cleanupAudioFile();
    }
  }, [cleanupAudioFile, statusDidJustFinish]);

  const resolveBaseDirectory = useCallback((): string | null => {
    if (baseDirRef.current) {
      return baseDirRef.current;
    }

    const runtimeFs = FileSystem as unknown as {
      cacheDirectory?: string | null;
      documentDirectory?: string | null;
      temporaryDirectory?: string | null;
      Paths?: {
        cache?: { uri?: string | null };
        document?: { uri?: string | null };
        appleSharedContainers?: Record<string, { uri?: string | null }>;
      };
    };

    const candidateUris: string[] = [];
    const pushUri = (value?: string | null) => {
      if (typeof value === 'string' && value.length > 0) {
        candidateUris.push(value.endsWith('/') ? value : `${value}/`);
      }
    };

    pushUri(cacheDirectory);
    pushUri(documentDirectory);
    pushUri(runtimeFs?.cacheDirectory ?? null);
    pushUri(runtimeFs?.documentDirectory ?? null);
    pushUri(runtimeFs?.temporaryDirectory ?? null);

    const paths = runtimeFs?.Paths;
    if (paths) {
      try {
        pushUri(paths.cache?.uri ?? null);
      } catch (err) {
        console.warn('Apple speech: unable to read cache path from Paths.cache', err);
      }
      try {
        pushUri(paths.document?.uri ?? null);
      } catch (err) {
        console.warn('Apple speech: unable to read document path from Paths.document', err);
      }
      try {
        const containers = paths.appleSharedContainers ?? {};
        Object.values(containers).forEach((dir) => {
          pushUri(dir?.uri ?? null);
        });
      } catch (err) {
        console.warn('Apple speech: unable to read shared container paths', err);
      }
    }

    const resolved = candidateUris.find((uri) => uri.startsWith('file://')) ?? candidateUris[0] ?? null;
    if (!resolved) {
      console.warn('Apple speech: no writable directory found', {
        cacheDirectory,
        documentDirectory,
        runtimeCache: runtimeFs?.cacheDirectory,
        runtimeDoc: runtimeFs?.documentDirectory,
        runtimeTemp: runtimeFs?.temporaryDirectory,
        pathsAvailable: Boolean(paths),
        candidateUris,
        keys: Object.keys(FileSystem ?? {}),
      });
    }

    baseDirRef.current = resolved;
    return resolved;
  }, []);

  const ensureVoiceMap = useCallback(async () => {
    if (voiceMapRef.current) {
      return voiceMapRef.current;
    }
    if (Platform.OS !== 'ios' || typeof AppleSpeech?.getVoices !== 'function') {
      const emptyMap = new Map<string, VoiceInfo>();
      voiceMapRef.current = emptyMap;
      return emptyMap;
    }
    if (!voiceMapPromiseRef.current) {
      voiceMapPromiseRef.current = (async () => {
        try {
          const list = await AppleSpeech.getVoices();
          const map = new Map<string, VoiceInfo>();
          if (Array.isArray(list)) {
            for (const voice of list) {
              if (voice && typeof voice.identifier === 'string') {
                map.set(voice.identifier, voice);
              }
            }
          }
          voiceMapRef.current = map;
          return map;
        } catch (voiceErr) {
          console.warn('Failed to load Apple speech voice catalog', voiceErr);
          const map = new Map<string, VoiceInfo>();
          voiceMapRef.current = map;
          return map;
        }
      })();
    }
    return voiceMapPromiseRef.current;
  }, []);

  const speak = useCallback(
    async (messageId: string, text: string) => {
      if (!isSupported) {
        Alert.alert('Speech unavailable', 'Apple Intelligence is not available on this device.');
        return;
      }

      const trimmed = text.trim();
      if (trimmed.length === 0) {
        return;
      }

      if (isGeneratingRef.current) {
        return;
      }

      isGeneratingRef.current = true;
      if (mountedRef.current) {
        setPendingMessageId(messageId);
      }

      try {
        if (playingMessageId) {
          await stop();
        }

        const model = apple?.speechModel?.();
        if (!model) {
          throw new Error('Apple speech synthesis is not available right now.');
        }

        const preferences = await getAppleSpeechPreferences();
        console.log('[AppleSpeech] Preferences', preferences);
        let voiceId = preferences.voiceId;
        let language = normalizeLocale(preferences.language) ?? null;

        let selectedVoiceInfo: VoiceInfo | null = null;

        if (voiceId) {
          const voiceMap = await ensureVoiceMap();
          const voiceInfo = voiceMap?.get(voiceId) ?? null;
          selectedVoiceInfo = voiceInfo;
          if (!voiceInfo) {
            console.warn('[AppleSpeech] Voice not found on device', voiceId);
            voiceId = null;
          } else {
            console.log('[AppleSpeech] Matched voice info', voiceInfo);
            const voiceLanguage = normalizeLocale(voiceInfo.language);
            if (voiceLanguage && voiceLanguage.toLowerCase() !== 'und') {
              language = voiceLanguage;
            } else if (!language) {
              language = normalizeLocale(preferences.language) ?? 'en-US';
            }
          }
        }

        const useDirectAppleSpeech = Boolean(selectedVoiceInfo?.isPersonalVoice);
        if (useDirectAppleSpeech) {
          // Personal voices ignore the language hint; avoid sending conflicting locale.
          language = null;
        }
        console.log('[AppleSpeech] Speech request', { voiceId, language, useDirectAppleSpeech });

        let dataBytes: Uint8Array | null = null;
        let dataBase64: string | null = null;
        let fileExtension = 'wav';

        if (useDirectAppleSpeech) {
          console.log('[AppleSpeech] Using AppleSpeech.generate');
          const generated = await AppleSpeech.generate(trimmed, {
            ...(language ? { language } : {}),
            ...(voiceId ? { voice: voiceId } : {}),
          });
          dataBytes = generated instanceof Uint8Array ? generated : new Uint8Array(generated as ArrayBufferLike);
          console.log('[AppleSpeech] AppleSpeech.generate bytes', dataBytes.byteLength);
        } else {
          console.log('[AppleSpeech] Using experimental_generateSpeech', { voiceId, language });
          const result = await speech({
            model,
            text: trimmed,
            ...(language ? { language } : {}),
            ...(voiceId ? { voice: voiceId } : {}),
          });
          const base64 = result.audio.base64;
          if (!base64) {
            throw new Error('The speech model did not return audio data.');
          }
          dataBase64 = base64;
          fileExtension = result.audio.format || 'wav';
          console.log('[AppleSpeech] experimental_generateSpeech format', fileExtension, 'base64 length', base64.length);
        }

        const baseDir = resolveBaseDirectory();
        if (!baseDir) {
          throw new Error('Unable to access a writable directory for speech audio.');
        }

        const fileName = `apple-speech-${Date.now()}.${fileExtension}`;
        const speechFile = new File(baseDir, fileName);
        try {
          const parent = speechFile.parentDirectory;
          if (!parent.exists) {
            parent.create({ intermediates: true, idempotent: true });
          }
        } catch (dirError) {
          console.warn('Apple speech: failed ensuring audio directory', dirError);
        }

        if (dataBytes) {
          console.log('[AppleSpeech] Writing PCM bytes', dataBytes.byteLength);
          speechFile.write(dataBytes);
        } else if (dataBase64) {
          console.log('[AppleSpeech] Writing base64 payload', dataBase64.length);
          speechFile.write(dataBase64, { encoding: BASE64_ENCODING });
        } else {
          throw new Error('No audio data was generated.');
        }

        const previousUri = audioUriRef.current;
        audioUriRef.current = speechFile.uri;

        try {
          console.log('[AppleSpeech] Starting playback', speechFile.uri);
          player.replace({ uri: speechFile.uri });
          player.play();
          if (mountedRef.current) {
            setPlayingMessageId(messageId);
          }
          console.log('[AppleSpeech] Playback started');
        } catch (playbackError) {
          audioUriRef.current = previousUri ?? null;
          try {
            if (speechFile.exists) {
              speechFile.delete();
            }
          } catch (cleanupErr) {
            console.warn('Apple speech: failed to clean up generated audio', cleanupErr);
          }
          console.warn('[AppleSpeech] Playback failed', playbackError);
          throw playbackError instanceof Error
            ? playbackError
            : new Error(String(playbackError));
        }

        if (previousUri && previousUri !== speechFile.uri) {
          try {
            const previousFile = new File(previousUri);
            if (previousFile.exists) {
              previousFile.delete();
            }
          } catch (err) {
            console.warn('Failed to delete previous speech audio file', err);
          }
        }
      } catch (err: any) {
        const message = err instanceof Error ? err.message : 'Please try again.';
        console.warn('Speech synthesis failed', err);
        Alert.alert('Unable to speak message', message);
        await cleanupAudioFile();
      } finally {
        isGeneratingRef.current = false;
        if (mountedRef.current) {
          setPendingMessageId((current) => (current === messageId ? null : current));
        }
        console.log('[AppleSpeech] Speech generation finished');
      }
    },
    [cleanupAudioFile, ensureVoiceMap, isSupported, player, playingMessageId, resolveBaseDirectory, stop]
  );

  return {
    isSupported,
    speak,
    stop,
    playingMessageId,
    pendingMessageId,
    isPlaying: statusIsPlaying,
  };
}

export function MessageList({ messages, onRequestDelete }: MessageListProps) {
  const insets = useSafeAreaInsets();
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const {
    isSupported: isSpeechSupported,
    speak,
    stop,
    playingMessageId,
    pendingMessageId,
    isPlaying: isSpeechPlaying,
  } = useAppleSpeechPlayback();

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
          const showSpeechOption = isSpeechSupported;
          const messageId = actionMessage.id;
          const isPendingSpeech = pendingMessageId === messageId;
          const isActiveSpeech = playingMessageId === messageId && isSpeechPlaying;

          if (showSpeechOption) {
            if (isActiveSpeech) {
              options.push({ key: 'stop-speech', label: 'Stop Speaking', onPress: wrap(() => stop()) });
            } else {
              options.push({
                key: 'speak',
                label: isPendingSpeech ? 'Preparing Speech...' : 'Speak',
                onPress: wrap(() => {
                  if (!isPendingSpeech) {
                    return speak(messageId, trimmed);
                  }
                }),
              });
            }
          }

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
          const isPendingSpeech = pendingMessageId === item.id;
          const isSpeechMessage = playingMessageId === item.id;
          const showStopButton = isSpeechMessage && isSpeechPlaying;

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
                  <>
                    <Text style={[styles.content, isUser ? styles.userContent : null]}>{trimmedContent || '…'}</Text>
                    {isPendingSpeech ? (
                      <View
                        style={[
                          styles.speechStatusRow,
                          isUser ? styles.speechStatusRowUser : styles.speechStatusRowAssistant,
                        ]}
                      >
                        <ActivityIndicator size="small" color={isUser ? '#FFFFFF' : ACCENT} />
                        <Text
                          style={[
                            styles.speechStatusText,
                            isUser ? styles.speechStatusTextUser : null,
                          ]}
                        >
                          Preparing audio...
                        </Text>
                      </View>
                    ) : null}
                    {showStopButton ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Stop audio playback"
                        onPress={() => {
                          void stop();
                        }}
                        style={[
                          styles.speechStopButton,
                          isUser ? styles.speechStopButtonUser : null,
                        ]}
                      >
                        <Ionicons name="stop" size={14} color={isUser ? '#FFFFFF' : '#DC2626'} />
                        <Text
                          style={[
                            styles.speechStopText,
                            isUser ? styles.speechStopTextUser : null,
                          ]}
                        >
                          Stop audio
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
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
  speechStatusRow: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  speechStatusRowAssistant: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  speechStatusRowUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  speechStatusText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
  },
  speechStatusTextUser: {
    color: '#FFFFFF',
  },
  speechStopButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  speechStopButtonUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  speechStopText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  speechStopTextUser: {
    color: '#FFFFFF',
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
