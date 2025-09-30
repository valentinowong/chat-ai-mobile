import { getApiKey, setApiKey } from '@/src/lib/storage/keys';
import { useEffect, useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Settings() {
  const [openai, setOpenAI] = useState('');
  const [google, setGoogle] = useState('');
  useEffect(() => { (async () => {
    setOpenAI(await getApiKey('openai'));
    setGoogle(await getApiKey('google'));
  })(); }, []);

  async function save() {
    await setApiKey('openai', openai.trim());
    await setApiKey('google', google.trim());
    Alert.alert('Saved');
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text>OpenAI API Key</Text>
        <TextInput placeholder="sk-..." value={openai} onChangeText={setOpenAI} autoCapitalize='none' style={{ borderWidth: 1, padding: 8 }} />
        <Text>Google (Gemini) API Key</Text>
        <TextInput placeholder="AIza..." value={google} onChangeText={setGoogle} autoCapitalize='none' style={{ borderWidth: 1, padding: 8 }} />
        <Button title="Save" onPress={save} />
      </View>
    </SafeAreaView>
  );
}