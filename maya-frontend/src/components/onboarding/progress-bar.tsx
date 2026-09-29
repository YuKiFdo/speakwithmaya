import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '@/theme/tokens';

interface ProgressBarProps {
  progress: number; // 0.0 to 1.0
}

export function ProgressBar({ progress }: ProgressBarProps) {
  // Clamp progress between 0 and 1
  const target = Math.min(Math.max(progress, 0), 1);
  
  // Start slightly behind target on first mount so the initial transition glides forward nicely
  const animValue = useRef(new Animated.Value(Math.max(0, target - 0.12))).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: target,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [target]);

  const widthInterpolation = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: widthInterpolation }]} />
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
