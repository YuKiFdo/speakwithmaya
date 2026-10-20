import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';

interface ConnectingViewProps {
  onCancel?: () => void;
  style?: any;
  isConnected?: boolean;
}

/**
 * Isolated title component so the 500ms dot ticker never re-renders the orbital rings or tips,
 * and uses fixed-width opacity dots so "Connecting to Maya" never shifts left/right when centered!
 */
const ConnectingTitle = React.memo(function ConnectingTitle({
  isConnected,
}: {
  isConnected: boolean;
}) {
  const [dotCount, setDotCount] = useState(2);
  const useNative = Platform.OS !== 'web';
  const connectedTextPop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isConnected) {
      connectedTextPop.setValue(0.92);
      Animated.spring(connectedTextPop, {
        toValue: 1,
        tension: 120,
        friction: 6,
        useNativeDriver: useNative,
      }).start();
      return;
    }

    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 480);

    return () => clearInterval(dotInterval);
  }, [isConnected, connectedTextPop, useNative]);

  if (isConnected) {
    return (
      <Animated.Text
        style={[
          styles.title,
          styles.titleConnected,
          { transform: [{ scale: connectedTextPop }] },
        ]}
      >
        Connected!
      </Animated.Text>
    );
  }

  return (
    <Text style={styles.title}>
      Connecting to Maya
      <Text style={dotCount >= 1 ? styles.dotVisible : styles.dotHidden}>.</Text>
      <Text style={dotCount >= 2 ? styles.dotVisible : styles.dotHidden}>.</Text>
      <Text style={dotCount >= 3 ? styles.dotVisible : styles.dotHidden}>.</Text>
    </Text>
  );
});

