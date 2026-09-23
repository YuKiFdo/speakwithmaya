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

const LEVEL_OPTIONS = [
  {
    id: 'beginner',
    icon: '🌱',
    title: 'Beginner',
    subtitle: 'I know basic words and phrases',
  },
  {
    id: 'intermediate',
    icon: '📗',
    title: 'Intermediate',
    subtitle: 'I can hold simple conversations',
  },
  {
    id: 'upper-intermediate',
    icon: '📘',
    title: 'Upper Intermediate',
    subtitle: 'I speak well but make mistakes',
  },
  {
    id: 'advanced',
    icon: '🏆',
    title: 'Advanced',
    subtitle: 'Near-fluent, want to polish',
  },
];

export default function LevelScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
  }>();
  const [selectedLevel, setSelectedLevel] = useState<string>('intermediate');

  const handleContinue = () => {
    if (!selectedLevel) return;
    router.push({
      pathname: '/onboarding/language',
      params: { ...params, level: selectedLevel },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.7} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What's your current level?</Text>
            <Text style={styles.subtitle}>Be honest — Maya will meet you there.</Text>
          </View>

          {/* Level Options List */}
          <View style={styles.optionsList}>
            {LEVEL_OPTIONS.map((item) => (
              <OptionCard
                key={item.id}
                id={item.id}
                icon={item.icon}
                title={item.title}
                subtitle={item.subtitle}
                selected={selectedLevel === item.id}
                onPress={() => setSelectedLevel(item.id)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom CTA Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              !selectedLevel && styles.ctaButtonDisabled,
              pressed && selectedLevel && styles.ctaButtonPressed,
            ]}
            onPress={handleContinue}
            disabled={!selectedLevel}
            accessibilityRole="button"
            accessibilityLabel="Continue to native language selection"
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
