import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type FullscreenImageModalProps = {
  uri: string | null;
  onClose: () => void;
};

const AnimatedImage = Animated.createAnimatedComponent(Image);

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function FullscreenImageModal({ uri, onClose }: FullscreenImageModalProps) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const storedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const storedTranslateX = useSharedValue(0);
  const storedTranslateY = useSharedValue(0);
  const containerWidth = useSharedValue(0);
  const containerHeight = useSharedValue(0);

  useEffect(() => {
    if (!uri) {
      scale.value = 1;
      storedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      storedTranslateX.value = 0;
      storedTranslateY.value = 0;
    }
  }, [uri, scale, storedScale, translateX, translateY, storedTranslateX, storedTranslateY]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const nextScale = clamp(storedScale.value * event.scale, 1, 4);
      scale.value = nextScale;
    })
    .onEnd(() => {
      storedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        storedTranslateX.value = 0;
        storedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      storedTranslateX.value = translateX.value;
      storedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      const boundX = (scale.value - 1) * (containerWidth.value / 2);
      const boundY = (scale.value - 1) * (containerHeight.value / 2);
      const nextX = clamp(storedTranslateX.value + event.translationX, -boundX, boundX);
      const nextY = clamp(storedTranslateY.value + event.translationY, -boundY, boundY);
      translateX.value = nextX;
      translateY.value = nextY;
    })
    .onEnd(() => {
      storedTranslateX.value = translateX.value;
      storedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (!success) return;
      if (scale.value > 1) {
        scale.value = withTiming(1);
        storedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        storedTranslateX.value = 0;
        storedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2);
        storedScale.value = 2;
      }
    });

  const composedGesture = Gesture.Simultaneous(doubleTapGesture, pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingLeft: insets.left + 24,
            paddingRight: insets.right + 24,
          },
        ]}
      >
        <View
          style={styles.viewer}
          onLayout={({ nativeEvent }) => {
            containerWidth.value = nativeEvent.layout.width;
            containerHeight.value = nativeEvent.layout.height;
          }}
        >
          {uri ? (
            <GestureDetector gesture={composedGesture}>
              <View style={styles.imageWrapper}>
                <AnimatedImage
                  source={{ uri }}
                  style={[styles.image, animatedStyle]}
                  contentFit="contain"
                  accessibilityRole="image"
                  accessibilityLabel="Full screen generated image"
                />
              </View>
            </GestureDetector>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close full screen image"
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + 16, right: insets.right + 16 }]}
          hitSlop={12}
        >
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
  },
  viewer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  closeLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
