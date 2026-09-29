import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, ViewStyle, Easing, StyleProp } from 'react-native';

interface StepTransitionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function StepTransition({ children, style }: StepTransitionProps) {
  const fadeAnim = useRef(new Animated.Value(Platform.OS === 'web' ? 0.15 : 1)).current;
  const slideAnim = useRef(new Animated.Value(Platform.OS === 'web' ? 14 : 0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, []);

  if (Platform.OS !== 'web') {
    // Native has hardware-accelerated slide_from_right configured in Stack.Screen options
    return <>{children}</>;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
});
