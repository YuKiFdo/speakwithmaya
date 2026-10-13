import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playStepPop, playOtherButtonSound } from '@/services/sound/sound-service';

export interface SpotlightTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

interface IntroSpotlightTourProps {
  visible: boolean;
  onFinish: () => void;
  targets?: {
    endCall?: SpotlightTargetRect;
    hintButton?: SpotlightTargetRect;
    translationButton?: SpotlightTargetRect;
    blueAura?: SpotlightTargetRect;
    purpleGlow?: SpotlightTargetRect;
  };
}

export function IntroSpotlightTour({
  visible,
  onFinish,
  targets,
}: IntroSpotlightTourProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: Platform.OS !== 'web',
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 900,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 900,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ).start();
    }
  }, [visible]);

  // Default coordinate fallbacks if measurements are pending
  const topBarY = insets.top + (Platform.OS === 'web' ? 14 : 8);
  const endCallX = windowWidth - 62;
  const hintBtnX = windowWidth - 76;
  const hintBtnY = windowHeight - insets.bottom - 80;

  const steps = [
    {
      id: 'blue-glow',
      title: 'Blue Glow = Maya is Speaking',
      description: 'When the glowing blue aura pulses around the screen, Maya is speaking to you. Listen carefully to her sentence!',
      icon: <Ionicons name="volume-high" size={20} color="#2563EB" />,
      badge: 'MAYA SPEAKING',
      badgeColor: '#2563EB',
      badgeBg: '#EFF6FF',
      // Highlights top glowing area
      cutout: targets?.blueAura || {
        x: 16,
        y: insets.top,
        width: windowWidth - 32,
        height: 110,
        radius: 24,
      },
      tooltipPosition: 'bottom' as const,
    },
    {
      id: 'purple-glow',
      title: 'Purple Glow = Maya is Listening',
      description: 'When the bottom purple glow swells up, Maya is listening to your voice in real time. Speak naturally into your mic!',
      icon: <Ionicons name="mic" size={20} color="#8B5CF6" />,
      badge: 'MAYA LISTENING',
      badgeColor: '#8B5CF6',
      badgeBg: '#F5F3FF',
      // Highlights bottom voice area
      cutout: targets?.purpleGlow || {
        x: 16,
        y: windowHeight - insets.bottom - 160,
        width: windowWidth - 32,
        height: 130,
        radius: 28,
      },
      tooltipPosition: 'top' as const,
    },
    {
      id: 'translation',
      title: 'Translate Button',
      description: "Under Maya's speech, tap the Translate pill anytime to see what she said translated into everyday Sinhala.",
      icon: <MaterialIcons name="translate" size={20} color="#0D9488" />,
      badge: 'SINHALA TRANSLATION',
      badgeColor: '#0D9488',
      badgeBg: '#F0FDFA',
      // Highlights translation pill area
      cutout: targets?.translationButton || {
        x: windowWidth / 2 - 75,
        y: windowHeight * 0.44,
        width: 150,
        height: 48,
        radius: 24,
      },
      tooltipPosition: 'bottom' as const,
    },
    {
      id: 'hint',
      title: 'Speaking Hints',
      description: 'Stuck or not sure what to say? Tap this floating lightbulb anytime to get instant sentence suggestions in English!',
      icon: <Feather name="zap" size={20} color="#D97706" />,
      badge: 'HINTS & SUGGESTIONS',
      badgeColor: '#D97706',
      badgeBg: '#FFFBEB',
      // Highlights bottom-right hint button
      cutout: targets?.hintButton || {
        x: hintBtnX - 4,
        y: hintBtnY - 4,
        width: 64,
        height: 64,
        radius: 32,
      },
      tooltipPosition: 'top' as const,
    },
    {
      id: 'end-call',
      title: 'Ending Your Intro Call',
      description: 'The end call button is locked for the first 60 seconds until you speak to Maya. Once unlocked, tap once to wrap up naturally!',
      icon: <Feather name="phone-off" size={20} color="#E11D48" />,
      badge: '1-MIN MINIMUM CHAT',
      badgeColor: '#E11D48',
      badgeBg: '#FFF1F2',
      // Highlights top-right end call button
      cutout: targets?.endCall || {
        x: endCallX - 4,
        y: topBarY - 4,
        width: 52,
        height: 52,
        radius: 26,
      },
      tooltipPosition: 'bottom' as const,
    },
  ];

  const currentStep = steps[currentStepIndex];
  const { cutout } = currentStep;

  const handleNext = () => {
    try {
      playStepPop(currentStepIndex);
    } catch {}

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    try {
      playOtherButtonSound();
    } catch {}

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      onFinish();
    });
  };

  if (!visible) return null;

  // Tooltip position calculation relative to cutout
  const tooltipWidth = Math.min(340, windowWidth - 32);
  let tooltipY = cutout.y + cutout.height + 16;
  if (currentStep.tooltipPosition === 'top' || tooltipY + 200 > windowHeight - insets.bottom) {
    tooltipY = Math.max(insets.top + 16, cutout.y - 210);
  }

  const tooltipX = Math.max(16, Math.min(windowWidth - tooltipWidth - 16, cutout.x + cutout.width / 2 - tooltipWidth / 2));

  return (
    <Animated.View style={[styles.overlayWrapper, { opacity: fadeAnim }]} pointerEvents="box-none">
      {/* SVG Mask: Cutout hole over target element */}
      <Svg width={windowWidth} height={windowHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="spotlight-cutout-mask">
            {/* White base makes whole screen dark */}
            <Rect x="0" y="0" width={windowWidth} height={windowHeight} fill="#FFFFFF" />
            {/* Black cutout punches transparent hole over target */}
            <Rect
              x={cutout.x}
              y={cutout.y}
              width={cutout.width}
              height={cutout.height}
              rx={cutout.radius ?? 18}
              ry={cutout.radius ?? 18}
              fill="#000000"
            />
          </Mask>
        </Defs>

        {/* Semi-transparent dark background */}
        <Rect
          x="0"
          y="0"
          width={windowWidth}
          height={windowHeight}
          fill="rgba(10, 18, 36, 0.78)"
          mask="url(#spotlight-cutout-mask)"
        />
      </Svg>

      {/* Pulsing highlight border around cutout hole */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.cutoutBorderGlow,
          {
            left: cutout.x - 3,
            top: cutout.y - 3,
            width: cutout.width + 6,
            height: cutout.height + 6,
            borderRadius: (cutout.radius ?? 18) + 3,
            borderColor: currentStep.badgeColor,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Floating Tooltip Card */}
      <View style={[styles.tooltipCard, { left: tooltipX, top: tooltipY, width: tooltipWidth }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.badgePill, { backgroundColor: currentStep.badgeBg }]}>
            {currentStep.icon}
            <Text style={[styles.badgeText, { color: currentStep.badgeColor }]}>
              {currentStep.badge}
            </Text>
          </View>
          <Pressable onPress={handleComplete} hitSlop={12} style={styles.skipBtn}>
            <Text style={styles.skipBtnText}>Skip Tour</Text>
          </Pressable>
        </View>

        <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
        <Text style={styles.tooltipDescription}>{currentStep.description}</Text>

        <View style={styles.cardFooterRow}>
          {/* Step dots */}
          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentStepIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Action Button */}
          <Pressable
            style={({ pressed }) => [
              styles.nextBtn,
              pressed && styles.nextBtnPressed,
            ]}
            onPress={handleNext}
          >
            <Text style={styles.nextBtnText}>
              {currentStepIndex === steps.length - 1 ? 'Got it!' : 'Next'}
            </Text>
            {currentStepIndex < steps.length - 1 && (
              <Feather name="arrow-right" size={15} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  cutoutBorderGlow: {
    position: 'absolute',
    borderWidth: 2.5,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.65)',
      } as any,
      default: {
        elevation: 8,
      },
    }),
  },
  tooltipCard: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3)',
      } as any,
      default: {
        elevation: 10,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.5,
    ...fontStyle('inter', 'bold'),
  },
  skipBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  skipBtnText: {
    fontSize: 13,
    color: '#94A3B8',
    ...fontStyle('inter', 'medium'),
  },
  tooltipTitle: {
    fontSize: 18,
    color: '#10213D',
    letterSpacing: -0.4,
    marginBottom: 6,
    ...fontStyle('inter', 'bold'),
  },
  tooltipDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 20,
    ...fontStyle('inter', 'regular'),
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 16,
    backgroundColor: '#2563EB',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#CBD5E1',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    gap: 6,
  },
  nextBtnPressed: {
    backgroundColor: '#1D4ED8',
    transform: [{ scale: 0.98 }],
  },
  nextBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },
});
