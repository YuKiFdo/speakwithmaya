import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Radii } from '@/theme/tokens';

export default function SessionCompleteScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    name?: string;
    duration?: string;
  }>();

  const practiceDuration = params.duration || '15 min';

  const handleContinueLearning = () => {
    router.replace({
      pathname: '/dashboard',
      params,
    });
  };

  const handleViewSummary = () => {
    router.replace({
      pathname: '/history',
      params: { ...params, viewSummary: 'true' },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Celebratory Maya Avatar */}
          <View style={styles.avatarSection}>
            <Image
              source={require('@/assets/images/maya-celebrate.png')}
              style={styles.avatarImage}
              resizeMode="contain"
              accessibilityLabel="Maya celebrating session completion"
            />
          </View>

          {/* Title and Subtitle */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Great job! 🎉</Text>
            <Text style={styles.subtitle}>Your session is complete.</Text>
          </View>

          {/* 2 Stats Cards */}
          <View style={styles.statsRow}>
            {/* Practice Time */}
            <View style={styles.statCard}>
              <View style={styles.clockIconBadge}>
                <Text style={styles.badgeEmoji}>🕒</Text>
              </View>
              <View style={styles.statTexts}>
                <Text style={styles.statValue}>{practiceDuration}</Text>
                <Text style={styles.statLabel}>Practice time</Text>
              </View>
            </View>

            {/* XP Earned */}
            <View style={styles.statCard}>
              <View style={styles.starIconBadge}>
                <Text style={styles.badgeEmoji}>⭐</Text>
              </View>
              <View style={styles.statTexts}>
                <Text style={styles.statValue}>+50 XP</Text>
                <Text style={styles.statLabel}>Earned today</Text>
              </View>
            </View>
          </View>

          {/* Level Progress Card */}
          <View style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelName}>Level 1 — Newcomer</Text>
              <Text style={styles.levelXP}>150/500 XP</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: '30%' }]} />
            </View>

            <Text style={styles.levelRemainingText}>350 XP until Level 2</Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.footer}>
          {/* Primary Button */}
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={handleContinueLearning}
            accessibilityRole="button"
            accessibilityLabel="Continue Learning"
          >
            <Text style={styles.primaryButtonText}>Continue Learning</Text>
          </Pressable>

          {/* Secondary Outline Button */}
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={handleViewSummary}
            accessibilityRole="button"
            accessibilityLabel="View Conversation Summary"
          >
            <Text style={styles.secondaryButtonText}>
              View Conversation Summary
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  avatarSection: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clockIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fefce8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontSize: 17,
  },
  statTexts: {
    flex: 1,
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  levelCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 20,
    padding: 18,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  levelXP: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0085db',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0085db',
    borderRadius: 4,
  },
  levelRemainingText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  footer: {
    width: '100%',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#3b66f5',
    width: '100%',
    height: 54,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b66f5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonPressed: {
    backgroundColor: '#2b52db',
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#3b66f5',
    width: '100%',
    height: 54,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonPressed: {
    backgroundColor: '#eff6ff',
    transform: [{ scale: 0.99 }],
  },
  secondaryButtonText: {
    color: '#3b66f5',
    fontSize: 16,
    fontWeight: '700',
  },
});
