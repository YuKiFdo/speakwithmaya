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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

interface ConnectingViewProps {
  onCancel?: () => void;
  style?: any;
}

export function ConnectingView({ onCancel, style }: ConnectingViewProps) {
  const [isCancelHovered, setIsCancelHovered] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<number | null>(null);
  const [dotCount, setDotCount] = useState(2);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Dynamic hero animation size: scaled to fill vertical space harmoniously,
  // safely bounded by screen width so orbital rings never clip.
  const heroSize = useMemo(() => {
    // Proportional to screen height (~35%), bounded between 220px and 290px
    const scaled = Math.round(windowHeight * 0.35);
    const maxSafe = Math.round(windowWidth - 56);
    return Math.min(290, maxSafe, Math.max(220, scaled));
  }, [windowHeight, windowWidth]);

  const dashedRingSize = Math.round(heroSize * 0.85);
  const haloSize = Math.round(heroSize * 0.70);
  const avatarContainerSize = Math.round(heroSize * 0.60);
  const avatarInnerSize = avatarContainerSize - 8;
  const dotOffset = Math.round(dashedRingSize * 0.146);

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
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
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

        {/* Hero Section: Avatar with Concentric Orbital Rings */}
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
              <View style={[styles.satelliteDotTopLeft, { top: dotOffset, left: dotOffset }]} />
              <View style={[styles.satelliteDotTopRight, { top: dotOffset, right: dotOffset }]} />
              <View style={[styles.satelliteDotBottomLeft, { bottom: dotOffset, left: dotOffset }]} />
              <View style={[styles.satelliteDotBottomRight, { bottom: dotOffset, right: dotOffset }]} />
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

        {/* Quick Tips Card */}
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
                  <Ionicons name="wifi" size={16} color="#2563eb" />
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
                  <Ionicons name="home-outline" size={16} color="#2563eb" />
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
                  <Ionicons name="mic-outline" size={16} color="#2563eb" />
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
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f8fd',
    alignItems: 'center',
    width: '100%',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 20,
    paddingTop: Platform.select({ web: 18, ios: 14, default: 14 }),
    paddingBottom: Platform.select({ web: 48, ios: 42, default: 36 }),
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    position: 'relative',
  },
  cancelButton: {
    position: 'absolute',
    top: Platform.select({ web: 18, ios: 12, default: 16 }),
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
  heroSection: {
    alignItems: 'center',
    width: '100%',
    marginTop: Platform.select({ web: 8, ios: 6, default: 6 }),
  },
  animationArea: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: 'rgba(199, 234, 254, 0.35)',
    ...Platform.select({
      web: {
        boxShadow: '0 0 36px 12px rgba(56, 189, 248, 0.28)',
      } as any,
      default: {
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 24,
        elevation: 3,
      },
    }),
  },
  orbitalRingOuter: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  orbitalRingDashed: {
    position: 'absolute',
    width: 178,
    height: 178,
    borderRadius: 89,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  satelliteDotTopLeft: {
    position: 'absolute',
    top: 23,
    left: 23,
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
  satelliteDotTopRight: {
    position: 'absolute',
    top: 23,
    right: 23,
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
  satelliteDotBottomLeft: {
    position: 'absolute',
    bottom: 23,
    left: 23,
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
  satelliteDotBottomRight: {
    position: 'absolute',
    bottom: 23,
    right: 23,
    width: 9,
    height: 9,
    borderRadius: 4.5,
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
    width: 148,
    height: 148,
    borderRadius: 74,
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
    width: 126,
    height: 126,
    borderRadius: 63,
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
    width: 118,
    height: 118,
    borderRadius: 59,
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
    marginTop: 10,
    paddingHorizontal: 16,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0f172a',
    letterSpacing: -0.4,
    textAlign: 'center',
    minHeight: 28,
  },
  subtitle: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: 'rgba(240, 246, 255, 0.88)',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 11,
    shadowColor: '#93c5fd',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 'auto',
  },
  tipsHeader: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#0f172a',
  },
  tipsSubheader: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    marginBottom: 6,
  },
  tipsList: {
    gap: 6,
  },
  tipRow: {
    backgroundColor: '#ffffff',
    borderRadius: 11,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#f1f5f9',
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTextGroup: {
    flex: 1,
  },
  tipTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12.5,
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  tipDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 0.5,
  },
});

