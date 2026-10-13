import React, { useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  StyleProp,
  ViewStyle,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TranslationToggleButtonProps {
  isExpanded: boolean;
  isLoading?: boolean;
  onToggle: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PILL_LAYOUT_ANIM = LayoutAnimation.create(
  200,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity
);

// Sleek 3-dot wave loader that matches the exact 16px icon footprint (zero height jump)
function SmoothDotsLoader() {
  const useNative = Platform.OS !== 'web';
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;
  const dot3 = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const createDotLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
          Animated.timing(anim, {
            toValue: 0.35,
            duration: 320,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: useNative,
          }),
        ])
      );

    const l1 = createDotLoop(dot1, 0);
    const l2 = createDotLoop(dot2, 110);
    const l3 = createDotLoop(dot3, 220);

    l1.start();
    l2.start();
    l3.start();

    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [dot1, dot2, dot3, useNative]);

  const makeDotStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0.35, 1],
          outputRange: [0.8, 1.15],
        }),
      },
    ],
  });

  return (
    <View style={styles.dotsLoaderContainer}>
      <Animated.View style={[styles.loaderDot, makeDotStyle(dot1)]} />
      <Animated.View style={[styles.loaderDot, makeDotStyle(dot2)]} />
      <Animated.View style={[styles.loaderDot, makeDotStyle(dot3)]} />
    </View>
  );
}

export function TranslationToggleButton({
  isExpanded,
  isLoading = false,
  onToggle,
  disabled = false,
  style,
}: TranslationToggleButtonProps) {
  const useNative = Platform.OS !== 'web';

  // Tactile press scale animation
  const pressScaleAnim = useRef(new Animated.Value(1)).current;
  // Content pop/fade when switching states
  const contentAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    LayoutAnimation.configureNext(PILL_LAYOUT_ANIM);
    contentAnim.setValue(0.6);
    Animated.spring(contentAnim, {
      toValue: 1,
      tension: 120,
      friction: 8,
      useNativeDriver: useNative,
    }).start();
  }, [isExpanded, isLoading, contentAnim, useNative]);

  const handlePressIn = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 0.94,
      tension: 180,
      friction: 9,
      useNativeDriver: useNative,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 1,
      tension: 140,
      friction: 7,
      useNativeDriver: useNative,
    }).start();
  };

  const handlePress = () => {
    LayoutAnimation.configureNext(PILL_LAYOUT_ANIM);
    onToggle();
  };

  const showSpinner = isLoading;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { transform: [{ scale: pressScaleAnim }] },
        style,
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || isLoading}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? 'Hide Translation' : 'Show Translation'}
        style={[
          styles.container,
          isExpanded && !showSpinner && styles.containerExpanded,
          disabled && styles.disabled,
        ]}
      >
        <Animated.View
          style={[
            styles.innerRow,
            {
              opacity: contentAnim,
              transform: [
                {
                  scale: contentAnim.interpolate({
                    inputRange: [0.6, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {showSpinner ? (
            <SmoothDotsLoader />
          ) : (
            <Ionicons
              name="language-outline"
              size={16}
              color={isExpanded ? '#0F172A' : '#64748B'}
              style={styles.icon}
            />
          )}

          <Text
            style={[
              styles.buttonText,
              isExpanded && !showSpinner && styles.buttonTextExpanded,
            ]}
          >
            {showSpinner
              ? 'Translating...'
              : isExpanded
              ? 'Hide Translation'
              : 'Show Translation'}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  containerExpanded: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    opacity: 0.85,
  },
  dotsLoaderContainer: {
    width: 18,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  loaderDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#64748B',
  },
  buttonText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 13.5,
    color: '#64748B',
    letterSpacing: -0.2,
  },
  buttonTextExpanded: {
    color: '#334155',
  },
});