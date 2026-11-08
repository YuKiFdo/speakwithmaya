import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { playOtherButtonSound } from '@/services/sound/sound-service';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { getLatestSessionReport } from '@/utils/session-report-store';

const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const MAX_FEEDBACK_LENGTH = 500;

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

/** One star. Gives a quick pop when tapped so the choice feels acknowledged. */
function RatingStar({
  index,
  filled,
  checked,
  onPress,
}: {
  index: number;
  filled: boolean;
  checked: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const useNative = Platform.OS !== 'web';

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.22, duration: 90, useNativeDriver: useNative }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: useNative }),
    ]).start();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.starPressable}
      hitSlop={6}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={`${index} ${index === 1 ? 'star' : 'stars'}`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <ReviewStarIcon width={36} height={35} selected={filled} />
      </Animated.View>
    </Pressable>
  );
}

export default function SessionReviewScreen() {
  const params = useLocalSearchParams<{
    sessionId?: string;
    roadmapLevelId?: string;
    isGeneral?: string;
    isPassed?: string;
    isIntro?: string;
  }>();

  const insets = useSafeAreaInsets();
  const { isPhone } = useBreakpoint();
  const isWebOrDesktop = !isPhone;

  // Starts unrated so the score reflects an actual choice (was pre-filled with 5).
  const [rating, setRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const canSubmit = rating > 0 && !isSubmitting;

  const navigateOut = () => {
    if (params.isIntro === 'true') {
      router.replace('/onboarding/building-plan' as any);
      return;
    }
    const isGeneral = params.isGeneral === 'true' || !params.roadmapLevelId;
    if (isGeneral) {
      router.replace('/(tabs)/dashboard');
    } else {
      router.replace('/(tabs)/roadmap');
    }
  };

  const handleBack = () => {
    playOtherButtonSound();
    if (router.canGoBack()) {
      router.back();
    } else {
      navigateOut();
    }
  };

  const handleClose = () => {
    playOtherButtonSound();
    navigateOut();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    playOtherButtonSound();

    try {
      const backendBaseUrl = getBackendBaseUrl();
      const targetSessionId =
        params.sessionId ||
        getLatestSessionReport()?.id ||
        (getLatestSessionReport() as any)?.sessionId;

      if (targetSessionId) {
        // Fire-and-forget review logging to backend
        fetch(`${backendBaseUrl}/v1/sessions/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: targetSessionId,
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
    // Bottom inset is handled by the bottom bar below, so only the top edge is padded here.
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.mainWrapper, isWebOrDesktop && styles.mainWrapperDesktop]}>
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
          >
            {/* Top navigation: back + close */}
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

            {/* Heading */}
            <View style={styles.headerGroup}>
              <Text style={styles.mainHeading}>How was your practice session?</Text>
              <Text style={styles.subHeading}>
                Your feedback helps us make your next session even better.
              </Text>
            </View>

            {/* Star rating + live label */}
            <View style={styles.ratingSection}>
              <View
                style={styles.starsContainer}
                accessibilityRole="radiogroup"
                accessibilityLabel="Session rating"
              >
                {[1, 2, 3, 4, 5].map((starIndex) => (
                  <RatingStar
                    key={starIndex}
                    index={starIndex}
                    filled={starIndex <= rating}
                    checked={starIndex === rating}
                    onPress={() => {
                      playOtherButtonSound();
                      setRating(starIndex);
                    }}
                  />
                ))}
              </View>
              <Text style={[styles.ratingLabel, rating === 0 && styles.ratingLabelEmpty]}>
                {rating === 0 ? 'Tap a star to rate' : RATING_LABELS[rating - 1]}
              </Text>
            </View>

            {/* Written feedback */}
            <View style={styles.feedbackInputGroup}>
              <Text style={styles.inputLabel}>
                Anything else you’d like to share?
                <Text style={styles.inputLabelOptional}> (optional)</Text>
              </Text>
              <View style={[styles.textInputCard, isInputFocused && styles.textInputCardFocused]}>
                <TextInput
                  style={styles.textInput}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder="What went well? What could be better?"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={5}
                  maxLength={MAX_FEEDBACK_LENGTH}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>
                  {feedbackText.length}/{MAX_FEEDBACK_LENGTH}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Submit button pinned at bottom */}
          <View
            style={[
              styles.bottomBar,
              {
                paddingBottom: Math.max(
                  insets.bottom,
                  Platform.select({ web: isPhone ? 16 : 24, default: 16 }) as number
                ),
              },
            ]}
          >
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                isPhone && styles.submitButtonPhone,
                !canSubmit && styles.submitButtonDisabled,
                pressed && canSubmit && styles.submitButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              accessibilityLabel="Submit feedback"
            >
              <Text style={[styles.submitButtonText, isPhone && styles.submitButtonTextPhone]}>
                Submit feedback
              </Text>
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
    ...Platform.select({
      web: {
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
      } as any,
      default: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#E2E8F0',
      },
    }),
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

  /* Top navigation */
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
  },

  /* Headings */
  headerGroup: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 28,
    paddingHorizontal: 12,
  },
  mainHeading: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 27,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 35,
    letterSpacing: -0.3,
  },
  subHeading: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 320,
  },

  /* Rating */
  ratingSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  starPressable: {
    padding: 4,
  },
  ratingLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    color: '#0F172A',
    marginTop: 10,
    minHeight: 20,
  },
  ratingLabelEmpty: {
    ...fontStyle('inter', 'regular'),
    color: '#94A3B8',
  },

  /* Written feedback */
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
  inputLabelOptional: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94A3B8',
  },
  textInputCard: {
    width: '100%',
    minHeight: 140,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  textInputCardFocused: {
    borderColor: '#006BE5',
  },
  textInput: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 22,
    minHeight: 96,
    padding: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  charCount: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 6,
  },

  /* Submit */
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexShrink: 0,
  },
  submitButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#006BE5',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      } as any,
    }),
  },
  submitButtonPhone: {
    height: 50,
    borderRadius: 14,
  },
  submitButtonDisabled: {
    backgroundColor: '#A9CBF5',
    ...Platform.select({
      web: { cursor: 'not-allowed' } as any,
    }),
  },
  submitButtonPressed: {
    backgroundColor: '#005CC8',
  },
  submitButtonText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 17,
    color: '#ffffff',
  },
  submitButtonTextPhone: {
    fontSize: 16,
  },
});