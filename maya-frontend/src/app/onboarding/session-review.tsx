import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { playOtherButtonSound } from '@/services/sound/sound-service';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';

function ReviewStarIcon({
  width = 32,
  height = 31,
  selected = false,
}: {
  width?: number;
  height?: number;
  selected?: boolean;
}) {
  const color = selected ? '#FFB72C' : '#E2E8F0';
  return (
    <Svg width={width} height={height} viewBox="0 0 32 31" fill="none">
      <Path
        d="M15.925 1.1377L20.475 10.4002L30.7125 11.8627L23.2375 19.0127L25.025 29.2502L15.925 24.5377L6.82495 29.2502L8.61245 19.0127L1.13745 11.8627L11.375 10.4002L15.925 1.1377Z"
        fill={color}
        stroke={color}
        strokeWidth={2.275}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function SessionReviewScreen() {
  const params = useLocalSearchParams<{
    sessionId?: string;
    roadmapLevelId?: string;
    isGeneral?: string;
    isPassed?: string;
  }>();

  const insets = useSafeAreaInsets();
  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;

  const [rating, setRating] = useState<number>(1);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleBack = () => {
    playOtherButtonSound();
    router.back();
  };

  const handleClose = () => {
    playOtherButtonSound();
    navigateOut();
  };

  const navigateOut = () => {
    const isGeneral = params.isGeneral === 'true' || !params.roadmapLevelId;
    if (isGeneral) {
      router.replace('/(tabs)/dashboard');
    } else {
      router.replace('/(tabs)/roadmap');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    playOtherButtonSound();

    try {
      const backendBaseUrl = getBackendBaseUrl();
      if (params.sessionId) {
        // Fire-and-forget review logging to backend
        fetch(`${backendBaseUrl}/v1/sessions/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: params.sessionId,
            rating,
            feedback: feedbackText.trim(),
            roadmapLevelId: params.roadmapLevelId,
          }),
        }).catch(() => {});
      }
    } catch {
      // Graceful fallback
    }

    navigateOut();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.mainWrapper, isWebOrDesktop && styles.mainWrapperDesktop]}>
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Top Navigation Row: Back Arrow + Circular Close Button */}
            <View style={styles.topNavRow}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.navIconButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={12}
              >
                <Feather name="arrow-left" size={24} color="#0F172A" />
              </Pressable>

              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [styles.closeCircleButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Close review"
                hitSlop={12}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Main Header Presentation */}
            <View style={styles.headerGroup}>
              <Text style={styles.mainHeading}>How was your practice session?</Text>
              <Text style={styles.subHeading}>
                Your feedback helps us make your next session even better.
              </Text>
            </View>

            {/* Interactive 5-Star Rating Row */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((starIndex) => {
                const isSelected = starIndex <= rating;
                return (
                  <Pressable
                    key={starIndex}
                    onPress={() => {
                      playOtherButtonSound();
                      setRating(starIndex);
                    }}
                    style={({ pressed }) => [
                      styles.starPressable,
                      pressed && styles.starPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${starIndex} stars`}
                    hitSlop={8}
                  >
                    <ReviewStarIcon
                      width={34}
                      height={33}
                      selected={isSelected}
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* Additional Written Feedback Input */}
            <View style={styles.feedbackInputGroup}>
              <Text style={styles.inputLabel}>Anything else you’d like to share?</Text>
              <View style={styles.textInputCard}>
                <TextInput
                  style={styles.textInput}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="Tell us about your experience..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </ScrollView>

          {/* Submit Action Button pinned at bottom */}
          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: Math.max(
                  insets.bottom + 4,
                  Platform.select({ web: isPhone ? 16 : 24, default: 16 })
                ),
              },
            ]}
          >
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.submitButton,
                isPhone && styles.submitButtonPhone,
                pressed && styles.submitButtonPressed,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.submitButtonContent}>
                <Text style={[styles.submitButtonText, isPhone && styles.submitButtonTextPhone]}>Submit</Text>
                <Feather name="arrow-right" size={19} color="#ffffff" style={styles.submitArrow} />
              </View>
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
    ...Platform.select({
      web: {
        height: '100%',
        maxHeight: '100dvh',
        overflow: 'hidden',
      } as any,
    }),
  },
  keyboardAvoid: {
    flex: 1,
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
      } as any,
    }),
  },
  mainWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
      } as any,
    }),
  },
  mainWrapperDesktop: {
    maxWidth: 440,
    alignSelf: 'center',
    boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
    ...Platform.select({
      web: {
        minHeight: 0,
        flexShrink: 1,
      } as any,
    }),
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },

  /* Top Navigation */
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  navIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.94 }],
  },

  /* Headings */
  headerGroup: {
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  mainHeading: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 27,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  subHeading: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 320,
  },

  /* Star Rating */
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 44,
  },
  starPressable: {
    padding: 4,
  },
  starPressed: {
    transform: [{ scale: 1.18 }],
  },

  /* Additional Feedback Input */
  feedbackInputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 12,
  },
  textInputCard: {
    width: '100%',
    minHeight: 135,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
  },
  textInput: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 22,
    minHeight: 100,
    outlineStyle: 'none',
  } as any,

  /* Bottom Submit Button */
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  submitButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#006BE5',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(0, 107, 229, 0.38)',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, #087FF5 0%, #006BE5 100%)',
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  submitButtonPhone: {
    height: 48,
    borderRadius: 18,
  },
  submitButtonTextPhone: {
    fontSize: 16,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 17,
    color: '#ffffff',
  },
  submitArrow: {
    marginTop: 1,
  },
});
