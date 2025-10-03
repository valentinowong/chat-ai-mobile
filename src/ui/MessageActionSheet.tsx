import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type MessageActionSheetOption = {
  key: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type MessageActionSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  options: MessageActionSheetOption[];
};

export function MessageActionSheet({ visible, onDismiss, options }: MessageActionSheetProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close actions" />
        <View style={styles.sheet}>
          {options.map((option, index) => (
            <Pressable
              key={option.key}
              onPress={option.onPress}
              style={({ pressed }) => [styles.option, pressed ? styles.optionPressed : null, index === 0 ? styles.firstOption : null]}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <Text style={[styles.optionLabel, option.destructive ? styles.optionLabelDestructive : null]}>{option.label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.option, styles.cancelOption, pressed ? styles.optionPressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.optionLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    padding: 24,
  },
  sheet: {
    borderRadius: 18,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionPressed: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  firstOption: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  cancelOption: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  optionLabel: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '500',
  },
  optionLabelDestructive: {
    color: '#FCA5A5',
  },
});

export type { MessageActionSheetOption };
