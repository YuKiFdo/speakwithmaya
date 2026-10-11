import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Pressable,
} from 'react-native';
import { fontStyle } from '@/theme/fonts';
import { triggerHaptic } from '@/utils/haptics-audio';
import { isValidSinhalaText } from '@/services/assistance/assistance-service';

interface HintSuggestionCardProps {
  hintEnglish: string;
  hintSinhala: string;
  onDismiss?: () => void;
  isWebOrDesktop?: boolean;
}

export function HintSuggestionCard({
  hintEnglish,
  hintSinhala,
  onDismiss,
  isWebOrDesktop = false,
}: HintSuggestionCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(14);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [hintEnglish]);

  if (!hintEnglish) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        isWebOrDesktop && styles.containerDesktop,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable
        onPress={onDismiss}
        style={{ width: '100%', alignItems: 'center' }}
        disabled={!onDismiss}
      >
        {/* Pill Badge: Try saying: */}
        <View style={styles.badgeRow}>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>Try saying:</Text>
          </View>
        </View>

        {/* Suggested English sentence */}
        <Text style={[styles.englishText, isWebOrDesktop && styles.englishTextDesktop]}>
          {hintEnglish}
        </Text>

        {/* Sinhala translation of the suggested sentence */}
        {!!hintSinhala && isValidSinhalaText(hintSinhala) && (
          <Text style={[styles.sinhalaText, isWebOrDesktop && styles.sinhalaTextDesktop]}>
            {hintSinhala}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  containerDesktop: {
    maxWidth: 640,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    marginBottom: 12,
  },
  badgePill: {
    // backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  badgeText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 14,
    color: '#334155',
    letterSpacing: -0.2,
  },
  englishText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 21,
    lineHeight: 29,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  englishTextDesktop: {
    fontSize: 24,
    lineHeight: 33,
  },
  sinhalaText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14.5,
    lineHeight: 23,
    color: '#334155',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  sinhalaTextDesktop: {
    fontSize: 16,
    lineHeight: 25,
  },
});
