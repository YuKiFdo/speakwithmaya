import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

export type SessionDurationMinutes = 5 | 10 | 15 | 30;
export type LanguageHelpMode = 'sinhala' | 'english';
export type SinhalaStyleMode = 'balanced' | 'deep_guidance';
export type AICorrectionsMode = 'end_review' | 'balanced' | 'instant';

export type LanguageHelpOption = 'english_only' | 'sinhala_support' | 'deep_guidance';
export type AICorrectionOption = 'let_me_speak' | 'keep_on_track' | 'correct_instantly';

export interface CreateSessionConfig {
  durationMinutes: SessionDurationMinutes;
  durationSeconds: number;
  languageMode: LanguageHelpMode;
  sinhalaStyle?: SinhalaStyleMode;
  aiSuggestions: boolean;
  aiCorrectionsMode?: AICorrectionsMode;
  topic: string;
  scenarioId?: string;
  scenarioTitle?: string;
}

export interface CreateSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onStartSession: (config: CreateSessionConfig) => void;
  scenarioId?: string;
  scenarioTitle?: string;
  initialTopic?: string;
  isPro?: boolean;
  onUpgradePrompt?: () => void;
}

interface DurationOption {
  minutes: SessionDurationMinutes;
  tierLabel: string;
  isPremium?: boolean;
}

const DURATION_OPTIONS: DurationOption[] = [
  { minutes: 5, tierLabel: 'Starter' },
  { minutes: 10, tierLabel: 'Pro' },
  { minutes: 15, tierLabel: 'Premium', isPremium: true },
  { minutes: 30, tierLabel: 'Premium', isPremium: true },
];

