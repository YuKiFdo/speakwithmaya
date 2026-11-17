import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

interface Props {
  shown: number;
  total: number;
  nextBatch: number;
  onPress: () => void;
}

/** "Showing X of Y · Show N more" footer for long admin lists (pairs with useShowMore). */
export function ShowMoreButton({ shown, total, nextBatch, onPress }: Props) {
  if (nextBatch <= 0) return null;
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [styles.btn, hovered && styles.btnHover]}
      accessibilityRole="button"
      accessibilityLabel={`Show ${nextBatch} more`}
    >
      <Text style={styles.text}>
        Showing {shown} of {total} · Show {nextBatch} more
      </Text>
      <Feather name="chevron-down" size={14} color="#0d9488" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#f0fdfa',
  },
  btnHover: { backgroundColor: '#ccfbf1' },
  text: { ...fontStyle('inter', 'semiBold'), fontSize: 13, color: '#0d9488' },
});
