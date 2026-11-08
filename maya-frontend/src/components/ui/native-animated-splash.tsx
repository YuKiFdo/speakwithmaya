import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { fontStyle } from '@/theme/fonts';

interface NativeAnimatedSplashProps {
  onAnimationComplete?: () => void;
  children: React.ReactNode;
}

/**
 * Premium Native-only Animated Splash Screen (Duolingo Style).
 * Seamlessly transitions from the OS-level native splash screen (SplashScreen.hideAsync)
 * into a fluid in-app brand reveal (logo spring + brand title fade), then fades out to reveal the app.
 *
 * Automatically bypasses on Web (returns children directly).
 */
export function NativeAnimatedSplash({
  onAnimationComplete,
  children,
}: NativeAnimatedSplashProps) {
  // Never run animated splash on Web
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }

  const [splashVisible, setSplashVisible] = useState(true);

  // Animations
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoOpacity = useRef(new Animated.Value(0.95)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Immediately dismiss the static OS splash screen so React Native handles the visual handoff
    SplashScreen.hideAsync().catch(() => {});

    // 2. Play brand entrance choreography
    Animated.parallel([
      // Logo smooth spring scale
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      // Text soft slide up & fade in
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => {
      // 3. Hold briefly at full reveal, then smoothly dissolve away
      setTimeout(() => {
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 380,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          setSplashVisible(false);
          onAnimationComplete?.();
        });
      }, 550);
    });
  }, []);

  return (
    <View style={styles.root}>
      {/* Underlying app content ready behind the splash */}
      {children}

      {/* Foreground Animated Splash Overlay */}
      {splashVisible && (
        <Animated.View
          style={[
            styles.splashOverlay,
            { opacity: containerOpacity },
          ]}
          pointerEvents="none"
        >
          <View style={styles.contentCenter}>
            {/* Maya App Icon with subtle breathing shadow */}
            <Animated.View
              style={[
                styles.logoWrapper,
                {
                  opacity: logoOpacity,
                  transform: [{ scale: logoScale }],
                },
              ]}
            >
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Brand Typography */}
            <Animated.View
              style={[
                styles.textWrapper,
                {
                  opacity: textOpacity,
                  transform: [{ translateY: textTranslateY }],
                },
              ]}
            >
              <Text style={styles.brandTitle}>
                Speakwith<Text style={styles.brandTitleHighlight}>Maya</Text>
              </Text>
              <Text style={styles.tagline}>Practice · Improve · Be Confident</Text>
            </Animated.View>
          </View>

          {/* Bottom subtle Sri Lanka pride pill */}
          <Animated.View style={[styles.bottomRow, { opacity: textOpacity }]}>
            <Text style={styles.bottomText}>AI English Speaking Coach</Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  contentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 28,
    shadowColor: '#0D4EFD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textWrapper: {
    alignItems: 'center',
  },
  brandTitle: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 27,
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandTitleHighlight: {
    color: '#0D4EFD',
  },
  tagline: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748B',
    letterSpacing: 0.2,
  },
  bottomRow: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
  },
  bottomText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
});
