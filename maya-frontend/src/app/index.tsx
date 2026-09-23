import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Colors, Radii, Spacing, Typography } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { isDesktop, isTablet } = useBreakpoint();

  const handleGetStarted = () => {
    router.push('/onboarding/name');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.container,
          (isTablet || isDesktop) && styles.desktopContainer,
        ]}
      >
        {/* Main Center Content */}
        <View style={styles.content}>
          <View style={styles.headingGroup}>
            <Text style={styles.headingTitle}>
              Meet Maya,{'\n'}your AI English{'\n'}conversation partner
            </Text>
            <Text style={styles.subtext}>
              Real conversations. Real confidence.{'\n'}Designed to get you speaking in minutes.
            </Text>
          </View>

          {/* Social Proof Badges */}
          <View style={styles.badgesRow}>
            <View style={styles.pillBadge}>
              <Text style={styles.badgeIcon}>⭐</Text>
              <Text style={styles.badgeLabel}>4.9</Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.badgeIcon}>👥</Text>
              <Text style={styles.badgeLabel}>2M+</Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.badgeIcon}>🏆</Text>
              <Text style={styles.badgeLabel}>#1 App</Text>
            </View>
          </View>
        </View>

        {/* Pinned Bottom CTA Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed,
            ]}
            onPress={handleGetStarted}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.ctaButtonText}>Get Started →</Text>
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
  },
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  desktopContainer: {
    maxWidth: 440,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },
  headingGroup: {
    alignItems: 'center',
    gap: 16,
  },
  headingTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0c1b33',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subtext: {
    fontSize: 16,
    lineHeight: 24,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  badgeIcon: {
    fontSize: 13,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  footer: {
    width: '100%',
    paddingBottom: 16,
    alignItems: 'center',
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
