import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = '#2563EB';

export function InputBar({ onSend, disabled }: { onSend: (t: string) => void; disabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const isDisabled = disabled || trimmed.length === 0;

  function handleSend() {
    if (isDisabled) return;
    Keyboard.dismiss();
    onSend(trimmed);
    setText('');
  }

  return (
    <KeyboardStickyView offset={{ closed: -insets.bottom, opened: 0 }}>
      <View style={[styles.container, { paddingBottom: 12 }]}>
        <View style={styles.inputRow}>
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
