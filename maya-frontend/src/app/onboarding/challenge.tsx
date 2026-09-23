import React, { useState } from 'react';
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
import { OptionCard } from '@/components/onboarding/option-card';
import { Colors, Radii } from '@/theme/tokens';

const CHALLENGE_OPTIONS = [
  {
    id: 'speaking-confidently',
    icon: '😰',
    title: 'Speaking confidently',
  },
  {
    id: 'getting-stuck',
    icon: '🔄',
    title: 'Getting stuck in conversations',
  },
  {
    id: 'listening',
    icon: '👂',
    title: 'Listening and understanding',
  },
  {
    id: 'grammar',
    icon: '📝',
    title: 'Grammar mistakes',
  },
  {
    id: 'vocabulary',
    icon: '📚',
    title: 'Limited vocabulary',
  },
];

export default function ChallengeScreen() {
  const params = useLocalSearchParams<{ phone?: string; name?: string; goal?: string }>();
  const [selectedChallenge, setSelectedChallenge] = useState<string>('speaking-confidently');

  const handleContinue = () => {
    if (!selectedChallenge) return;
    router.push({
      pathname: '/onboarding/level',
      params: { ...params, challenge: selectedChallenge },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.6} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What's hardest for you?</Text>
            <Text style={styles.subtitle}>Pick your biggest challenge right now.</Text>
          </View>

          {/* Challenge Options List */}
          <View style={styles.optionsList}>
            {CHALLENGE_OPTIONS.map((item) => (
              <OptionCard
                key={item.id}
                id={item.id}
                icon={item.icon}
                title={item.title}
                selected={selectedChallenge === item.id}
                onPress={() => setSelectedChallenge(item.id)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom CTA Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              !selectedChallenge && styles.ctaButtonDisabled,
              pressed && selectedChallenge && styles.ctaButtonPressed,
            ]}
            onPress={handleContinue}
            disabled={!selectedChallenge}
            accessibilityRole="button"
            accessibilityLabel="Continue to level selection"
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
  optionsList: {
    gap: 12,
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
  ctaButtonDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
    elevation: 0,
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
