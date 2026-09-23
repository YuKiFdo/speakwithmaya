import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface LKFlagProps {
  width?: number;
  height?: number;
}

export function LKFlag({ width = 24, height = 16 }: LKFlagProps) {
  return (
    <View style={[styles.wrapper, { width, height }]}>
      <Image
        source={require('@/assets/images/flag-lk.png')}
        style={{ width, height, borderRadius: 2 }}
        resizeMode="cover"
        accessibilityLabel="Sri Lanka Flag"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
