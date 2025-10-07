import { Ionicons } from '@expo/vector-icons';
import { AppleSpeech } from '@react-native-ai/apple';
import type { VoiceInfo } from '@react-native-ai/apple';
import { useAvailableProviders } from '@/src/lib/ai/models';
import { getApiKey, setApiKey } from '@/src/lib/storage/keys';
import {
  DEFAULT_SPEECH_LANGUAGE,
  getAppleSpeechPreferences,
  setAppleSpeechPreferences,
} from '@/src/lib/storage/speech';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Platform,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Settings() {
  const [openai, setOpenAI] = useState('');
  const [google, setGoogle] = useState('');
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const providers = useAvailableProviders();
  const appleAvailable = providers.some((provider) => provider.id === 'apple');
  const [voiceSettingsExpanded, setVoiceSettingsExpanded] = useState(false);
  useEffect(() => { (async () => {
    setOpenAI(await getApiKey('openai'));
    setGoogle(await getApiKey('google'));
  })(); }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const prefs = await getAppleSpeechPreferences();
        if (isMounted) {
          const nextVoiceId = prefs.voiceId ?? null;
          const nextLanguage = normalizeLocale(prefs.language) ?? DEFAULT_SPEECH_LANGUAGE;
          setSelectedVoiceId(nextVoiceId);
          setSelectedLanguage(nextLanguage);
          if (!prefs.language) {
            void setAppleSpeechPreferences({ language: nextLanguage });
          }
        }
      } catch (err) {
        console.warn('Failed to load speech preferences', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!appleAvailable || Platform.OS !== 'ios') {
      setVoices([]);
      return;
    }

    let cancelled = false;
    async function loadVoices() {
      setVoicesLoading(true);
      setVoicesError(null);
      try {
        const list = typeof AppleSpeech?.getVoices === 'function' ? await AppleSpeech.getVoices() : [];
        if (!cancelled) {
          setVoices(Array.isArray(list) ? list : []);
        }
      } catch (err: any) {
        console.warn('Failed to load Apple voices', err);
        if (!cancelled) {
          setVoices([]);
          setVoicesError(err?.message ?? 'Unable to load voices.');
        }
      } finally {
        if (!cancelled) {
          setVoicesLoading(false);
        }
      }
    }

    loadVoices();
    return () => {
      cancelled = true;
    };
  }, [appleAvailable]);

  useEffect(() => {
    if (!selectedVoiceId) {
      return;
    }
    if (voices.length === 0) {
      return;
    }
    const match = voices.find((voice) => voice.identifier === selectedVoiceId);
    if (!match) {
      setSelectedVoiceId(null);
      const fallbackLanguage = normalizeLocale(selectedLanguage) ?? DEFAULT_SPEECH_LANGUAGE;
      setSelectedLanguage(fallbackLanguage);
      void setAppleSpeechPreferences({ voiceId: null, language: fallbackLanguage });
      return;
    }
    const matchLocale = normalizeLocale(match.language) ?? normalizeLocale(selectedLanguage) ?? DEFAULT_SPEECH_LANGUAGE;
    if (selectedLanguage !== matchLocale) {
      setSelectedLanguage(matchLocale);
      void setAppleSpeechPreferences({ language: matchLocale });
    }
  }, [selectedLanguage, selectedVoiceId, voices]);

  const qualityOrder: Record<string, number> = useMemo(
    () => ({ premium: 3, enhanced: 2, default: 1 }),
    []
  );

  const voiceGroupsData = useMemo(() => {
    const langMap = new Map<string, VoiceInfo[]>();
    const personal: VoiceInfo[] = [];

    voices.forEach((voice) => {
      const locale = normalizeLocale(voice.language);

      if (voice.isPersonalVoice) {
        personal.push(voice);
      }

      if (!locale) {
        return;
      }

      const bucket = langMap.get(locale) ?? [];
      bucket.push(voice);
      langMap.set(locale, bucket);
    });

    const entries = Array.from(langMap.entries()).map(([language, list]) => ({
      language,
      voices: list.sort((a, b) => {
        const qa = qualityOrder[a.quality] ?? 0;
        const qb = qualityOrder[b.quality] ?? 0;
        if (qa !== qb) return qb - qa;
        return a.name.localeCompare(b.name);
      }),
    }));

    entries.sort((a, b) => a.language.localeCompare(b.language));
    const map = new Map(entries.map((entry) => [entry.language, entry]));

    const personalVoices = personal.sort((a, b) => a.name.localeCompare(b.name));

    return { entries, map, personalVoices };
  }, [qualityOrder, voices]);

  const voiceGroups = voiceGroupsData.entries;
  const voiceGroupMap = voiceGroupsData.map;
  const personalVoices = voiceGroupsData.personalVoices;

  const languageOptions = useMemo(() => {
    const languages = voiceGroups.map((group) => group.language);
    const unique = Array.from(new Set(languages));
    if (!unique.includes(DEFAULT_SPEECH_LANGUAGE)) {
      return [DEFAULT_SPEECH_LANGUAGE, ...unique];
    }
    return [DEFAULT_SPEECH_LANGUAGE, ...unique.filter((language) => language !== DEFAULT_SPEECH_LANGUAGE)];
  }, [voiceGroups]);

  const handleSelectVoice = useCallback(
    (voice: VoiceInfo | null) => {
      if (voice) {
        const locale = normalizeLocale(voice.language) ?? normalizeLocale(selectedLanguage) ?? DEFAULT_SPEECH_LANGUAGE;
        setSelectedVoiceId(voice.identifier);
        setSelectedLanguage(locale);
        void setAppleSpeechPreferences({ voiceId: voice.identifier, language: locale });
      } else {
        const languageToPersist = normalizeLocale(selectedLanguage) ?? DEFAULT_SPEECH_LANGUAGE;
        setSelectedVoiceId(null);
        setSelectedLanguage(languageToPersist);
        void setAppleSpeechPreferences({ voiceId: null, language: languageToPersist });
      }
    },
    [selectedLanguage]
  );

  const handleSelectLanguage = useCallback((language: string) => {
    const normalized = normalizeLocale(language) ?? DEFAULT_SPEECH_LANGUAGE;
    setSelectedLanguage(normalized);
    void setAppleSpeechPreferences({ language: normalized });
  }, []);

  const languageSelectionDisabled = Boolean(selectedVoiceId);
  const activeLanguage = normalizeLocale(selectedLanguage) ?? DEFAULT_SPEECH_LANGUAGE;
  const activeVoices = voiceGroupMap.get(activeLanguage)?.voices ?? [];

  const voiceSummary = useMemo(() => {
    if (selectedVoiceId) {
      const match = voices.find((voice) => voice.identifier === selectedVoiceId);
      if (match) {
        const localeLabel = normalizeLocale(match.language);
        if (match.isPersonalVoice) {
          return `${match.name} • Personal Voice${localeLabel ? ` • ${localeLabel}` : ''}`;
        }
        return localeLabel ? `${match.name} • ${localeLabel}` : match.name;
      }
      return 'Custom voice selected';
    }
    return `System default voice • ${activeLanguage}`;
  }, [activeLanguage, selectedVoiceId, voices]);

  const toggleVoiceSettings = useCallback(() => {
    setVoiceSettingsExpanded((current) => !current);
  }, []);

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

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Apple Intelligence</Text>
                <Text style={styles.helper}>
                  {appleAvailable
                    ? 'Available on this device. No API key required.'
                    : 'Requires an Apple Intelligence capable device; no API key needed when available.'}
                </Text>
              </View>

              {appleAvailable && Platform.OS === 'ios' ? (
                <View style={styles.fieldGroup}>
                  <Pressable
                    onPress={toggleVoiceSettings}
                    style={({ pressed }) => [styles.voiceSummaryCard, pressed ? styles.voiceSummaryCardPressed : null]}
                  >
                    <View style={styles.voiceSummaryContent}>
                      <Text style={styles.label}>Text-to-speech voice</Text>
                      <Text style={styles.helper}>{voiceSummary}</Text>
                    </View>
                    <Ionicons
                      name={voiceSettingsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#0F172A"
                    />
                  </Pressable>

                  {voiceSettingsExpanded ? (
                    <View style={styles.voicePanel}>
                      <View
                        style={[
                          styles.languageSelector,
                          languageSelectionDisabled ? styles.languageSelectorDisabled : null,
                        ]}
                        pointerEvents={languageSelectionDisabled ? 'none' : 'auto'}
                      >
                        <Text style={styles.label}>Voice language</Text>
                        <Text style={styles.helper}>
                          Showing voices for {activeLanguage}.
                          {languageSelectionDisabled ? ' (Locked to the selected voice.)' : ''}
                        </Text>
                        <View style={styles.languageList}>
                          {languageOptions.map((language) => {
                            const isActive = activeLanguage === language;
                            return (
                              <Pressable
                                key={language}
                                onPress={() => handleSelectLanguage(language)}
                                style={({ pressed }) => [
                                  styles.languagePill,
                                  isActive ? styles.languagePillActive : null,
                                  pressed ? styles.languagePillPressed : null,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.languagePillText,
                                    isActive ? styles.languagePillTextActive : null,
                                  ]}
                                >
                                  {language}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      <Pressable
                        onPress={() => handleSelectVoice(null)}
                        style={({ pressed }) => [
                          styles.voiceOption,
                          styles.voiceOptionSystem,
                          !selectedVoiceId ? styles.voiceOptionActive : null,
                          pressed ? styles.voiceOptionPressed : null,
                        ]}
                      >
                        <Text style={styles.voiceOptionTitle}>System default voice</Text>
                        <Text style={styles.voiceOptionSubtitle}>
                          Uses the device default voice for {activeLanguage}.
                        </Text>
                        {!selectedVoiceId ? (
                          <Text style={styles.voiceOptionSelected}>Active</Text>
                        ) : null}
                      </Pressable>

                      {voicesLoading ? (
                        <View style={styles.voiceLoadingRow}>
                          <ActivityIndicator size="small" color={ACCENT} />
                          <Text style={styles.voiceLoadingText}>Loading available voices…</Text>
                        </View>
                      ) : voicesError ? (
                        <Text style={styles.voiceError}>{voicesError}</Text>
                      ) : activeVoices.length > 0 ? (
                        activeVoices.map((voice) => {
                          const isActive = selectedVoiceId === voice.identifier;
                          const showBadges = voice.isPersonalVoice || voice.isNoveltyVoice;
                          return (
                            <Pressable
                              key={voice.identifier}
                              onPress={() => handleSelectVoice(voice)}
                              style={({ pressed }) => [
                                styles.voiceOption,
                                isActive ? styles.voiceOptionActive : null,
                                pressed ? styles.voiceOptionPressed : null,
                              ]}
                            >
                              <Text style={styles.voiceOptionTitle}>{voice.name}</Text>
                              <Text style={styles.voiceOptionSubtitle}>
                                {voice.quality
                                  ? voice.quality.replace(/\b\w/g, (c) => c.toUpperCase())
                                  : 'Standard'}
                              </Text>
                              {showBadges ? (
                                <View style={styles.voiceBadgesRow}>
                                  {voice.isPersonalVoice ? (
                                    <Text style={styles.voiceOptionBadge}>Personal Voice</Text>
                                  ) : null}
                                  {voice.isNoveltyVoice ? (
                                    <Text style={styles.voiceOptionBadge}>Novelty</Text>
                                  ) : null}
                                </View>
                              ) : null}
                              {isActive ? <Text style={styles.voiceOptionSelected}>Active</Text> : null}
                            </Pressable>
                          );
                        })
                      ) : (
                        <Text style={[styles.helper, styles.voiceEmptyHelper]}>
                          No additional voices available for {activeLanguage}.
                        </Text>
                      )}

                      {personalVoices.length > 0 ? (
                        <View style={styles.personalVoicesSection}>
                          <Text style={styles.personalVoicesTitle}>Personal Voices</Text>
                          <Text style={styles.helper}>
                            Voices you have created on this device.
                          </Text>
                          {personalVoices.map((voice) => {
                            const isActive = selectedVoiceId === voice.identifier;
                            return (
                              <Pressable
                                key={voice.identifier}
                                onPress={() => handleSelectVoice(voice)}
                                style={({ pressed }) => [
                                  styles.voiceOption,
                                  isActive ? styles.voiceOptionActive : null,
                                  pressed ? styles.voiceOptionPressed : null,
                                ]}
                              >
                                <Text style={styles.voiceOptionTitle}>{voice.name}</Text>
                                <Text style={styles.voiceOptionSubtitle}>Personal Voice</Text>
                                {isActive ? <Text style={styles.voiceOptionSelected}>Active</Text> : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

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

function normalizeLocale(locale: string | null | undefined): string | null {
  if (!locale) return null;
  const trimmed = locale.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace('_', '-');
  const parts = normalized.split('-');
  if (parts.length === 1) {
    return parts[0].toLowerCase();
  }
  return `${parts[0].toLowerCase()}-${parts
    .slice(1)
    .map((part) => part.length === 2 ? part.toUpperCase() : part)
    .join('-')}`;
}

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
  voiceEmptyHelper: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  personalVoicesSection: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  personalVoicesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  voicePanel: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    paddingBottom: 16,
  },
  voiceOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: '#FFFFFF',
  },
  voiceOptionSystem: {
    marginTop: 16,
  },
  voiceOptionActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderBottomColor: 'rgba(37, 99, 235, 0.25)',
  },
  voiceOptionPressed: {
    opacity: 0.85,
  },
  voiceOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  voiceOptionSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  voiceOptionBadge: {
    marginTop: 6,
    marginRight: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '600',
  },
  voiceBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  voiceOptionSelected: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
  },
  voiceSummaryCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceSummaryCardPressed: {
    opacity: 0.9,
  },
  voiceSummaryContent: {
    flex: 1,
    paddingRight: 16,
  },
  voiceLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  voiceLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#475569',
  },
  voiceError: {
    marginTop: 12,
    fontSize: 13,
    color: '#DC2626',
    paddingHorizontal: 16,
  },
  languageSelector: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  languageSelectorDisabled: {
    opacity: 0.6,
  },
  languageList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  languagePill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  languagePillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  languagePillPressed: {
    opacity: 0.85,
  },
  languagePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  languagePillTextActive: {
    color: '#FFFFFF',
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
