import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StepTransition } from '@/components/onboarding/step-transition';
import { Colors, Radii } from '@/theme/tokens';

export default function IntroCallScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    language?: string;
    dailyGoal?: string;
  }>();

  const handleStartCall = () => {
    router.replace({
      pathname: '/onboarding/connecting',
      params,
    });
  };

  const handleSkip = () => {
    router.replace({
      pathname: '/dashboard',
      params,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <StepTransition style={{ flex: 1, width: '100%' }}>
          <ScrollView
            style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Maya Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarGlow}>
              <Image
                source={require('@/assets/images/maya-avatar.png')}
                style={styles.avatarImage}
                resizeMode="cover"
                accessibilityLabel="Maya AI Tutor"
              />
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title}>Intro call with Maya</Text>
          <Text style={styles.subtitle}>
            Assess your English{'\n'}and get to know your AI tutor
          </Text>

          {/* "What to expect" Card */}
          <View style={styles.expectCard}>
            <Text style={styles.cardHeader}>What to expect</Text>

            <View style={styles.itemList}>
              {/* Item 1 */}
              <View style={styles.itemRow}>
                <Text style={styles.itemIcon}>⏱️</Text>
                <Text style={styles.itemText}>
                  About 4 minutes • stop anytime
                </Text>
              </View>

              {/* Item 2 */}
              <View style={styles.itemRow}>
                <Text style={styles.itemIcon}>💬</Text>
                <Text style={styles.itemText}>
                  A few simple questions about you
                </Text>
              </View>

              {/* Item 3 */}
              <View style={styles.itemRow}>
                <Text style={styles.itemIcon}>🛡️</Text>
                <Text style={styles.itemText}>Friendly and judgment-free</Text>
              </View>

              {/* Item 4 */}
              <View style={styles.itemRow}>
                <Text style={styles.itemIcon}>🎙️</Text>
                <Text style={styles.itemText}>
                  Speak for at least{' '}
                  <Text style={styles.badge30s}>30s</Text> so Maya can assess you
                  reliably
                </Text>
              </View>
            </View>
          </View>

          {/* Completed calls social proof */}
          <View style={styles.socialProofRow}>
            <View style={styles.greenDot} />
            <Text style={styles.socialProofText}>
              4,902 calls completed today
            </Text>
          </View>
        </ScrollView>

        {/* Bottom CTA Row: Skip & Start Call */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.skipButtonPressed,
            ]}
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.startCallButton,
              pressed && styles.startCallButtonPressed,
            ]}
            onPress={handleStartCall}
            accessibilityRole="button"
            accessibilityLabel="Start Call with Maya"
          >
            <Text style={styles.startCallIcon}>🎙️</Text>
            <Text style={styles.startCallButtonText}>Start Call</Text>
          </Pressable>
        </View>
        </StepTransition>
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
    paddingVertical: 16,
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarGlow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 3,
    backgroundColor: '#ffffff',
    shadowColor: '#0085db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 58,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.6,
    marginTop: 18,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  expectCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    borderRadius: 22,
    padding: 22,
    marginTop: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  itemList: {
    gap: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  itemText: {
    flex: 1,
    fontSize: 14.5,
    color: '#334155',
    lineHeight: 21,
    fontWeight: '500',
  },
  badge30s: {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    fontSize: 13,
  },
  socialProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  socialProofText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  footer: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  skipButton: {
    flex: 1,
    height: 56,
    borderRadius: Radii.pill,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonPressed: {
    backgroundColor: '#e2e8f0',
    transform: [{ scale: 0.99 }],
  },
  skipButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  startCallButton: {
    flex: 1.4,
    height: 56,
    borderRadius: Radii.pill,
    backgroundColor: '#0085db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0085db',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  startCallButtonPressed: {
    backgroundColor: '#0072bc',
    transform: [{ scale: 0.99 }],
  },
  startCallIcon: {
    fontSize: 17,
  },
  startCallButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
