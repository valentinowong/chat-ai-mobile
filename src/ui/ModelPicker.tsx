import { BottomSheetBackdrop, BottomSheetModal } from '@gorhom/bottom-sheet';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { PROVIDERS } from '../lib/ai/models';

type ProviderId = 'openai' | 'google';

type PickerValue = { provider: ProviderId; model: string };

type Props = {
  value: PickerValue;
  onChange: (v: PickerValue) => void;
  buttonStyle?: any;
  textStyle?: any;
  placeholderText?: string;
};

export function ModelPicker({
  value,
  onChange,
  buttonStyle,
  textStyle,
  placeholderText = 'Select model',
}: Props) {
  const modalRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState('');
  const snapPoints = useMemo(() => ['35%', '75%'], []);

  const open = useCallback(() => {
    if (Platform.OS === 'web') {
      setWebOpen(true);
    } else {
      modalRef.current?.present();
    }
  }, []);

  const close = useCallback(() => {
    if (Platform.OS === 'web') {
      setWebOpen(false);
    } else {
      modalRef.current?.dismiss();
    }
  }, []);

  // Simple Web fallback using Modal (BottomSheet not ideal on web)
  const [webOpen, setWebOpen] = useState(false);

  const currentLabel = useMemo(() => {
    const provider = PROVIDERS[value?.provider as ProviderId];
    const model = provider?.models.find(m => m.id === value?.model);
    if (provider && model) return `${provider.label} · ${model.label}`;
    return placeholderText;
  }, [value, placeholderText]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entries: Array<
      | { kind: 'header'; id: string; text: string }
      | { kind: 'item'; id: string; provider: ProviderId; modelId: string; text: string }
    > = [];
    (Object.keys(PROVIDERS) as ProviderId[]).forEach((pid) => {
      const p = PROVIDERS[pid];
      const filtered = p.models.filter(
        (m) =>
          !q ||
          m.label.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          p.label.toLowerCase().includes(q)
      );
      if (filtered.length > 0) {
        entries.push({ kind: 'header', id: `h:${pid}`, text: p.label });
        filtered.forEach((m) => {
          entries.push({
            kind: 'item',
            id: `${pid}:${m.id}`,
            provider: pid,
            modelId: m.id,
            text: `${m.label} (${m.id})`,
          });
        });
      }
    });
    return entries;
  }, [query]);

  function select(provider: ProviderId, modelId: string) {
    onChange({ provider, model: modelId });
    close();
  }

  const Content = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
      <View style={{ paddingTop: 8, paddingBottom: 12 }}>
        <TextInput
          placeholder="Search models"
          value={query}
          onChangeText={setQuery}
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <ScrollView style={{ maxHeight: 480 }}>
        {rows.map((row) =>
          row.kind === 'header' ? (
            <Text
              key={row.id}
              style={{ fontWeight: '600', opacity: 0.7, marginTop: 12, marginBottom: 6 }}
            >
              {row.text}
            </Text>
          ) : (
            <Pressable
              key={row.id}
              onPress={() => select(row.provider, row.modelId)}
              style={{
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
              }}
            >
              <Text>
                {row.text}{' '}
                {value?.provider === row.provider && value?.model === row.modelId ? '✓' : ''}
              </Text>
            </Pressable>
          )
        )}
        {rows.length === 0 && (
          <Text style={{ opacity: 0.6, paddingVertical: 12 }}>No matches</Text>
        )}
      </ScrollView>
    </View>
  );

  return (
    <>
      <Pressable
        onPress={open}
        style={[
          {
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 10,
          },
          buttonStyle,
        ]}
      >
        <Text style={textStyle}>{currentLabel}</Text>
      </Pressable>

      {Platform.OS === 'web' ? (
        <Modal transparent visible={webOpen} animationType="fade" onRequestClose={close}>
          <Pressable
            onPress={close}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-end',
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: 'white',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: '80%',
                paddingTop: 12,
              }}
            >
              <View
                style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#ddd',
                  marginBottom: 8,
                }}
              />
              {Content}
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        <BottomSheetModal
          ref={modalRef}
          snapPoints={snapPoints}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              pressBehavior="close"
            />
          )}
          enablePanDownToClose
        >
          {Content}
        </BottomSheetModal>
      )}
    </>
  );
}