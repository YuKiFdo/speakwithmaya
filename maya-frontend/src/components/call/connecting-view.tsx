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
}

export function ConnectingView({ onCancel, style }: ConnectingViewProps) {
  const [isCancelHovered, setIsCancelHovered] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<number | null>(null);
  const [dotCount, setDotCount] = useState(2);
  const { isPhone, width: windowWidth, height: windowHeight } = useBreakpoint();
  const insets = useSafeAreaInsets();

  // Dynamic bottom padding to ensure Quick Tips card comes up above gesture bars and mobile browser chrome
  const bottomPadding = Math.max(
    insets.bottom + 24,
    Platform.select({ web: 64, ios: 52, default: 44 })
  );

  // Dynamic hero animation size: scales with screen height to fill vertical gap,
  // matching complete.tsx formula and safely bounded by width so orbital rings never clip.
  const heroSize = useMemo(() => {
    // Proportional to screen height (~38.5%) to close the empty gap above the bottom card
    const heightBased = Math.round(windowHeight * 0.385);
    // Width constraint: ensure orbital rings stay comfortably within safe horizontal bounds
    const contentWidth = isPhone ? windowWidth : Math.min(windowWidth, 440);
    const maxSafeWidth = Math.round(contentWidth - 48);
    return Math.min(350, maxSafeWidth, Math.max(230, heightBased));
  }, [windowHeight, windowWidth, isPhone]);

  const dashedRingSize = Math.round(heroSize * 0.85);
  const haloSize = Math.round(heroSize * 0.70);
  const avatarContainerSize = Math.round(heroSize * 0.60);
  const avatarInnerSize = avatarContainerSize - 8;
  const dotSize = Math.max(9, Math.round(heroSize * 0.032));
  const dotOffset = Math.round(dashedRingSize * 0.146 - (dotSize - 9) / 2);

  // Animation values
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Staggered tip entrance values
  const tip1Anim = useRef(new Animated.Value(0)).current;
  const tip2Anim = useRef(new Animated.Value(0)).current;
  const tip3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Dynamic trailing dots for "Connecting to Maya.."
    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 500);

    // Continuous smooth rotation for orbital ring and satellite dots
    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );

    // Subtle breathing pulse for concentric rings
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    // Gentle avatar levitation
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    // Staggered tip entrance on load
    const entranceSeq = Animated.stagger(180, [
      Animated.timing(tip1Anim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(tip2Anim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(tip3Anim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    rotationLoop.start();
    pulseLoop.start();
    floatLoop.start();
    entranceSeq.start();

    return () => {
      clearInterval(dotInterval);
      rotationLoop.stop();
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinReverse = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const makeTipStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  });

  const dotsString = '.'.repeat(dotCount);

  return (
    <View style={[styles.safeArea, style]}>
      <View style={[styles.mainWrapper, !isPhone && styles.mainWrapperDesktop]}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
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
          <View style={styles.topContentGroup}>
            <View style={styles.heroSection}>
              <View style={[styles.animationArea, { width: heroSize, height: heroSize }]}>
                {/* Outermost Faint Dashed Ring */}
                <Animated.View
                  style={[
                    styles.orbitalRingOuter,
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
                  style={[
                    styles.orbitalRingDashed,
                    {
                      width: dashedRingSize,
                      height: dashedRingSize,
                      borderRadius: dashedRingSize / 2,
                      transform: [
                        { rotate: spin },
                        { scale: pulseAnim },
                      ],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.satelliteDot,
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
                  style={[
                    styles.avatarContainer,
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
                <Text style={styles.title}>
                  Connecting to Maya{dotsString}
                </Text>
                <Text style={styles.subtitle}>
                  Setting things up for your conversation.{'\n'}
                  Maya will welcome you in just a moment.
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Tips Card (Sticky / Pinned to Bottom with Generous Sizing) */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsHeader}>Quick Tips</Text>
            <Text style={styles.tipsSubheader}>For a better conversation experience</Text>

            <View style={styles.tipsList}>
              {/* Tip 1: Stable Internet */}
              <Pressable
                onHoverIn={() => setHoveredTip(1)}
                onHoverOut={() => setHoveredTip(null)}
              >
                <Animated.View
                  style={[
                    styles.tipRow,
                    makeTipStyle(tip1Anim),
                    hoveredTip === 1 && styles.tipRowHovered,
                  ]}
                >
                  <View style={styles.tipIconBadge}>
                    <Ionicons name="wifi" size={21} color="#2563eb" />
                  </View>
                  <View style={styles.tipTextGroup}>
                    <Text style={styles.tipTitle}>Use a stable internet connection</Text>
                    <Text style={styles.tipDesc}>Helps to keep the conversation smooth.</Text>
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
                    makeTipStyle(tip2Anim),
                    hoveredTip === 2 && styles.tipRowHovered,
                  ]}
                >
                  <View style={styles.tipIconBadge}>
                    <Ionicons name="home-outline" size={21} color="#2563eb" />
                  </View>
                  <View style={styles.tipTextGroup}>
                    <Text style={styles.tipTitle}>Find a quiet place</Text>
                    <Text style={styles.tipDesc}>Reduces background noise.</Text>
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
                    makeTipStyle(tip3Anim),
                    hoveredTip === 3 && styles.tipRowHovered,
                  ]}
                >
                  <View style={styles.tipIconBadge}>
                    <Ionicons name="mic-outline" size={21} color="#2563eb" />
                  </View>
                  <View style={styles.tipTextGroup}>
                    <Text style={styles.tipTitle}>Allow microphone access</Text>
                    <Text style={styles.tipDesc}>So Maya can hear you clearly.</Text>
                  </View>
                </Animated.View>
              </Pressable>
            </View>
          </View>
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
    ...(Platform.OS === 'web' ? ({ transition: 'transform 0.15s ease, background-color 0.15s ease' } as any) : {}),
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
  },
  orbitalRingDashed: {
    position: 'absolute',
    borderWidth: 1.8,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#93c5fd',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 'auto',
    marginBottom: Platform.select({ web: 10, ios: 8, default: 6 }),
  },
  tipsHeader: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  tipsSubheader: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  tipsList: {
    gap: 10,
  },
  tipRow: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    ...(Platform.OS === 'web' ? ({ transition: 'background-color 0.15s ease, transform 0.15s ease' } as any) : {}),
  },
  tipRowHovered: {
    backgroundColor: '#f8fafc',
    transform: [{ translateX: 2 }],
  },
  tipIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTextGroup: {
    flex: 1,
  },
  tipTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14.5,
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  tipDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 17,
  },
});

