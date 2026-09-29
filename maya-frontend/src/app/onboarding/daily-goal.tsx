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
import { StepTransition } from '@/components/onboarding/step-transition';
import { OptionCard } from '@/components/onboarding/option-card';
import { Colors, Radii } from '@/theme/tokens';

const PRACTICE_OPTIONS = [
  {
    id: '5-min',
    title: '5 min',
    subtitle: 'Light — great to start',
  },
  {
    id: '10-min',
    badge: '★ Recommended',
    title: '10 min',
    subtitle: 'Recommended for steady growth',
  },
  {
    id: '15-min',
    title: '15 min',
    subtitle: 'Intensive — fastest progress',
  },
];

export default function DailyGoalScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
    language?: string;
  }>();

  const [selectedGoal, setSelectedGoal] = useState<string>('10-min');

  const handleContinue = () => {
    if (!selectedGoal) return;
    router.replace({
      pathname: '/onboarding/social-proof',
      params: { ...params, dailyGoal: selectedGoal },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.9} />
        </View>

        {/* Scrollable Content */}
        <StepTransition style={{ flex: 1, width: '100%' }}>
          <ScrollView
            style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              How much can you{'\n'}practice daily?
            </Text>
          </View>

          {/* Daily Goal Options List */}
          <View style={styles.optionsList}>
            {PRACTICE_OPTIONS.map((item) => (
              <OptionCard
                key={item.id}
                id={item.id}
                badge={item.badge}
                title={item.title}
                subtitle={item.subtitle}
                selected={selectedGoal === item.id}
                onPress={() => setSelectedGoal(item.id)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom CTA Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              !selectedGoal && styles.ctaButtonDisabled,
              pressed && selectedGoal && styles.ctaButtonPressed,
            ]}
            onPress={handleContinue}
            disabled={!selectedGoal}
            accessibilityRole="button"
            accessibilityLabel="Continue to practice"
          >
            <Text style={styles.ctaButtonText}>Continue</Text>
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
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  optionsList: {
    gap: 16,
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
