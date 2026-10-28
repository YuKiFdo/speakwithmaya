import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { fontStyle, Fonts } from '@/theme/fonts';

interface DesktopLoadingScreenProps {
  message?: string;
}

/**
 * Branded loading/splash screen shown on ALL web screen sizes
 * while fonts load and the app initializes.
 * (Named DesktopLoadingScreen for backwards compat - renders on mobile web too.)
 */
export function DesktopLoadingScreen({
  message = 'Loading SpeakwithMaya...',
}: DesktopLoadingScreenProps) {
  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {

    // Floating avatar levitation
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    // Pulsing aura ring
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    // Indeterminate progress bar
    const barLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(barProgress, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(barProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();
    barLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
      barLoop.stop();
    };
  }, []);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.4, 0.2, 0],
  });

  const barTranslateX = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 220],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.bgOrbTop} pointerEvents="none" />
      <View style={styles.bgOrbBottom} pointerEvents="none" />

      <View style={styles.card}>
        {/* Central Avatar with Breathing Halo (Top, matching +html.tsx) */}
        <View style={styles.avatarArea}>
          <View style={styles.ambientGlow} />
          <View style={styles.innerRingBorder} />
          <Animated.View
            style={[
              styles.pulseAura,
              {
                transform: [{ scale: pulseScale }],
                opacity: pulseOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.avatarWrapper,
              {
                transform: [{ translateY: floatAnim }],
              },
            ]}
          >
            <Image
              source={
                Platform.OS === 'web'
                  ? { uri: '/maya-avatar.png' }
                  : require('@/assets/images/maya-avatar.png')
              }
              style={styles.avatarImage}
              resizeMode="cover"
            />
            <View style={styles.onlineBadge} />
          </Animated.View>
        </View>

        {/* Brand Header */}
        <View style={styles.brandRow}>
          <Text style={styles.brandTitle}>
            Speakwith<Text style={styles.brandAccent}>Maya</Text>
          </Text>
          <View style={styles.taglinePill}>
            <Text style={styles.brandTagline}>
              Practice  ·  Improve  ·  Be Confident
            </Text>
          </View>
        </View>

        {/* Voice Status Pill + Sleek Indeterminate Progress Bar */}
        <View style={styles.statusContainer}>
          <View style={styles.voiceStatusPill}>
            <View style={styles.waveRow}>
              <View style={[styles.waveBar, { height: 7 }]} />
              <View style={[styles.waveBar, { height: 13 }]} />
              <View style={[styles.waveBar, { height: 9 }]} />
              <View style={[styles.waveBar, { height: 12 }]} />
            </View>
            <Text style={styles.loadingMessage}>{message}</Text>
          </View>

          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  transform: [{ translateX: barTranslateX }],
                },
              ]}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          minHeight: '-webkit-fill-available',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        } as any)
      : {}),
  },
  bgOrbTop: {
    position: 'absolute',
    top: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#F0F7FF',
    opacity: 0.7,
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: -140,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#F8FAFC',
    opacity: 0.9,
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    maxWidth: 380,
    zIndex: 2,
    ...(Platform.OS === 'web' ? ({ margin: 'auto' } as any) : {}),
  },
  avatarArea: {
    width: 144,
    height: 144,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 22,
  },
  ambientGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EFF6FF',
  },
  innerRingBorder: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  pulseAura: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: '#0057FF',
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3.5,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 14px 36px rgba(0, 87, 255, 0.20)' } as any)
      : {
          shadowColor: '#0057FF',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 16,
          elevation: 6,
        }),
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandTitle: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 26,
    color: '#0F172A',
    letterSpacing: -0.7,
    textAlign: 'center',
    marginBottom: 8,
  },
  brandAccent: {
    color: '#0057FF',
  },
  taglinePill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  brandTagline: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 12,
    color: '#64748B',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    width: '100%',
  },
  voiceStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 12,
    gap: 8,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
    gap: 2.5,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#0057FF',
  },
  loadingMessage: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 12.5,
    color: '#475569',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  progressBarTrack: {
    width: 164,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 60,
    borderRadius: 2,
    backgroundColor: '#0057FF',
  },
});
