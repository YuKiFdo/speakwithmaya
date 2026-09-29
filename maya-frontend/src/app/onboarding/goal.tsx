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

const GOAL_OPTIONS = [
  {
    id: 'better-job',
    icon: '💼',
    title: 'Better Job',
    subtitle: 'Improve workplace English',
  },
  {
    id: 'work-abroad',
    icon: '🌍',
    title: 'Work Abroad',
    subtitle: 'Prepare for international roles',
  },
  {
    id: 'speak-confidently',
    icon: '🎤',
    title: 'Speak Confidently',
    subtitle: 'Overcome speaking anxiety',
  },
  {
    id: 'travel',
    icon: '✈️',
    title: 'Travel',
    subtitle: 'Communicate while exploring',
  },
  {
    id: 'exams',
    icon: '🎓',
    title: 'Exams',
    subtitle: 'IELTS, TOEFL, Cambridge',
  },
];

export default function GoalScreen() {
  const params = useLocalSearchParams<{ phone?: string; name?: string }>();
  const [selectedGoal, setSelectedGoal] = useState<string>('work-abroad');

  const handleContinue = () => {
    if (!selectedGoal) return;
    router.replace({
      pathname: '/onboarding/challenge',
      params: { ...params, goal: selectedGoal },
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
        <StepTransition style={{ flex: 1, width: '100%' }}>
          <ScrollView
            style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What's your biggest goal?</Text>
            <Text style={styles.subtitle}>We'll personalise Maya just for you.</Text>
          </View>

          {/* Goal Options List */}
          <View style={styles.optionsList}>
            {GOAL_OPTIONS.map((item) => (
              <OptionCard
                key={item.id}
                id={item.id}
                icon={item.icon}
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
            accessibilityLabel="Continue to challenges"
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
