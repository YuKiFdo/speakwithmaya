import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { StepTransition } from '@/components/onboarding/step-transition';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { Radii } from '@/theme/tokens';

export default function NameScreen() {
  const [name, setName] = useState('');
  const { isDesktop, isTablet } = useBreakpoint();

  const handleContinue = () => {
    // Navigate to screen 3 (phone number & plan)
    router.replace({
      pathname: '/onboarding/phone',
      params: { name: name.trim() },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View
          style={[
            styles.container,
            (isTablet || isDesktop) && styles.desktopContainer,
          ]}
        >
          {/* Top Progress Bar */}
          <View style={styles.progressContainer}>
            <ProgressBar progress={0.15} />
          </View>

          {/* Main Body */}
          <StepTransition style={styles.body}>
            {/* Card Prompt */}
            <View style={styles.promptCard}>
              <Text style={styles.cardGreeting}>
                Hi! I'm Maya, your personal English speaking coach. 👋
              </Text>
              <Text style={styles.cardQuestion}>
                What should I call you?
              </Text>
            </View>

            {/* Input Box */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Your first name..."
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            </View>
          </StepTransition>

          {/* Bottom Button */}
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
              ]}
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.ctaButtonText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  desktopContainer: {
    maxWidth: 440,
    alignSelf: 'center',
  },
  progressContainer: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  body: {
    flex: 1,
    gap: 20,
    paddingTop: 120,
  },
  promptCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardGreeting: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 24,
  },
  cardQuestion: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  inputWrapper: {
    width: '100%',
  },
  textInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#0f172a',
  },
  footer: {
    width: '100%',
    paddingBottom: 16,
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
