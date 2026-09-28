import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AmbientGlow } from '@/components/call/ambient-glow';
import { Radii } from '@/theme/tokens';
import { EndCallIcon } from '@/components/icons/call-icons';

type CallState = 'speaking' | 'listening';

export default function CallScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
  }>();

  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;

  const [callState, setCallState] = useState<CallState>('speaking');
  const [secondsElapsed, setSecondsElapsed] = useState(16);
  const [sessionEndNotice, setSessionEndNotice] = useState(false);

  // Animation values for smooth cross-fading of ambient glows
  const purpleGlowAnim = useRef(new Animated.Value(0)).current;
  const blueAuraAnim = useRef(new Animated.Value(1)).current;

  // Session elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Animate glow changes when callState changes
  useEffect(() => {
    if (callState === 'listening') {
      Animated.parallel([
        Animated.timing(purpleGlowAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(blueAuraAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(purpleGlowAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(blueAuraAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [callState]);

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleToggleState = () => {
    if (callState === 'speaking') {
      setCallState('listening');
      setSessionEndNotice(true);
    } else {
      setCallState('speaking');
      setSessionEndNotice(false);
    }
  };

  const handleHangup = () => {
    router.push({
      pathname: '/onboarding/complete',
      params: { ...params, duration: '15 min' },
    });
  };

  const handleBackToHome = () => {
    router.push({
      pathname: '/explore',
      params,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable style={styles.fullScreenTouch} onPress={handleToggleState}>
        <View style={[styles.container, isWebOrDesktop && styles.containerDesktop]}>
          {/* Ambient Edge Aura for Speaking State */}
          <AmbientGlow type="blue-aura" opacity={blueAuraAnim} />

          {/* Top Bar Header */}
          {isWebOrDesktop ? (
            /* Desktop / Web Top Bar */
            <View style={styles.desktopTopBar}>
              {/* Left: Back to Home */}
              <Pressable
                style={({ pressed }) => [
                  styles.backLink,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleBackToHome}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Back to Home"
              >
                <Text style={styles.backArrow}>‹</Text>
                <Text style={styles.backText}>Back to Home</Text>
              </Pressable>

              {/* Right: Settings & End Session Pill */}
              <View style={styles.desktopRightActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.settingsButton,
                    pressed && styles.buttonPressed,
                  ]}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Call settings"
                >
                  <Text style={styles.settingsIcon}>⚙️</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.endSessionPillButton,
                    pressed && styles.endSessionPressed,
                  ]}
                  onPress={handleHangup}
                  accessibilityRole="button"
                  accessibilityLabel="End Session"
                >
                  <EndCallIcon size={20} color="#ffffff" />
                  <Text style={styles.endSessionText}>End Session</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Mobile Phone Top Bar */
            <View style={styles.mobileTopBar}>
              <Pressable
                style={({ pressed }) => [
                  styles.settingsButton,
                  pressed && styles.buttonPressed,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Call settings"
              >
                <Text style={styles.settingsIcon}>⚙️</Text>
              </Pressable>

              <View style={styles.mobileHeaderInfo}>
                <View style={styles.avatarWrapperMobile}>
                  <Image
                    source={require('@/assets/images/maya-avatar.png')}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    accessibilityLabel="Maya"
                  />
                </View>

                <View style={styles.headerTexts}>
                  <Text style={styles.mayaNameMobile}>Maya</Text>
                  <View style={styles.timerRow}>
                    <View
                      style={[
                        styles.statusDot,
                        callState === 'speaking'
                          ? styles.statusDotGreen
                          : styles.statusDotRed,
                      ]}
                    />
                    <Text style={styles.timerText}>
                      {formatTime(secondsElapsed)}{' '}
                      <Text style={styles.timerMax}>/ 15:00</Text>
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stateLabel,
                      callState === 'speaking'
                        ? styles.stateLabelSpeaking
                        : styles.stateLabelListening,
                    ]}
                  >
                    {callState === 'speaking' ? 'Speaking..' : 'Listening...'}
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.mobileHangupButton,
                  pressed && styles.hangupButtonPressed,
                ]}
                onPress={handleHangup}
                accessibilityRole="button"
                accessibilityLabel="End call"
              >
                <EndCallIcon size={28} color="#ffffff" />
              </Pressable>
            </View>
          )}

          {/* Center Content Section */}
          <View style={[styles.centerContent, isWebOrDesktop && styles.centerContentDesktop]}>
            {/* On Desktop: Centered Avatar & Maya Status */}
            {isWebOrDesktop && (
              <View style={styles.desktopAvatarCard}>
                <View style={styles.avatarWrapperDesktop}>
                  <Image
                    source={require('@/assets/images/maya-avatar.png')}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    accessibilityLabel="Maya"
                  />
                </View>

                <View style={styles.desktopInfoTexts}>
                  <Text style={styles.mayaNameDesktop}>Maya</Text>
                  <View style={styles.timerRow}>
                    <View
                      style={[
                        styles.statusDot,
                        callState === 'speaking'
                          ? styles.statusDotGreen
                          : styles.statusDotRed,
                      ]}
                    />
                    <Text style={styles.timerTextDesktop}>
                      {formatTime(secondsElapsed)}{' '}
                      <Text style={styles.timerMax}>/ 15:00</Text>
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.stateLabelDesktop,
                      callState === 'speaking'
                        ? styles.stateLabelSpeaking
                        : styles.stateLabelListening,
                    ]}
                  >
                    {callState === 'speaking' ? 'Speaking..' : 'Listening...'}
                  </Text>
                </View>
              </View>
            )}

            {/* Session Ending Alert Banner */}
            {callState === 'listening' && sessionEndNotice ? (
              <View style={styles.noticePill}>
                <Text style={styles.noticePillText}>
                  The session ends in 4 seconds
                </Text>
              </View>
            ) : (
              <View style={styles.noticePlaceholder} />
            )}

            {/* Conversation Prompt Text */}
            <Text style={[styles.promptText, isWebOrDesktop && styles.promptTextDesktop]}>
              That's great! What do you usually do on weekends?
            </Text>
          </View>

          {/* Bottom Purple Ambient Glow for Listening State */}
          <AmbientGlow type="purple-bottom" opacity={purpleGlowAnim} />
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  fullScreenTouch: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    justifyContent: 'space-between',
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  containerDesktop: {
    maxWidth: '100%',
  },
  /* Desktop Top Bar */
  desktopTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 20,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backArrow: {
    fontSize: 22,
    color: '#64748b',
    fontWeight: '600',
    lineHeight: 22,
  },
  backText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  desktopRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  endSessionPillButton: {
    backgroundColor: '#ef4444',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  endSessionPressed: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 0.98 }],
  },
  endSessionIcon: {
    fontSize: 16,
    color: '#ffffff',
    transform: [{ rotate: '135deg' }],
  },
  endSessionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  /* Mobile Top Bar */
  mobileTopBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 20,
  },
  mobileHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginLeft: 16,
  },
  avatarWrapperMobile: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    backgroundColor: '#ffffff',
    shadowColor: '#0085db',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  mobileHangupButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
    color: '#64748b',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  headerTexts: {
    justifyContent: 'center',
  },
  mayaNameMobile: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  /* Desktop Centered Avatar Card */
  desktopAvatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  avatarWrapperDesktop: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 3,
    backgroundColor: '#ffffff',
    shadowColor: '#0085db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  desktopInfoTexts: {
    justifyContent: 'center',
  },
  mayaNameDesktop: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  timerTextDesktop: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  stateLabelDesktop: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 3,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGreen: {
    backgroundColor: '#22c55e',
  },
  statusDotRed: {
    backgroundColor: '#ef4444',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  timerMax: {
    fontSize: 13,
    fontWeight: '400',
    color: '#94a3b8',
  },
  stateLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  stateLabelSpeaking: {
    color: '#0ea5e9',
  },
  stateLabelListening: {
    color: '#a855f7',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    zIndex: 10,
  },
  centerContentDesktop: {
    maxWidth: 780,
    alignSelf: 'center',
    width: '100%',
  },
  noticePlaceholder: {
    height: 38,
    marginBottom: 20,
  },
  noticePill: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  noticePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
  },
  promptText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  promptTextDesktop: {
    fontSize: 36,
    lineHeight: 48,
    maxWidth: 680,
  },
  hangupButtonPressed: {
    backgroundColor: '#dc2626',
    transform: [{ rotate: '135deg' }, { scale: 0.95 }],
  },
  hangupIcon: {
    fontSize: 22,
    color: '#ffffff',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
