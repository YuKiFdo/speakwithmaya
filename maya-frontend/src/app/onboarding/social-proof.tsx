import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { LKFlag } from '@/components/icons/lk-flag';
import { Colors, Radii } from '@/theme/tokens';

export default function SocialProofScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    language?: string;
    dailyGoal?: string;
  }>();

  const handleContinue = () => {
    router.push({
      pathname: '/onboarding/building-plan',
      params,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.5} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>You're in Good Company</Text>
            <Text style={styles.subtitle}>
              Thousands of Sri Lankans are speaking more confidently.
            </Text>
          </View>

          {/* 3 Metric Stats Cards */}
          <View style={styles.statsRow}>
            {/* Stat 1: Rating */}
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⭐</Text>
              <Text style={styles.statNumber}>4.9</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>

            {/* Stat 2: Learners */}
            <View style={styles.statCard}>
              <View style={styles.flagWrapper}>
                <LKFlag width={24} height={16} />
              </View>
              <Text style={styles.statNumber}>10K+</Text>
              <Text style={styles.statLabel}>Learners</Text>
            </View>

            {/* Stat 3: AI Coach */}
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🎙️</Text>
              <Text style={styles.statNumber}>AI</Text>
              <Text style={styles.statLabel}>Coach</Text>
            </View>
          </View>

          {/* Testimonial Cards */}
          <View style={styles.testimonialsList}>
            {/* Testimonial 1 */}
            <View style={styles.testimonialCard}>
              <Text style={styles.starRow}>⭐⭐⭐⭐⭐</Text>
              <Text style={styles.quoteText}>
                "I finally started speaking without translating in my head. Maya corrects me instantly."
              </Text>
              <Text style={styles.authorText}>Dilini R. · Colombo</Text>
            </View>

            {/* Testimonial 2 */}
            <View style={styles.testimonialCard}>
              <Text style={styles.starRow}>⭐⭐⭐⭐⭐</Text>
              <Text style={styles.quoteText}>
                "Got my UK visa interview done confidently. This app changed everything for me."
              </Text>
              <Text style={styles.authorText}>Kasun P. · Kandy</Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed,
            ]}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue to build your plan"
          >
            <Text style={styles.ctaButtonText}>Continue</Text>
          </Pressable>
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
    paddingVertical: 16,
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
  progressContainer: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 8,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  flagWrapper: {
    marginBottom: 6,
    height: 22,
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  testimonialsList: {
    gap: 14,
  },
  testimonialCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  starRow: {
    fontSize: 15,
    letterSpacing: 2,
  },
  quoteText: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 23,
    fontWeight: '500',
  },
  authorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  footer: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 8,
  },
  ctaButton: {
    backgroundColor: '#0085db',
    width: '100%',
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0085db',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonPressed: {
    backgroundColor: '#0072bc',
    transform: [{ scale: 0.99 }],
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
