import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/theme/tokens';

interface ProgressBarProps {
  progress: number; // 0.0 to 1.0
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const percentage = Math.min(Math.max(progress * 100, 0), 100);

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${percentage}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    width: '100%',
    backgroundColor: '#e2e8f0',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.brand.primary,
    borderRadius: 9999,
  },
});
