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
 * (Named DesktopLoadingScreen for backwards compat — renders on mobile web too.)
 */
export function DesktopLoadingScreen({
  message = 'Loading SpeakwithMaya...',
}: DesktopLoadingScreenProps) {
  // Animation values
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

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
      <View style={styles.card}>
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <Text style={styles.brandTitle}>
            Speakwith<Text style={styles.brandAccent}>Maya</Text>
          </Text>
          <Text style={styles.brandTagline}>
            Practice · Improve · Be Confident
          </Text>
        </View>

        {/* Central Avatar with Breathing Halo */}
        <View style={styles.avatarArea}>
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
              source={require('@/assets/images/maya-avatar.png')}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          </Animated.View>
        </View>

        {/* Sleek Indeterminate Progress Bar */}
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

        {/* Loading Message */}
        <Text style={styles.loadingMessage}>{message}</Text>
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
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    maxWidth: 400,
    ...(Platform.OS === 'web' ? ({ margin: 'auto' } as any) : {}),
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandTitle: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 24,
    color: '#0F172A',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  brandAccent: {
    color: '#0057FF',
  },
  brandTagline: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  avatarArea: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 28,
  },
  pulseAura: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0057FF',
  },
  avatarWrapper: {
    width: 92,
    height: 92,
    borderRadius: 46,
    padding: 3,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 32px rgba(0, 87, 255, 0.22)' } as any)
      : {
          shadowColor: '#0057FF',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 6,
        }),
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 43,
  },
  progressBarTrack: {
    width: 180,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
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
  loadingMessage: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 13,
    color: '#64748B',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