export function CreateSessionModal({
  visible,
  onClose,
  onStartSession,
  scenarioId,
  scenarioTitle,
  initialTopic = '',
  isPro = false,
  onUpgradePrompt,
}: CreateSessionModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Selected State (Defaults match the uploaded design)
  const [selectedMinutes, setSelectedMinutes] = useState<SessionDurationMinutes>(5);
  const [languageHelp, setLanguageHelp] = useState<LanguageHelpOption>('english_only');
  const [aiCorrections, setAiCorrections] = useState<AICorrectionOption>('keep_on_track');

  useEffect(() => {
    if (visible) {
      setSelectedMinutes(5);
      setLanguageHelp('english_only');
      setAiCorrections('keep_on_track');
    }
  }, [visible]);

  const handleSelectDuration = (opt: DurationOption) => {
    if (opt.isPremium && !isPro) {
      if (onUpgradePrompt) {
        onUpgradePrompt();
      } else {
        setSelectedMinutes(opt.minutes);
      }
      return;
    }
    setSelectedMinutes(opt.minutes);
  };

  const handleStart = () => {
    let langMode: LanguageHelpMode = 'english';
    let sStyle: SinhalaStyleMode | undefined = undefined;

    if (languageHelp === 'english_only') {
      langMode = 'english';
      sStyle = undefined;
    } else if (languageHelp === 'sinhala_support') {
      langMode = 'sinhala';
      sStyle = 'balanced';
    } else if (languageHelp === 'deep_guidance') {
      langMode = 'sinhala';
      sStyle = 'deep_guidance';
    }

    const aiSuggestions = aiCorrections !== 'let_me_speak';
    const aiCorrectionsMode: AICorrectionsMode =
      aiCorrections === 'let_me_speak'
        ? 'end_review'
        : aiCorrections === 'correct_instantly'
        ? 'instant'
        : 'balanced';

    const finalTopic = initialTopic?.trim() || (scenarioTitle ? `${scenarioTitle} practice` : 'General Spoken English Practice');

    onStartSession({
      durationMinutes: selectedMinutes,
      durationSeconds: selectedMinutes * 60,
      languageMode: langMode,
      sinhalaStyle: sStyle,
      aiSuggestions,
      aiCorrectionsMode,
      topic: finalTopic,
      scenarioId,
      scenarioTitle,
    });
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Backdrop touch to dismiss */}
        <Pressable
          style={styles.backdropTouchArea}
          onPress={onClose}
          accessibilityLabel="Close modal"
          accessibilityRole="button"
        />

        <View style={styles.modalContainer}>
          <View style={[styles.card, isDesktop ? styles.cardDesktop : styles.cardMobile]}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                {/* Blue Plus Icon Circle */}
                <View style={styles.avatarCircle}>
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.headerTextGroup}>
                  <Text style={styles.headerTitle}>
                    Create New <Text style={styles.headerHighlight}>Session</Text>
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    Choose your settings and let's start talking!
                  </Text>
                </View>
              </View>

              {/* Close Button */}
              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Scrollable Content Container */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* SECTION 1: Practice Time */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconBadge, { backgroundColor: '#E0EDFF' }]}>
                    <Ionicons name="time-outline" size={20} color="#2B5BFF" />
                  </View>
                  <View style={styles.sectionTextGroup}>
                    <Text style={styles.sectionTitle}>Practice time</Text>
                    <Text style={styles.sectionSubtitle}>How long do you want to practice?</Text>
                  </View>
                </View>

                {/* 4 Duration Cards Grid */}
                <View style={[styles.durationRow, !isDesktop && styles.durationRowMobile]}>
                  {DURATION_OPTIONS.map((opt) => {
                    const isSelected = selectedMinutes === opt.minutes;
                    return (
                      <Pressable
                        key={opt.minutes}
                        style={({ pressed }) => [
                          styles.durationCard,
                          isSelected && styles.durationCardSelected,
                          pressed && styles.btnPressed,
                        ]}
                        onPress={() => handleSelectDuration(opt)}
                        accessibilityRole="button"
                        accessibilityLabel={`${opt.minutes} minutes ${opt.tierLabel}`}
                      >
                        {opt.isPremium && (
                          <View style={styles.cardTopRightBadges}>
                            <MaterialCommunityIcons name="crown" size={13} color="#F59E0B" />
                            <Ionicons name="lock-closed-outline" size={12} color="#94A3B8" />
                          </View>
                        )}
                        <Text
                          style={[
                            styles.durationMinutesText,
                            isSelected && styles.durationMinutesTextSelected,
                          ]}
                        >
                          {opt.minutes} min
                        </Text>
                        <Text
                          style={[
                            styles.durationTierText,
                            opt.isPremium
                              ? styles.durationTierPremium
                              : isSelected
                              ? styles.durationTierSelected
                              : null,
                          ]}
                        >
                          {opt.tierLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* SECTION 2: Language Help */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconBadge, { backgroundColor: '#E6F9F0' }]}>
                    <MaterialIcons name="translate" size={20} color="#059669" />
                  </View>
                  <View style={styles.sectionTextGroup}>
                    <Text style={styles.sectionTitle}>Language help</Text>
                    <Text style={styles.sectionSubtitle}>
                      Choose how much Sinhala support you'd like.
                    </Text>
                  </View>
                </View>

                <View style={[styles.threeColRow, !isDesktop && styles.threeColRowMobile]}>
                  {/* English only */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.choiceCard,
                      languageHelp === 'english_only' && styles.choiceCardSelected,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => setLanguageHelp('english_only')}
                    accessibilityRole="button"
                  >
                    <View style={[styles.choiceIconCircle, { backgroundColor: '#E0EDFF' }]}>
                      <Ionicons name="globe-outline" size={19} color="#2B5BFF" />
                    </View>
                    <View style={styles.choiceTextCol}>
                      <Text
                        style={[
                          styles.choiceTitle,
                          languageHelp === 'english_only' && styles.choiceTitleSelected,
                        ]}
                      >
                        English only
                      </Text>
                      <Text style={styles.choiceSubtitle}>Maya speaks in English only</Text>
                    </View>
                  </Pressable>

                  {/* Sinhala Support */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.choiceCard,
                      languageHelp === 'sinhala_support' && styles.choiceCardSelected,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => setLanguageHelp('sinhala_support')}
                    accessibilityRole="button"
                  >
                    <View style={[styles.choiceIconCircle, { backgroundColor: '#F3E8FF' }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#9333EA" />
                    </View>
                    <View style={styles.choiceTextCol}>
                      <Text
                        style={[
                          styles.choiceTitle,
                          languageHelp === 'sinhala_support' && styles.choiceTitleSelected,
                        ]}
                      >
                        Sinhala Support
                      </Text>
                      <Text style={styles.choiceSubtitle}>
                        Maya mixes Sinhala and English when you need help.
                      </Text>
                    </View>
                  </Pressable>

                  {/* Deep Guidance */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.choiceCard,
                      languageHelp === 'deep_guidance' && styles.choiceCardSelected,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => setLanguageHelp('deep_guidance')}
                    accessibilityRole="button"
                  >
                    <View style={[styles.choiceIconCircle, { backgroundColor: '#FFEDD5' }]}>
                      <Ionicons name="book-outline" size={18} color="#EA580C" />
                    </View>
                    <View style={styles.choiceTextCol}>
                      <Text
                        style={[
                          styles.choiceTitle,
                          languageHelp === 'deep_guidance' && styles.choiceTitleSelected,
                        ]}
                      >
                        Deep Guidance
                      </Text>
                      <Text style={styles.choiceSubtitle}>
                        Maya uses both languages in every turn.
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>

              {/* SECTION 3: AI corrections */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconBadge, { backgroundColor: '#FDE8EE' }]}>
                    <Ionicons name="chatbubbles-outline" size={20} color="#E11D48" />
                  </View>
                  <View style={styles.sectionTextGroup}>
                    <Text style={styles.sectionTitle}>AI corrections</Text>
                    <Text style={styles.sectionSubtitle}>
                      Choose when Maya should correct your mistakes.
                    </Text>
                  </View>
                </View>

                <View style={[styles.threeColRow, !isDesktop && styles.threeColRowMobile]}>
                  {/* Let me speak */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.choiceCard,
                      aiCorrections === 'let_me_speak' && styles.choiceCardSelected,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => setAiCorrections('let_me_speak')}
                    accessibilityRole="button"
                  >
                    <View style={[styles.choiceIconCircle, { backgroundColor: '#DCFCE7' }]}>
                      <Ionicons name="leaf-outline" size={18} color="#16A34A" />
                    </View>
                    <View style={styles.choiceTextCol}>
                      <Text
                        style={[
                          styles.choiceTitle,
                          aiCorrections === 'let_me_speak' && styles.choiceTitleSelected,
                        ]}
                      >
                        Let me speak
                      </Text>
                      <Text style={styles.choiceSubtitle}>
                        No interruptions. Review at the end.
                      </Text>
                    </View>
                  </Pressable>

                  {/* Keep me on track */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.choiceCard,
                      aiCorrections === 'keep_on_track' && styles.choiceCardSelected,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => setAiCorrections('keep_on_track')}
                    accessibilityRole="button"
                  >
                    <View style={[styles.choiceIconCircle, { backgroundColor: '#E0EDFF' }]}>
                      <MaterialCommunityIcons name="scale-balance" size={19} color="#2B5BFF" />
                    </View>
                    <View style={styles.choiceTextCol}>
                      <Text
                        style={[
                          styles.choiceTitle,
                          aiCorrections === 'keep_on_track' && styles.choiceTitleSelected,
                        ]}
                      >
                        Keep me on track
                      </Text>
                      <Text style={styles.choiceSubtitle}>Occasional corrections.</Text>
                    </View>
                  </Pressable>

                  {/* Correct me instantly */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.choiceCard,
                      aiCorrections === 'correct_instantly' && styles.choiceCardSelected,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => setAiCorrections('correct_instantly')}
                    accessibilityRole="button"
                  >
                    <View style={[styles.choiceIconCircle, { backgroundColor: '#FCE7F3' }]}>
                      <Ionicons name="flash-outline" size={18} color="#DB2777" />
                    </View>
                    <View style={styles.choiceTextCol}>
                      <Text
                        style={[
                          styles.choiceTitle,
                          aiCorrections === 'correct_instantly' && styles.choiceTitleSelected,
                        ]}
                      >
                        Correct me instantly
                      </Text>
                      <Text style={styles.choiceSubtitle}>
                        Every time I make a mistake.
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            {/* Bottom Actions Bar */}
            <View style={styles.footerRow}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
                onPress={handleStart}
                accessibilityRole="button"
              >
                <Text style={styles.startBtnText}>Start Session</Text>
                <Feather name="arrow-right" size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropTouchArea: {
    ...(StyleSheet.absoluteFill as any),
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    width: '100%',
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 24,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.28), 0 0 1px rgba(15, 23, 42, 0.1)',
        } as any)
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.22,
          shadowRadius: 28,
          elevation: 16,
        }),
  },
  cardDesktop: {
    maxWidth: 720,
  },
  cardMobile: {
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2B5BFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 18px rgba(43, 91, 255, 0.35)',
        } as any)
      : {
          shadowColor: '#2B5BFF',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
        }),
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerHighlight: {
    color: '#2B5BFF',
  },
  headerSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  /* Scrollable Area */
  scrollArea: {
    maxHeight: 620,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 6,
  },

  /* Section Containers */
  sectionContainer: {
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTextGroup: {
    flex: 1,
  },
  sectionTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15.5,
    color: '#0F172A',
  },
  sectionSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 1,
  },

  /* Duration Options (Section 1) */
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationRowMobile: {
    gap: 8,
  },
  durationCard: {
    flex: 1,
    height: 82,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  durationCardSelected: {
    borderColor: '#2B5BFF',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 1px #2B5BFF, 0 4px 14px rgba(43, 91, 255, 0.12)',
        } as any)
      : {
          shadowColor: '#2B5BFF',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 3,
        }),
  },
  cardTopRightBadges: {
    position: 'absolute',
    top: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  durationMinutesText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 17,
    color: '#0F172A',
  },
  durationMinutesTextSelected: {
    color: '#2B5BFF',
  },
  durationTierText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  durationTierSelected: {
    color: '#2B5BFF',
  },
  durationTierPremium: {
    color: '#D97706',
  },

  /* 3-Column Choice Row (Sections 2 & 3) */
  threeColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  threeColRowMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  choiceCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  choiceCardSelected: {
    borderColor: '#2B5BFF',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 1px #2B5BFF, 0 4px 14px rgba(43, 91, 255, 0.12)',
        } as any)
      : {
          shadowColor: '#2B5BFF',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 3,
        }),
  },
  choiceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceTextCol: {
    flex: 1,
  },
  choiceTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13.5,
    color: '#0F172A',
  },
  choiceTitleSelected: {
    color: '#2B5BFF',
  },
  choiceSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748B',
    lineHeight: 14.5,
    marginTop: 2,
  },

  /* Bottom Actions Bar */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cancelBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#0F172A',
  },
  startBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2B5BFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(43, 91, 255, 0.35)',
        } as any)
      : {
          shadowColor: '#2B5BFF',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 6,
        }),
  },
  startBtnText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 14.5,
    color: '#FFFFFF',
  },
  startBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  btnPressed: {
    opacity: 0.8,
  },
});
