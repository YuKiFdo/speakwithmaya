import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  AccessibilityInfo,
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
  /**
   * Pads the top by the device safe-area inset (notch / status bar).
   * Set to false if the parent screen already wraps this view in a SafeAreaView.
   */
  applyTopInset?: boolean;
}

const RING_BORDER = 1.8;

// Each tip icon loops forever with one small motion that matches its meaning.
// `ripple` adds a soft ring that expands from the badge and fades out (signal / sound).
const TIPS = [
  { icon: 'wifi', idle: 'signal', ripple: true, duration: 1500, title: 'Use a stable internet connection', desc: 'Helps to keep the conversation smooth.' },
  { icon: 'home-outline', idle: 'bob', ripple: false, duration: 1300, title: 'Find a quiet place', desc: 'Reduces background noise.' },
  { icon: 'mic-outline', idle: 'pulse', ripple: true, duration: 1000, title: 'Allow microphone access', desc: 'So Maya can hear you clearly.' },
] as const;

const IDLE_STYLES = {
  signal: (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  }),
  bob: (v: Animated.Value) => ({
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
    ],
  }),
  pulse: (v: Animated.Value) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }],
  }),
} as const;

/**
 * Isolated title component so the dot ticker never re-renders the orbital rings or tips,
 * and uses fixed-width opacity dots so "Connecting to Maya" never shifts when centered.
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
  applyTopInset = true,
}: ConnectingViewProps) {
  const [isCancelHovered, setIsCancelHovered] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<number | null>(null);
  const { isPhone, width: windowWidth, height: windowHeight } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const useNative = Platform.OS !== 'web';

  const topInset = applyTopInset ? insets.top : 0;

  // Keep the tips card clear of gesture bars / home indicator / mobile browser chrome
  const bottomPadding = Math.max(
    insets.bottom + 16,
    Platform.select({ web: 64, ios: 24, default: 20 }) as number
  );

  // Hero size is based on the height actually available to this screen (minus safe areas),
  // not the raw window height, so it stays balanced on tall notched phones and short Androids.
  const heroSize = useMemo(() => {
    const availableHeight = windowHeight - insets.top - insets.bottom;
    const heightBased = Math.round(availableHeight * 0.28);
    const contentWidth = isPhone ? windowWidth : Math.min(windowWidth, 440);
    const maxSafeWidth = Math.round(contentWidth - 80);
    return Math.min(240, maxSafeWidth, Math.max(170, heightBased));
  }, [windowHeight, windowWidth, isPhone, insets.top, insets.bottom]);

  const dashedRingSize = Math.round(heroSize * 0.9);
  const haloSize = Math.round(heroSize * 0.72);
  const avatarContainerSize = Math.round(heroSize * 0.54);
  const avatarInnerSize = avatarContainerSize - 6;
  const dotSize = Math.max(7, Math.round(heroSize * 0.034));

  // Satellite dots are placed by their centre point on the ring's centre line.
  // This doesn't depend on how each platform treats border width for absolute children.
  const satellites = useMemo(() => {
    const centre = dashedRingSize / 2;
    const radius = dashedRingSize / 2 - RING_BORDER / 2;
    return [45, 135, 225, 315].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return {
        left: centre + radius * Math.cos(rad) - dotSize / 2,
        top: centre + radius * Math.sin(rad) - dotSize / 2,
      };
    });
  }, [dashedRingSize, dotSize]);

  // Continuous loop animation values
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Entrance & Connected pop values
  const heroEntranceAnim = useRef(new Animated.Value(0)).current;
  const connectedPopAnim = useRef(new Animated.Value(1)).current;
  const cardEntranceAnim = useRef(new Animated.Value(0)).current;
  const tipAnims = useRef(TIPS.map(() => new Animated.Value(0))).current;
  const iconPopAnims = useRef(TIPS.map(() => new Animated.Value(0))).current;
  const iconIdleAnims = useRef(TIPS.map(() => new Animated.Value(0))).current;
  const rippleAnims = useRef(TIPS.map(() => new Animated.Value(0))).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // 1. Continuous rotation for orbital ring and satellite dots
    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: useNative,
      })
    );

    // 2. Subtle breathing pulse for concentric rings
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

    // 3. Gentle avatar float
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

    // 4. Staggered entrance for hero, tips card and tip rows
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
      Animated.stagger(
        110,
        tipAnims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            tension: 75,
            friction: 8,
            useNativeDriver: useNative,
          })
        )
      ),
      // Icon badges pop in just after their row lands
      Animated.stagger(
        110,
        iconPopAnims.map((anim) =>
          Animated.sequence([
            Animated.delay(200),
            Animated.spring(anim, {
              toValue: 1,
              tension: 90,
              friction: 7,
              useNativeDriver: useNative,
            }),
          ])
        )
      ),
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
    tipAnims,
    iconPopAnims,
    useNative,
  ]);

  // Looping micro-motion for tip icons (skipped when the user prefers reduced motion)
  useEffect(() => {
    if (reduceMotion) return;
    const loops: Animated.CompositeAnimation[] = [];

    TIPS.forEach((tip, i) => {
      const startDelay = 500 + i * 250;

      // Back-and-forth motion on the icon itself
      loops.push(
        Animated.sequence([
          Animated.delay(startDelay),
          Animated.loop(
            Animated.sequence([
              Animated.timing(iconIdleAnims[i], {
                toValue: 1,
                duration: tip.duration,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: useNative,
              }),
              Animated.timing(iconIdleAnims[i], {
                toValue: 0,
                duration: tip.duration,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: useNative,
              }),
            ])
          ),
        ])
      );

      // Expanding ring behind the badge (wifi signal / mic sound)
      if (tip.ripple) {
        loops.push(
          Animated.sequence([
            Animated.delay(startDelay),
            Animated.loop(
              Animated.sequence([
                Animated.timing(rippleAnims[i], {
                  toValue: 1,
                  duration: 1500,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: useNative,
                }),
                Animated.delay(600),
              ])
            ),
          ])
        );
      }
    });

    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, iconIdleAnims, rippleAnims, useNative]);

  // 5. Spring pop when `isConnected` turns true
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

  return (
    <View style={[styles.safeArea, style]}>
      <View style={[styles.mainWrapper, !isPhone && styles.mainWrapperDesktop]}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: topInset + 12, paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
        >
          {/* Hero area takes the free space and centres the avatar + text in it,
              so the layout holds up on both short and tall screens. */}
          <View style={styles.heroArea}>
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
                  {/* Outermost faint dashed ring */}
                  <Animated.View
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

                  {/* Middle ring + satellite dots, rotating together as one unit */}
                  <Animated.View
                    style={[
                      styles.orbitWrapper,
                      {
                        width: dashedRingSize,
                        height: dashedRingSize,
                        transform: [{ rotate: spin }, { scale: pulseAnim }],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.orbitalRingDashed,
                        isConnected && styles.orbitalRingDashedConnected,
                        { borderRadius: dashedRingSize / 2 },
                      ]}
                    />
                    {satellites.map((pos, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.satelliteDot,
                          isConnected && styles.satelliteDotConnected,
                          {
                            left: pos.left,
                            top: pos.top,
                            width: dotSize,
                            height: dotSize,
                            borderRadius: dotSize / 2,
                          },
                        ]}
                      />
                    ))}
                  </Animated.View>

                  {/* Inner halo */}
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

                  {/* Maya avatar */}
                  <Animated.View
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
                        source={require('@/assets/images/maya-connecting.png')}
                        style={styles.avatarImage}
                        resizeMode="cover"
                        accessibilityLabel="Maya AI Tutor"
                      />
                    </View>
                  </Animated.View>
                </View>

                {/* Title & status message */}
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
          </View>

          {/* Quick Tips card, sits at the bottom */}
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
              {TIPS.map((tip, idx) => (
                <Pressable
                  key={tip.title}
                  onHoverIn={() => setHoveredTip(idx)}
                  onHoverOut={() => setHoveredTip(null)}
                >
                  <Animated.View
                    style={[
                      styles.tipRow,
                      hoveredTip === idx && styles.tipRowHovered,
                      {
                        opacity: tipAnims[idx],
                        transform: [
                          {
                            translateY: tipAnims[idx].interpolate({
                              inputRange: [0, 1],
                              outputRange: [14, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.tipIconSlot}>
                    {tip.ripple && !reduceMotion ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.tipRipple,
                          {
                            opacity: rippleAnims[idx].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 0],
                            }),
                            transform: [
                              {
                                scale: rippleAnims[idx].interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 1.45],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                    ) : null}
                    <Animated.View
                      style={[
                        styles.tipIconBadge,
                        {
                          opacity: iconPopAnims[idx],
                          transform: [
                            {
                              scale: iconPopAnims[idx].interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.6, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Animated.View style={IDLE_STYLES[tip.idle](iconIdleAnims[idx])}>
                        <Ionicons name={tip.icon} size={18} color="#2563eb" />
                      </Animated.View>
                    </Animated.View>
                    </View>
                    <View style={styles.tipTextGroup}>
                      <Text style={styles.tipTitle}>{tip.title}</Text>
                      <Text style={styles.tipDesc}>{tip.desc}</Text>
                    </View>
                  </Animated.View>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Dismiss button: pinned to the top-right, below the notch / status bar */}
        {onCancel ? (
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              { top: topInset + 12 },
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
    alignItems: 'center',
  },
  heroArea: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  cancelButton: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 0.15s ease',
        } as any)
      : {}),
  },
  cancelButtonHovered: {
    backgroundColor: '#f8fafc',
  },
  cancelButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  topContentGroup: {
    width: '100%',
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    width: '100%',
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
  orbitWrapper: {
    position: 'absolute',
    ...(Platform.OS === 'web' ? ({ willChange: 'transform' } as any) : {}),
  },
  orbitalRingDashed: {
    ...StyleSheet.absoluteFill,
    borderWidth: RING_BORDER,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
  },
  // Glow is iOS/web only. Android elevation draws a grey box shadow on tiny dots.
  satelliteDot: {
    position: 'absolute',
    backgroundColor: '#007aff',
    ...Platform.select({
      web: {
        boxShadow: '0 0 8px rgba(0, 122, 255, 0.8)',
      } as any,
      ios: {
        shadowColor: '#007aff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 4,
      },
      default: {},
    }),
  },
  // No elevation here: on Android a translucent background lets the shadow show through as a dark disc.
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
      ios: {
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
      },
      default: {},
    }),
  },
  avatarContainer: {
    borderWidth: 4.5,
    borderColor: '#ffffff',
    backgroundColor: '#D5E9FD',
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
    backgroundColor: '#D5E9FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  textSection: {
    alignItems: 'center',
    marginTop: 16,
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
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
      },
      default: {},
    }),
  },
  orbitalRingHaloConnected: {
    borderColor: '#ffffff',
    backgroundColor: 'rgba(220, 252, 231, 0.65)',
    ...Platform.select({
      web: {
        boxShadow: '0 0 22px rgba(34, 197, 94, 0.45)',
      } as any,
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
      },
      default: {},
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
    marginTop: 6,
    lineHeight: 21,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: '#f0f6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 14,
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
  },
  tipRowHovered: {
    backgroundColor: '#f8fafc',
  },
  tipIconSlot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipRipple: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#60a5fa',
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