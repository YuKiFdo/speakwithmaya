import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { fontStyle } from '@/theme/fonts';

interface OfficialStoreBadgesProps {
  onPressAppStore?: () => void;
  onPressGooglePlay?: () => void;
  showComingSoonPill?: boolean;
}

/**
 * Official Apple App Store & Google Play Badges using authentic original brand graphics.
 */
export function OfficialStoreBadges({
  onPressAppStore,
  onPressGooglePlay,
  showComingSoonPill = true,
}: OfficialStoreBadgesProps) {
  return (
    <View style={styles.container}>
      {showComingSoonPill && (
        <View style={styles.headerPillRow}>
          <View style={styles.pulsingDot} />
          <Text style={styles.headerPillText}>Mobile Apps Coming Soon</Text>
        </View>
      )}

      <View style={styles.badgesRow}>
        {/* Official Apple App Store Badge */}
        <Pressable
          onPress={onPressAppStore}
          style={({ pressed }) => [styles.badgeWrapper, pressed && styles.badgePressed]}
          accessibilityRole="button"
          accessibilityLabel="Download on the App Store - Coming Soon"
        >
          <Image
            source={require('@/assets/images/app-store-badge.png')}
            style={styles.appStoreImage}
            resizeMode="contain"
          />
        </Pressable>

        {/* Official Google Play Badge */}
        <Pressable
          onPress={onPressGooglePlay}
          style={({ pressed }) => [styles.badgeWrapper, pressed && styles.badgePressed]}
          accessibilityRole="button"
          accessibilityLabel="Get it on Google Play - Coming Soon"
        >
          <Image
            source={require('@/assets/images/google-play-badge.png')}
            style={styles.googlePlayImage}
            resizeMode="contain"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    marginTop: 18,
  },
  headerPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  headerPillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#1E40AF',
    letterSpacing: 0.2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  badgeWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  appStoreImage: {
    width: 130,
    height: 40,
  },
  googlePlayImage: {
    width: 135,
    height: 40,
  },
});
