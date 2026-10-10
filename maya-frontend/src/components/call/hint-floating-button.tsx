import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

interface HintFloatingButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  isActive?: boolean;
  disabled?: boolean;
}

export function HintFloatingButton({
  onPress,
  isLoading = false,
  isActive = false,
  disabled = false,
}: HintFloatingButtonProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.circleButton,
          isActive && styles.circleButtonActive,
          pressed && styles.circleButtonPressed,
          disabled && styles.circleButtonDisabled,
        ]}
        onPress={onPress}
        disabled={disabled || isLoading}
        accessibilityRole="button"
        accessibilityLabel="Ask for conversation hint"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#0F172A" />
        ) : (
          <Ionicons
            name={isActive ? 'bulb' : 'bulb-outline'}
            size={26}
            color={isActive ? '#F59E0B' : '#0F172A'}
          />
        )}
      </Pressable>
      <Text style={styles.label}>Hint</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  circleButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  circleButtonPressed: {
    backgroundColor: '#F8FAFC',
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
