import { Ionicons } from '@expo/vector-icons';
import { apple } from '@react-native-ai/apple';
import { experimental_transcribe as transcribe } from 'ai';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  setAudioModeAsync,
} from 'expo-audio';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = '#2563EB';
const RECORDING = '#DC2626';

const MAX_REFERENCE_IMAGES = 3;

export type ImageAttachmentPayload = {
  uri: string;
  base64: string;
  mimeType: string;
};

type ImageAttachmentDraft = ImageAttachmentPayload & { id: string };

type InputBarProps = {
  onSend: (payload: { text: string; attachments: ImageAttachmentPayload[] }) => void;
  disabled?: boolean;
  allowImageAttachments?: boolean;
};

export function InputBar({
  onSend,
  disabled,
  allowImageAttachments = false,
}: InputBarProps) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [attachments, setAttachments] = useState<ImageAttachmentDraft[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const showSpeechControl = isSpeechSupported;
  const recordingModeRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function checkAvailability() {
      if (Platform.OS !== 'ios' || typeof apple?.isAvailable !== 'function') {
        if (mounted) setIsSpeechSupported(false);
        return;
      }

      try {
        const available = await apple.isAvailable();
        if (mounted) {
          setIsSpeechSupported(Boolean(available));
        }
      } catch (err) {
        console.warn('Failed to check Apple Intelligence availability', err);
        if (mounted) {
          setIsSpeechSupported(false);
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
      if (recordingModeRef.current) {
        recordingModeRef.current = false;
        setAudioModeAsync({ allowsRecording: false }).catch((err) => {
          console.warn('Failed to reset audio mode on unmount', err);
        });
      }
    };
  }, []);

  const trimmed = text.trim();
  const isDisabled = disabled || trimmed.length === 0;
  const attachmentButtonDisabled = !allowImageAttachments || attachments.length >= MAX_REFERENCE_IMAGES;

  const appendTranscription = useCallback((transcript: string) => {
    setText((current) => {
      const value = transcript.trim();
      if (value.length === 0) return current;
      if (current.trim().length === 0) return value;
      const needsSpace = !/\s$/.test(current);
      return `${current}${needsSpace ? ' ' : ''}${value}`;
    });
  }, []);

  function handleSend() {
    if (isDisabled) return;
    Keyboard.dismiss();
    const payloadAttachments = attachments.map(({ base64, mimeType, uri }) => ({ base64, mimeType, uri }));
    onSend({ text: trimmed, attachments: payloadAttachments });
    setText('');
    setAttachments([]);
  }

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }, []);

  const handlePickImages = useCallback(async () => {
    if (!allowImageAttachments) {
      return;
    }
    if (attachments.length >= MAX_REFERENCE_IMAGES) {
      Alert.alert('Attachment limit reached', `You can attach up to ${MAX_REFERENCE_IMAGES} images.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos access needed', 'Enable access to the photo library to attach images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        base64: true,
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const remaining = MAX_REFERENCE_IMAGES - attachments.length;
      const selected = (result.assets ?? []).slice(0, remaining);
      const next: ImageAttachmentDraft[] = [];

      for (const asset of selected) {
        if (!asset?.uri) continue;

        let base64 = asset.base64 ?? null;
        if (!base64) {
          try {
            const file = new File(asset.uri);
            const maybeBase64 = file.base64();
            base64 = typeof maybeBase64 === 'string' ? maybeBase64 : await maybeBase64;
          } catch (err) {
            console.warn('Failed to read selected image', err);
            base64 = null;
          }
        }

        if (!base64) {
          continue;
        }

        const mimeType = asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
        next.push({ id: randomUUID(), uri: asset.uri, base64, mimeType });
      }

      if (next.length === 0) {
        Alert.alert('Image unavailable', 'Could not read the selected image. Please try again.');
        return;
      }

      setAttachments((current) => {
        const combined = [...current, ...next];
        return combined.slice(0, MAX_REFERENCE_IMAGES);
      });
    } catch (err: any) {
      console.warn('Failed to pick image', err);
      Alert.alert('Image selection failed', err?.message ?? 'Please try again.');
    }
  }, [allowImageAttachments, attachments.length]);

  const ensureRecordingPermissions = useCallback(async () => {
    try {
      const existing = await getRecordingPermissionsAsync();
      if (existing?.status === 'granted') {
        return true;
      }

      if (existing && existing.status === 'denied' && !existing.canAskAgain) {
        Alert.alert(
          'Microphone access needed',
          'Enable microphone access in Settings to use voice transcription.'
        );
        return false;
      }

      const requested = await requestRecordingPermissionsAsync();
      if (requested?.status === 'granted') {
        return true;
      }

      Alert.alert(
        'Microphone access needed',
        'Enable microphone access in Settings to use voice transcription.'
      );
      return false;
    } catch (err: any) {
      console.warn('Microphone permission check failed', err);
      Alert.alert('Unable to access microphone', 'Please try again.');
      return false;
    }
  }, []);

  const enableRecordingMode = useCallback(async () => {
    if (recordingModeRef.current) {
      return true;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      recordingModeRef.current = true;
      return true;
    } catch (err: any) {
      console.warn('Failed to enable recording audio mode', err);
      Alert.alert(
        'Recording unavailable',
        err?.message ?? 'Unable to activate audio session for recording.'
      );
      return false;
    }
  }, []);

  const disableRecordingMode = useCallback(async () => {
    if (!recordingModeRef.current) {
      return;
    }
    recordingModeRef.current = false;
    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch (err) {
      console.warn('Failed to reset audio mode', err);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing) return;
    if (!showSpeechControl) return;

    const hasPermission = await ensureRecordingPermissions();
    if (!hasPermission) return;

    try {
      Keyboard.dismiss();
      const activated = await enableRecordingMode();
      if (!activated) {
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (err: any) {
      console.warn('Failed to start recording', err);
      Alert.alert('Recording unavailable', err?.message ?? 'Please try again.');
      setIsRecording(false);
      await disableRecordingMode();
    }
  }, [
    disableRecordingMode,
    enableRecordingMode,
    ensureRecordingPermissions,
    isRecording,
    isTranscribing,
    recorder,
    showSpeechControl,
  ]);

  const transcribeRecording = useCallback(
    async (uri: string) => {
      setIsTranscribing(true);
      let recordingFile: File | null = null;
      try {
        recordingFile = new File(uri);
        const maybeBase64 = recordingFile.base64();
        const base64 = typeof maybeBase64 === 'string' ? maybeBase64 : await maybeBase64;

        const model = apple?.transcriptionModel?.();
        if (!model) {
          Alert.alert(
            'Transcription unavailable',
            'Apple transcription is not available on this device.'
          );
          return;
        }

        const result = await transcribe({
          model,
          audio: base64,
        });

        appendTranscription(result.text);
      } catch (err: any) {
        console.warn('Transcription failed', err);
        Alert.alert('Transcription failed', err?.message ?? 'Please try again.');
      } finally {
        setIsTranscribing(false);
        try {
          if (recordingFile?.exists) {
            recordingFile.delete();
          }
        } catch (cleanupError) {
          console.warn('Failed to clean up recording file', cleanupError);
        }
      }
    },
    [appendTranscription]
  );

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);

    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }

      const uri = recorder.uri;
      if (!uri) {
        Alert.alert('Recording unavailable', 'No audio was captured.');
        return;
      }

      await transcribeRecording(uri);
    } catch (err: any) {
      console.warn('Failed to stop recording', err);
      Alert.alert('Recording failed', err?.message ?? 'Please try again.');
    } finally {
      await disableRecordingMode();
    }
  }, [disableRecordingMode, isRecording, recorder, transcribeRecording]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const micButtonAccessibilityLabel = useMemo(
    () => (isRecording ? 'Stop voice input' : 'Start voice input'),
    [isRecording]
  );

  return (
    <KeyboardStickyView offset={{ closed: -insets.bottom, opened: 0 }}>
      <View style={[styles.container, { paddingBottom: 12 }]}>
        {allowImageAttachments && attachments.length > 0 ? (
          <View style={styles.attachmentsRow}>
            {attachments.map((attachment) => (
              <View key={attachment.id} style={styles.attachmentThumbWrapper}>
                <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove image"
                  onPress={() => handleRemoveAttachment(attachment.id)}
                  style={styles.attachmentRemoveButton}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.inputRow}>
          {showSpeechControl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={micButtonAccessibilityLabel}
              onPress={handleToggleRecording}
              disabled={isTranscribing}
              style={({ pressed }) => [
                styles.micButton,
                isRecording ? styles.micButtonRecording : null,
                isTranscribing ? styles.micButtonDisabled : null,
                pressed && !isTranscribing ? styles.micButtonPressed : null,
              ]}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color={isRecording ? '#FFFFFF' : ACCENT} />
              ) : (
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={18}
                  color={isRecording ? '#FFFFFF' : ACCENT}
                />
              )}
            </Pressable>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="Message"
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSend}
          />
          {allowImageAttachments ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach reference image"
              onPress={handlePickImages}
              disabled={attachmentButtonDisabled}
              style={({ pressed }) => [
                styles.attachmentButton,
                pressed && !attachmentButtonDisabled ? styles.attachmentButtonPressed : null,
                attachmentButtonDisabled ? styles.attachmentButtonDisabled : null,
              ]}
            >
              <Ionicons
                name="image"
                size={18}
                color={attachmentButtonDisabled ? '#9CA3AF' : ACCENT}
              />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={handleSend}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && !isDisabled ? styles.sendButtonPressed : null,
              isDisabled ? styles.sendButtonDisabled : null,
            ]}
          >
            <Ionicons name="paper-plane" size={18} color={isDisabled ? '#9CA3AF' : '#FFFFFF'} />
          </Pressable>
        </View>
      </View>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachmentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  attachmentThumbWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  attachmentThumb: {
    width: '100%',
    height: '100%',
  },
  attachmentRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 44,
    height: 44,
    marginRight: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    backgroundColor: RECORDING,
    borderColor: RECORDING,
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  micButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 160,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  attachmentButton: {
    marginLeft: 12,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  attachmentButtonDisabled: {
    opacity: 0.5,
  },
  sendButton: {
    marginLeft: 12,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 9,
    elevation: 2,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
});
