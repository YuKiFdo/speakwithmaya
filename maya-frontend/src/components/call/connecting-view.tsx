import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Pressable,
} from 'react-native';
import { fontStyle } from '@/theme/fonts';

interface ConnectingViewProps {
  onCancel?: () => void;
  style?: any;
}

export function ConnectingView({ onCancel, style }: ConnectingViewProps) {
  const [isCancelHovered, setIsCancelHovered] = useState(false);
  const [hoveredTip, setHoveredTip] = useState<number | null>(null);
  const [dotCount, setDotCount] = useState(3);

  // Animation values
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  // Staggered tip entrance values
  const tip1Anim = useRef(new Animated.Value(0)).current;
  const tip2Anim = useRef(new Animated.Value(0)).current;
  const tip3Anim = useRef(new Animated.Value(0)).current;

  // Checkmark spring pops on entrance
  const check1Scale = useRef(new Animated.Value(0)).current;
  const check2Scale = useRef(new Animated.Value(0)).current;
  const check3Scale = useRef(new Animated.Value(0)).current;

  // Sequential breathing waves across the 3 checkmarks (1 -> 2 -> 3)
  const pulse1Anim = useRef(new Animated.Value(1)).current;
  const pulse2Anim = useRef(new Animated.Value(1)).current;
  const pulse3Anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Dynamic trailing dots for "Connecting to Maya..."
    const dotInterval = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 450);

    // Continuous rotation for orbital rings
    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );

    // Subtle breathing/pulse animation for rings
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    // Gentle avatar levitation (floating)
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
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

    // Concentric acoustic/radar waves radiating outwards
    const createWaveLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );

    const wave1Loop = createWaveLoop(waveAnim1, 0);
    const wave2Loop = createWaveLoop(waveAnim2, 1100);

    // Sequential checkmark pop on mount: tip 1, then tip 2, then tip 3
    const entranceSeq = Animated.stagger(220, [
      Animated.parallel([
        Animated.timing(tip1Anim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(check1Scale, {
          toValue: 1,
          tension: 70,
          friction: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.parallel([
        Animated.timing(tip2Anim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(check2Scale, {
          toValue: 1,
          tension: 70,
          friction: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.parallel([
        Animated.timing(tip3Anim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(check3Scale, {
          toValue: 1,
          tension: 70,
          friction: 6,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]);

    // Continuous sequential pulse wave across the checkmarks: 1 -> 2 -> 3
    const sequentialPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1Anim, {
          toValue: 1.18,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse1Anim, {
          toValue: 1,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse2Anim, {
          toValue: 1.18,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse2Anim, {
          toValue: 1,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse3Anim, {
          toValue: 1.18,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse3Anim, {
          toValue: 1,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(800),
      ])
    );

    rotationLoop.start();
    pulseLoop.start();
    floatLoop.start();
    wave1Loop.start();
    wave2Loop.start();
    entranceSeq.start(() => {
      sequentialPulse.start();
    });

    return () => {
      clearInterval(dotInterval);
      rotationLoop.stop();
      pulseLoop.stop();
      floatLoop.stop();
      wave1Loop.stop();
      wave2Loop.stop();
      sequentialPulse.stop();
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

  // Radar wave interpolations
  const wave1Scale = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.75],
  });
  const wave1Opacity = waveAnim1.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.35, 0.2, 0],
  });

  const wave2Scale = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.75],
  });
  const wave2Opacity = waveAnim2.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.35, 0.2, 0],
  });

  // Tip entrance interpolation
  const makeTipStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  });

  const dotsString = '.'.repeat(dotCount);

  return (
    <View style={[styles.safeArea, style]}>
      <View style={styles.container}>
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
            <Text style={styles.cancelButtonText}>✕</Text>
          </Pressable>
        ) : null}

        {/* Orbital Animation with Maya's Avatar */}
        <View style={styles.animationArea}>
          {/* Radiant Acoustic Wave 1 */}
          <Animated.View
            style={[
              styles.radarWave,
              {
                transform: [{ scale: wave1Scale }],
                opacity: wave1Opacity,
              },
            ]}
          />

          {/* Radiant Acoustic Wave 2 */}
          <Animated.View
            style={[
              styles.radarWave,
              {
                transform: [{ scale: wave2Scale }],
                opacity: wave2Opacity,
              },
            ]}
          />

          {/* Outer Ring 3 */}
          <Animated.View
            style={[
              styles.orbitalRingOuter,
              {
                transform: [
                  { rotate: spinReverse },
                  { scale: pulseAnim },
                ],
              },
            ]}
          />

          {/* Middle Ring 2 with Orbiting Beacon */}
          <Animated.View
            style={[
              styles.orbitalRingMiddle,
              {
                transform: [
                  { rotate: spin },
                  { scale: pulseAnim },
                ],
              },
            ]}
          >
            <View style={styles.satelliteBeaconMiddle} />
          </Animated.View>

          {/* Inner Ring 1 with Orbiting Beacon */}
          <Animated.View
            style={[
              styles.orbitalRingInner,
              {
                transform: [{ rotate: spinReverse }],
              },
            ]}
          >
            <View style={styles.satelliteBeaconInner} />
          </Animated.View>

          {/* Central Avatar with Gentle Levitation */}
          <Animated.View
            style={[
              styles.avatarWrapper,
              {
                transform: [{ translateY: floatAnim }],
              },
            ]}
          >
            <Image
              source={require('@/assets/images/maya-avatar.png')}
              style={styles.avatarImage}
              resizeMode="cover"
              accessibilityLabel="Maya AI Tutor"
            />
          </Animated.View>
        </View>

        {/* Status Text with Dynamic Dots */}
        <View style={styles.textSection}>
          <Text style={styles.title}>
            Connecting to Maya{dotsString}
          </Text>
          <Text style={styles.subtitle}>
            Setting things up for your conversation.{'\n'}
            Maya will welcome you in just a moment.
          </Text>
        </View>

        {/* Quick Tips Card */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsHeader}>Quick Tips</Text>

          <View style={styles.tipsList}>
            {/* Tip 1 */}
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
                <Animated.View
                  style={[
                    styles.checkCircle,
                    {
                      transform: [
                        { scale: Animated.multiply(check1Scale, pulse1Anim) },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.checkTick}>✓</Text>
                </Animated.View>
                <Text style={[styles.tipText, hoveredTip === 1 && styles.tipTextHovered]}>
                  Use a stable internet connection
                </Text>
              </Animated.View>
            </Pressable>

            {/* Tip 2 */}
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
                <Animated.View
                  style={[
                    styles.checkCircle,
                    {
                      transform: [
                        { scale: Animated.multiply(check2Scale, pulse2Anim) },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.checkTick}>✓</Text>
                </Animated.View>
                <Text style={[styles.tipText, hoveredTip === 2 && styles.tipTextHovered]}>
                  Find a quiet place
                </Text>
              </Animated.View>
            </Pressable>

            {/* Tip 3 */}
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
                <Animated.View
                  style={[
                    styles.checkCircle,
                    {
                      transform: [
                        { scale: Animated.multiply(check3Scale, pulse3Anim) },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.checkTick}>✓</Text>
                </Animated.View>
                <Text style={[styles.tipText, hoveredTip === 3 && styles.tipTextHovered]}>
                  Allow microphone access
                </Text>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    width: '100%',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    position: 'relative',
  },
  cancelButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    ...(Platform.OS === 'web' ? ({ transition: 'transform 0.15s ease, background-color 0.15s ease' } as any) : {}),
  },
  cancelButtonHovered: {
    backgroundColor: '#e2e8f0',
    transform: [{ scale: 1.08 }],
  },
  cancelButtonPressed: {
    backgroundColor: '#cbd5e1',
    transform: [{ scale: 0.92 }],
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '700',
  },
  animationArea: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    position: 'relative',
  },
  radarWave: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#93c5fd',
    backgroundColor: 'rgba(219, 234, 254, 0.25)',
  },
  orbitalRingOuter: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1.5,
    borderColor: '#dbeafe',
    borderStyle: 'dashed',
  },
  orbitalRingMiddle: {
    position: 'absolute',
    width: 215,
    height: 215,
    borderRadius: 107.5,
    borderWidth: 2,
    borderColor: '#93c5fd',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  satelliteBeaconMiddle: {
    position: 'absolute',
    top: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0085db',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  orbitalRingInner: {
    position: 'absolute',
    width: 165,
    height: 165,
    borderRadius: 82.5,
    borderWidth: 2.5,
    borderColor: '#0085db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  satelliteBeaconInner: {
    position: 'absolute',
    bottom: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0085db',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  avatarWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    padding: 3,
    backgroundColor: '#ffffff',
    shadowColor: '#0085db',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
    zIndex: 10,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  textSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  title: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 27,
    color: '#0f172a',
    letterSpacing: -0.5,
    textAlign: 'center',
    minHeight: 36,
  },
  subtitle: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  tipsHeader: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0f172a',
    marginBottom: 16,
  },
  tipsList: {
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? ({ transition: 'background-color 0.15s ease, transform 0.15s ease' } as any) : {}),
  },
  tipRowHovered: {
    backgroundColor: '#f1f5f9',
    transform: [{ translateX: 4 }],
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0085db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTick: {
    ...fontStyle('outfit', 'bold'),
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 15,
    textAlign: 'center',
  },
  tipText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 14.5,
    color: '#334155',
  },
  tipTextHovered: {
    color: '#0f172a',
  },
});
