import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

interface TranslationToggleButtonProps {
  isExpanded: boolean;
  isLoading?: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function TranslationToggleButton({
  isExpanded,
  isLoading = false,
  onToggle,
  disabled = false,
}: TranslationToggleButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onToggle}
      disabled={disabled || isLoading}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isExpanded ? 'Hide Translation' : 'Show Translation'}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#64748B" style={styles.spinner} />
      ) : (
        <MaterialIcons
          name="translate"
          size={16}
          color="#64748B"
          style={styles.icon}
        />
      )}
      <Text style={styles.buttonText}>
        {isLoading
          ? 'Translating...'
          : isExpanded
          ? 'Hide Translation'
          : 'Show Translation'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    // backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    marginTop: 12,
    alignSelf: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  pressed: {
    // backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    opacity: 0.85,
  },
  spinner: {
    marginRight: 2,
  },
  buttonText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 13.5,
    color: '#64748B',
    letterSpacing: -0.2,
  },
});
