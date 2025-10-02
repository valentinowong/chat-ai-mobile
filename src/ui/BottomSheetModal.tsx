import type { ReactNode } from 'react';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export type BottomSheetModalRef = {
  present: () => void;
  dismiss: () => void;
};

type BottomSheetModalProps = {
  children: ReactNode;
  maxHeight?: number | string;
  onDismiss?: () => void;
  allowBackdropPress?: boolean;
};

export const BottomSheetModal = forwardRef<BottomSheetModalRef, BottomSheetModalProps>(
  ({ children, maxHeight = '75%', onDismiss, allowBackdropPress = true }, ref) => {
    const [visible, setVisible] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;

    const animateTo = useCallback(
      (to: number, done?: () => void) => {
        Animated.timing(progress, {
          toValue: to,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(done);
      },
      [progress]
    );

    const present = useCallback(() => {
      if (visible) return;
      setVisible(true);
      progress.setValue(0);
      requestAnimationFrame(() => animateTo(1));
    }, [animateTo, progress, visible]);

    const dismiss = useCallback(() => {
      animateTo(0, () => {
        setVisible(false);
        onDismiss?.();
      });
    }, [animateTo, onDismiss]);

    useImperativeHandle(ref, () => ({ present, dismiss }), [present, dismiss]);

    if (!visible) return null;

    const translateY = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [SCREEN_HEIGHT, 0],
    });
    const backdropOpacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.4],
    });

    return (
      <Modal transparent visible animationType="none" onRequestClose={dismiss} statusBarTranslucent>
        <View style={styles.fill}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}
            pointerEvents={allowBackdropPress ? 'auto' : 'none'}
          >
            {allowBackdropPress ? (
              <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
            ) : null}
          </Animated.View>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }], maxHeight }]}
            pointerEvents="box-none"
          >
            <SafeAreaView style={styles.sheetContent} edges={['bottom']}>
              <View style={styles.grabber} />
              {children}
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    );
  }
);
BottomSheetModal.displayName = 'BottomSheetModal';

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  sheetContent: {
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5F5',
    marginBottom: 12,
  },
});
