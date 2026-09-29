import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { StepTransition } from '@/components/onboarding/step-transition';
import { OptionCard } from '@/components/onboarding/option-card';
import { LKFlag } from '@/components/icons/lk-flag';
import { Colors, Radii } from '@/theme/tokens';

interface LanguageOption {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}

const PRIMARY_LANGUAGES: LanguageOption[] = [
  {
    id: 'sinhala',
    title: 'Sinhala',
    icon: <LKFlag width={28} height={19} />,
  },
  {
    id: 'tamil',
    title: 'Tamil',
    subtitle: 'தமிழ்',
    icon: <LKFlag width={28} height={19} />,
  },
];

const OTHER_LANGUAGES: LanguageOption[] = [
  {
    id: 'english',
    title: 'English',
    icon: '🇬🇧',
  },
  {
    id: 'hindi',
    title: 'Hindi',
    icon: '🇮🇳',
  },
  {
    id: 'malayalam',
    title: 'Malayalam',
    icon: '🌴',
  },
  {
    id: 'bengali',
    title: 'Bengali',
    icon: '🇧🇩',
  },
  {
    id: 'arabic',
    title: 'Arabic',
    icon: '🇦🇪',
  },
];

export default function LanguageScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    goal?: string;
    challenge?: string;
    level?: string;
  }>();

  const [selectedLanguage, setSelectedLanguage] = useState<string>('sinhala');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOther = useMemo(() => {
    if (!searchQuery.trim()) return OTHER_LANGUAGES;
    const query = searchQuery.toLowerCase().trim();
    return OTHER_LANGUAGES.filter((item) =>
      item.title.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleContinue = () => {
    if (!selectedLanguage) return;
    router.replace({
      pathname: '/onboarding/daily-goal',
      params: { ...params, language: selectedLanguage },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Progress Bar */}
        <View style={styles.progressContainer}>
          <ProgressBar progress={0.8} />
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
            <Text style={styles.title}>Your native language?</Text>
            <Text style={styles.subtitle}>
              Maya will explain tricky concepts in your language.
            </Text>
          </View>

          {/* Primary Sri Lankan Languages */}
          <View style={styles.optionsList}>
            {PRIMARY_LANGUAGES.map((item) => (
              <OptionCard
                key={item.id}
                id={item.id}
                icon={item.icon}
                title={item.title}
                subtitle={item.subtitle}
                selected={selectedLanguage === item.id}
                onPress={() => setSelectedLanguage(item.id)}
              />
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Section: Other Languages */}
          <Text style={styles.sectionHeader}>OTHER LANGUAGES</Text>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Text style={styles.clearSearch}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Other Languages List */}
          <View style={styles.optionsList}>
            {filteredOther.map((item) => (
              <OptionCard
                key={item.id}
                id={item.id}
                icon={item.icon}
                title={item.title}
                subtitle={item.subtitle}
                selected={selectedLanguage === item.id}
                onPress={() => setSelectedLanguage(item.id)}
              />
            ))}
          </View>
        </ScrollView>

        {/* Bottom CTA Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              !selectedLanguage && styles.ctaButtonDisabled,
              pressed && selectedLanguage && styles.ctaButtonPressed,
            ]}
            onPress={handleContinue}
            disabled={!selectedLanguage}
            accessibilityRole="button"
            accessibilityLabel="Continue to daily goal commitment"
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
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
    gap: 10,
  },
  searchIcon: {
    fontSize: 15,
    color: '#94a3b8',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    padding: 0,
  },
  clearSearch: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
    paddingHorizontal: 4,
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
