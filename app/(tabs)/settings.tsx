import { getApiKey, setApiKey } from '@/src/lib/storage/keys';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Settings</Text>
          <Text style={styles.heroTitle}>Your API keys</Text>
          <Text style={styles.heroSubtitle}>Store keys securely on device to enable each provider.</Text>
        </View>

        <View style={styles.contentWrapper}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Providers</Text>
              <Text style={styles.cardSubtitle}>Keys are kept locally using secure storage.</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>OpenAI</Text>
                <TextInput
                  placeholder="sk-..."
                  placeholderTextColor="rgba(148, 163, 184, 0.7)"
                  value={openai}
                  onChangeText={setOpenAI}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Text style={styles.helper}>Used for GPT models such as GPT-5.</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Google Gemini</Text>
                <TextInput
                  placeholder="AIza..."
                  placeholderTextColor="rgba(148, 163, 184, 0.7)"
                  value={google}
                  onChangeText={setGoogle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Text style={styles.helper}>Unlock Gemini 2.5 Pro and other Google models.</Text>
              </View>

              <Pressable
                onPress={save}
                style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
              >
                <Text style={styles.saveButtonText}>Save changes</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const CANVAS = '#0F172A';
const ACCENT = '#2563EB';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: CANVAS,
  },
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
    backgroundColor: CANVAS,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroEyebrow: {
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  contentWrapper: {
    flex: 1,
    marginTop: -12,
    paddingHorizontal: 20,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  input: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  helper: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
