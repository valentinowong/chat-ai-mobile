import { useState } from 'react';
import { Button, TextInput, View } from 'react-native';
import { KeyboardControllerView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function InputBar({ onSend, disabled }: { onSend: (t: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  return (
    <KeyboardControllerView style={{ padding: 8, paddingBottom: 8 + insets.bottom, borderTopWidth: 1, borderColor: '#eee' }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={{ flex: 1, padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8 }}
          placeholder="Message"
          value={text}
          onChangeText={setText}
        />
        <Button title="Send" onPress={() => { if (text.trim()) { onSend(text); setText(''); } }} disabled={disabled} />
      </View>
    </KeyboardControllerView>
  );
}