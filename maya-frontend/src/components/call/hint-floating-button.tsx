import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { triggerHaptic, playMicroChime } from '@/utils/haptics-audio';
import { playHintButtonSound } from '@/services/sound/sound-service';
import { BeaconRing } from './beacon-ring';

interface HintFloatingButtonProps {
  onPress: () => void;
  isActive?: boolean;
  disabled?: boolean;
  isHighlighted?: boolean;
}

export function HintFloatingButton({
  onPress,
  isActive = false,
  disabled = false,
  isHighlighted = false,
}: HintFloatingButtonProps) {
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const [isRippling, setIsRippling] = useState(false);

  const handlePress = () => {
    if (disabled || isRippling) return;

    // Immediately trigger onPress so mic suppression (suppressMicFor) gates the audio
    // BEFORE any audio chime sound leaves the speaker!
    onPress();

    triggerHaptic('light');
    playHintButtonSound();

    setIsRippling(true);
    ringScale.setValue(1);
    ringOpacity.setValue(0.9);

    // Expand glow ring outward and fade it out
    Animated.parallel([
      Animated.timing(ringScale, {
        toValue: 2.25,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setIsRippling(false);
    });
  };

  return (
    <View style={styles.container}>
      {/* Expanding Glow Ring (Ripples outward once on press, then vanishes) */}
      {isRippling && (
        <Animated.View
          style={[
            styles.glowRing,
            {
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
          pointerEvents="none"
        />
      )}

      <View style={{ position: 'relative' }}>
        <BeaconRing
          color="#F59E0B"
          radius={28}
          active={isHighlighted}
        />
        <Pressable
          style={({ pressed }) => [
            styles.circleButton,
            (isActive || isRippling) && styles.circleButtonActive,
            pressed && styles.circleButtonPressed,
            disabled && styles.circleButtonDisabled,
          ]}
          onPress={handlePress}
          disabled={disabled || isRippling}
          accessibilityRole="button"
          accessibilityLabel="Ask for conversation hint"
        >
          <Ionicons
            name={isActive || isRippling ? 'bulb' : 'bulb-outline'}
            size={26}
            color={isActive || isRippling ? '#0085DB' : '#0F172A'}
          />
        </Pressable>
      </View>
      <Text style={styles.label}>Hint</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 6,
  },
  glowRing: {
    position: 'absolute',
    top: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#0085DB',
    backgroundColor: 'rgba(0, 133, 219, 0.22)',
    zIndex: 0,
    ...Platform.select({
      web: {
        boxShadow: '0 0 16px rgba(0, 133, 219, 0.6), inset 0 0 8px rgba(0, 133, 219, 0.4)',
      } as any,
      default: {
        shadowColor: '#0085DB',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  circleButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, background-color 0.15s ease',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  circleButtonActive: {
    borderColor: '#BAE6FD',
    backgroundColor: '#ffffff8f',
  },
  circleButtonPressed: {
    backgroundColor: '#ffffff8f',
    transform: [{ scale: 0.94 }],
  },
  circleButtonDisabled: {
    opacity: 0.5,
  },
  label: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
  },
});
