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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/theme/tokens';

export default function ConnectingScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    language?: string;
    dailyGoal?: string;
  }>();

  // Animation values for radiating/rotating orbital rings
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous rotation for orbital rings
    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );

    // Subtle breathing/pulse animation
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

    rotationLoop.start();
    pulseLoop.start();

    const connectTimer = setTimeout(() => {
      router.push({
        pathname: '/onboarding/call',
        params,
      });
    }, 3500);

    return () => {
      rotationLoop.stop();
      pulseLoop.stop();
      clearTimeout(connectTimer);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Orbital Animation with Maya's Avatar */}
        <View style={styles.animationArea}>
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

          {/* Middle Ring 2 */}
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
          />

          {/* Inner Ring 1 */}
          <Animated.View
            style={[
              styles.orbitalRingInner,
              {
                transform: [{ rotate: spin }],
              },
            ]}
          />

          {/* Central Avatar */}
          <View style={styles.avatarWrapper}>
            <Image
              source={require('@/assets/images/maya-avatar.png')}
              style={styles.avatarImage}
              resizeMode="cover"
              accessibilityLabel="Maya AI Tutor"
            />
          </View>
        </View>

        {/* Status Text */}
        <View style={styles.textSection}>
          <Text style={styles.title}>Connecting to Maya...</Text>
          <Text style={styles.subtitle}>
            Setting things up for your conversation.{'\n'}
            This will just take a few seconds.
          </Text>
        </View>

        {/* Quick Tips Card */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsHeader}>Quick Tips</Text>

          <View style={styles.tipsList}>
            {/* Tip 1 */}
            <View style={styles.tipRow}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkTick}>✓</Text>
              </View>
              <Text style={styles.tipText}>Use a stable internet connection</Text>
            </View>

            {/* Tip 2 */}
            <View style={styles.tipRow}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkTick}>✓</Text>
              </View>
              <Text style={styles.tipText}>Find a quiet place</Text>
            </View>

            {/* Tip 3 */}
            <View style={styles.tipRow}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkTick}>✓</Text>
              </View>
              <Text style={styles.tipText}>Allow microphone access</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
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
  },
  animationArea: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
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
  },
  orbitalRingInner: {
    position: 'absolute',
    width: 165,
    height: 165,
    borderRadius: 82.5,
    borderWidth: 2.5,
    borderColor: '#0085db',
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
    fontSize: 27,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
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
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  tipsList: {
    gap: 14,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
    textAlign: 'center',
  },
  tipText: {
    fontSize: 14.5,
    fontWeight: '500',
    color: '#334155',
  },
});