export function ConnectingView({
  onCancel,
  style,
  isConnected = false,
}: ConnectingViewProps) {
  const [isCancelHovered, setIsCancelHovered] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<number | null>(null);
  const { isPhone, width: windowWidth, height: windowHeight } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const useNative = Platform.OS !== 'web';

  // Dynamic bottom padding to ensure Quick Tips card comes up above gesture bars and mobile browser chrome
  const bottomPadding = Math.max(
    insets.bottom + 24,
    Platform.select({ web: 64, ios: 52, default: 44 })
  );

  // Dynamic hero animation size: compact and visually balanced with Quick Tips card
  const heroSize = useMemo(() => {
    const heightBased = Math.round(windowHeight * 0.28);
    const contentWidth = isPhone ? windowWidth : Math.min(windowWidth, 440);
    const maxSafeWidth = Math.round(contentWidth - 80);
    return Math.min(240, maxSafeWidth, Math.max(180, heightBased));
  }, [windowHeight, windowWidth, isPhone]);

  const dashedRingSize = Math.round(heroSize * 0.9);
  const haloSize = Math.round(heroSize * 0.72);
  const avatarContainerSize = Math.round(heroSize * 0.54);
  const avatarInnerSize = avatarContainerSize - 6;
  const dotSize = Math.max(7, Math.round(heroSize * 0.034));
  const dotOffset = Math.round(dashedRingSize * 0.146 - (dotSize - 7) / 2);

  // Continuous loop animation values
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Entrance & Connected pop values
  const heroEntranceAnim = useRef(new Animated.Value(0)).current;
  const connectedPopAnim = useRef(new Animated.Value(1)).current;
  const cardEntranceAnim = useRef(new Animated.Value(0)).current;
  const tip1Anim = useRef(new Animated.Value(0)).current;
  const tip2Anim = useRef(new Animated.Value(0)).current;
  const tip3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Continuous smooth rotation for orbital ring and satellite dots
    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: useNative,
      })
    );

    // 2. Subtle sine breathing pulse for concentric rings
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.045,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );

    // 3. Gentle avatar levitation
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );

    // 4. Smooth staggered entrance for Hero, Tips Card, and Tip Rows
    Animated.parallel([
      Animated.spring(heroEntranceAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: useNative,
      }),
      Animated.timing(cardEntranceAnim, {
        toValue: 1,
        duration: 380,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      Animated.stagger(110, [
        Animated.spring(tip1Anim, {
          toValue: 1,
          tension: 75,
          friction: 8,
          useNativeDriver: useNative,
        }),
        Animated.spring(tip2Anim, {
          toValue: 1,
          tension: 75,
          friction: 8,
          useNativeDriver: useNative,
        }),
        Animated.spring(tip3Anim, {
          toValue: 1,
          tension: 75,
          friction: 8,
          useNativeDriver: useNative,
        }),
      ]),
    ]).start();

    rotationLoop.start();
    pulseLoop.start();
    floatLoop.start();

    return () => {
      rotationLoop.stop();
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [
    rotateAnim,
    pulseAnim,
    floatAnim,
    heroEntranceAnim,
    cardEntranceAnim,
    tip1Anim,
    tip2Anim,
    tip3Anim,
    useNative,
  ]);

  // 5. Celebratory spring pop when `isConnected` turns true!
  useEffect(() => {
    if (isConnected) {
      connectedPopAnim.setValue(0.93);
      Animated.spring(connectedPopAnim, {
        toValue: 1,
        tension: 110,
        friction: 5,
        useNativeDriver: useNative,
      }).start();
    }
  }, [isConnected, connectedPopAnim, useNative]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinReverse = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const makeTipStyle = (anim: Animated.Value, isHovered: boolean) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
      {
        translateX: isHovered ? 2 : 0,
      },
    ],
  });

  return (
    <View style={[styles.safeArea, style]}>
      <View style={[styles.mainWrapper, !isPhone && styles.mainWrapperDesktop]}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top-Right Dismiss Button */}
          {onCancel ? (
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                isCancelHovered && styles.cancelButtonHovered,
                pressed && styles.cancelButtonPressed,
              ]}
              onPress={onCancel}
              hitSlop={12}
              onHoverIn={() => setIsCancelHovered(true)}
              onHoverOut={() => setIsCancelHovered(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel connecting"
            >
              <Ionicons name="close" size={16} color="#64748b" />
            </Pressable>
          ) : null}

          {/* Top Content: Hero Avatar with Orbital Rings & Status Text */}
          <Animated.View
            style={[
              styles.topContentGroup,
              {
                opacity: heroEntranceAnim,
                transform: [
                  {
                    scale: Animated.multiply(
                      heroEntranceAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                      connectedPopAnim
                    ),
                  },
                ],
              },
            ]}
          >
            <View style={styles.heroSection}>
              <View
                style={[
                  styles.animationArea,
                  { width: heroSize, height: heroSize },
                ]}
              >
                {/* Outermost Faint Dashed Ring */}
                <Animated.View
                  renderToHardwareTextureAndroid={true}
                  shouldRasterizeIOS={true}
                  style={[
                    styles.orbitalRingOuter,
                    isConnected && styles.orbitalRingOuterConnected,
                    {
                      width: heroSize,
                      height: heroSize,
                      borderRadius: heroSize / 2,
                      transform: [
                        { rotate: spinReverse },
                        { scale: pulseAnim },
                      ],
                    },
                  ]}
                />

                {/* Middle Dashed Ring with 4 Satellite Dots */}
                <Animated.View
                  renderToHardwareTextureAndroid={true}
                  shouldRasterizeIOS={true}
                  style={[
                    styles.orbitalRingDashed,
                    isConnected && styles.orbitalRingDashedConnected,
                    {
                      width: dashedRingSize,
                      height: dashedRingSize,
                      borderRadius: dashedRingSize / 2,
                      transform: [{ rotate: spin }, { scale: pulseAnim }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.satelliteDot,
                      isConnected && styles.satelliteDotConnected,
                      {
                        top: dotOffset,
                        left: dotOffset,
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.satelliteDot,
                      isConnected && styles.satelliteDotConnected,
                      {
                        top: dotOffset,
                        right: dotOffset,
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.satelliteDot,
                      isConnected && styles.satelliteDotConnected,
                      {
                        bottom: dotOffset,
                        left: dotOffset,
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.satelliteDot,
                      isConnected && styles.satelliteDotConnected,
                      {
                        bottom: dotOffset,
                        right: dotOffset,
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                      },
                    ]}
                  />
                </Animated.View>

                {/* Inner Solid Halo Ring (Line Only) */}
                <Animated.View
                  style={[
                    styles.orbitalRingHalo,
                    isConnected && styles.orbitalRingHaloConnected,
                    {
                      width: haloSize,
                      height: haloSize,
                      borderRadius: haloSize / 2,
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                />

                {/* Central Maya Waving Avatar Circle */}
                <Animated.View
                  renderToHardwareTextureAndroid={true}
                  shouldRasterizeIOS={true}
                  style={[
                    styles.avatarContainer,
                    isConnected && styles.avatarContainerConnected,
                    {
                      width: avatarContainerSize,
                      height: avatarContainerSize,
                      borderRadius: avatarContainerSize / 2,
                      transform: [{ translateY: floatAnim }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.avatarInnerCircle,
                      isConnected && styles.avatarInnerCircleConnected,
                      {
                        width: avatarInnerSize,
                        height: avatarInnerSize,
                        borderRadius: avatarInnerSize / 2,
                      },
                    ]}
                  >
                    <Image
                      source={require('@/assets/images/maya-wave-cheer.png')}
                      style={styles.avatarImage}
                      resizeMode="cover"
                      accessibilityLabel="Maya AI Tutor"
                    />
                  </View>
                </Animated.View>
              </View>

              {/* Title & Status Message */}
              <View style={styles.textSection}>
                <ConnectingTitle isConnected={isConnected} />
                <Text style={styles.subtitle}>
                  {isConnected
                    ? 'Connected with Maya! Starting your conversation.'
                    : `Setting things up for your conversation.\nMaya will welcome you in just a moment.`}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Quick Tips Card (Sticky / Pinned to Bottom with Generous Sizing) */}
          <Animated.View
            style={[
              styles.tipsCard,
              {
                opacity: cardEntranceAnim,
                transform: [
                  {
                    translateY: cardEntranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.tipsHeader}>Quick Tips</Text>
            <Text style={styles.tipsSubheader}>
              For a better conversation experience
            </Text>

            <View style={styles.tipsList}>
              {/* Tip 1: Stable Internet */}
              <Pressable
                onHoverIn={() => setHoveredTip(1)}
                onHoverOut={() => setHoveredTip(null)}
              >
                <Animated.View
                  style={[
                    styles.tipRow,
                    hoveredTip === 1 && styles.tipRowHovered,
                    makeTipStyle(tip1Anim, hoveredTip === 1),
                  ]}
                >
                  <View style={styles.tipIconBadge}>
                    <Ionicons name="wifi" size={18} color="#2563eb" />
                  </View>
                  <View style={styles.tipTextGroup}>
                    <Text style={styles.tipTitle}>
                      Use a stable internet connection
                    </Text>
                    <Text style={styles.tipDesc}>
                      Helps to keep the conversation smooth.
                    </Text>
                  </View>
                </Animated.View>
              </Pressable>

              {/* Tip 2: Quiet Place */}
              <Pressable
                onHoverIn={() => setHoveredTip(2)}
                onHoverOut={() => setHoveredTip(null)}
              >
                <Animated.View
                  style={[
                    styles.tipRow,
                    hoveredTip === 2 && styles.tipRowHovered,
                    makeTipStyle(tip2Anim, hoveredTip === 2),
                  ]}
                >
                  <View style={styles.tipIconBadge}>
                    <Ionicons name="home-outline" size={18} color="#2563eb" />
                  </View>
                  <View style={styles.tipTextGroup}>
                    <Text style={styles.tipTitle}>Find a quiet place</Text>
                    <Text style={styles.tipDesc}>
                      Reduces background noise.
                    </Text>
                  </View>
                </Animated.View>
              </Pressable>

              {/* Tip 3: Microphone Access */}
              <Pressable
                onHoverIn={() => setHoveredTip(3)}
                onHoverOut={() => setHoveredTip(null)}
              >
                <Animated.View
                  style={[
                    styles.tipRow,
                    hoveredTip === 3 && styles.tipRowHovered,
                    makeTipStyle(tip3Anim, hoveredTip === 3),
                  ]}
                >
                  <View style={styles.tipIconBadge}>
                    <Ionicons name="mic-outline" size={18} color="#2563eb" />
                  </View>
                  <View style={styles.tipTextGroup}>
                    <Text style={styles.tipTitle}>Allow microphone access</Text>
                    <Text style={styles.tipDesc}>
                      So Maya can hear you clearly.
                    </Text>
                  </View>
                </Animated.View>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f8fd',
    alignItems: 'center',
    width: '100%',
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
  },
  mainWrapperDesktop: {
    maxWidth: 440,
    alignSelf: 'center',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: Platform.select({ web: 14, ios: 10, default: 10 }),
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  cancelButton: {
    position: 'absolute',
    top: Platform.select({ web: 14, ios: 10, default: 12 }),
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'transform 0.15s ease, background-color 0.15s ease',
        } as any)
      : {}),
  },
  cancelButtonHovered: {
    backgroundColor: '#f8fafc',
    transform: [{ scale: 1.08 }],
  },
  cancelButtonPressed: {
    backgroundColor: '#f1f5f9',
    transform: [{ scale: 0.94 }],
  },
  topContentGroup: {
    width: '100%',
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    width: '100%',
    marginTop: Platform.select({ web: 6, ios: 4, default: 4 }),
  },
  animationArea: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbitalRingOuter: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: '#bae6fd',
    borderStyle: 'dashed',
    opacity: 0.85,
    ...(Platform.OS === 'web' ? ({ willChange: 'transform' } as any) : {}),
  },
  orbitalRingDashed: {
    position: 'absolute',
    borderWidth: 1.8,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ willChange: 'transform' } as any) : {}),
  },
  satelliteDot: {
    position: 'absolute',
    backgroundColor: '#007aff',
    ...Platform.select({
      web: {
        boxShadow: '0 0 8px rgba(0, 122, 255, 0.8)',
      } as any,
      default: {
        shadowColor: '#007aff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 4,
        elevation: 4,
      },
    }),
  },
  orbitalRingHalo: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(219, 242, 255, 0.55)',
    ...Platform.select({
      web: {
        boxShadow: '0 0 20px rgba(56, 189, 248, 0.38)',
        willChange: 'transform',
      } as any,
      default: {
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
        elevation: 5,
      },
    }),
  },
  avatarContainer: {
    borderWidth: 4.5,
    borderColor: '#ffffff',
    backgroundColor: '#52b1ff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 18px rgba(56, 189, 248, 0.35)',
        willChange: 'transform',
      } as any,
      default: {
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 6,
      },
    }),
    zIndex: 10,
  },
  avatarInnerCircle: {
    overflow: 'hidden',
    backgroundColor: '#52b1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '130%',
    height: '130%',
  },
  textSection: {
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    color: '#0f172a',
    letterSpacing: -0.4,
    textAlign: 'center',
    minHeight: 30,
  },
  dotVisible: {
    opacity: 1,
  },
  dotHidden: {
    opacity: 0,
  },
  titleConnected: {
    color: '#15803d',
  },
  orbitalRingOuterConnected: {
    borderColor: '#86efac',
    opacity: 0.95,
  },
  orbitalRingDashedConnected: {
    borderColor: '#22c55e',
  },
  satelliteDotConnected: {
    backgroundColor: '#16a34a',
    ...Platform.select({
      web: {
        boxShadow: '0 0 12px rgba(34, 197, 94, 0.95)',
      } as any,
      default: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 5,
      },
    }),
  },
  orbitalRingHaloConnected: {
    borderColor: '#ffffff',
    backgroundColor: 'rgba(220, 252, 231, 0.65)',
    ...Platform.select({
      web: {
        boxShadow: '0 0 22px rgba(34, 197, 94, 0.45)',
      } as any,
      default: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 6,
      },
    }),
  },
  avatarContainerConnected: {
    borderColor: '#ffffff',
    backgroundColor: '#10b981',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 22px rgba(16, 185, 129, 0.45)',
      } as any,
      default: {
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 7,
      },
    }),
  },
  avatarInnerCircleConnected: {
    backgroundColor: '#10b981',
  },
  subtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 21,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: 'rgba(240, 246, 255, 0.94)',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 14,
    shadowColor: '#93c5fd',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 'auto',
    marginBottom: Platform.select({ web: 8, ios: 6, default: 4 }),
  },
  tipsHeader: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  tipsSubheader: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10,
  },
  tipsList: {
    gap: 8,
  },
  tipRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  tipRowHovered: {
    backgroundColor: '#f8fafc',
  },
  tipIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTextGroup: {
    flex: 1,
  },
  tipTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13.5,
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  tipDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
    lineHeight: 16,
  },
});