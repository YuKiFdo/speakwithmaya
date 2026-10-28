import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useOnboardingStore } from '@/services/store/onboarding-store';

export type SessionDurationMinutes = 3 | 5 | 10 | 15 | 30;
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
  planTier?: 'starter' | 'basic' | 'pro' | 'premium';
  onUpgradePrompt?: () => void;
}

interface DurationOption {
  minutes: SessionDurationMinutes;
  tierLabel: 'Starter' | 'Basic' | 'Pro' | 'Premium';
  requiredTier: 'starter' | 'basic' | 'pro' | 'premium';
}

const TIER_RANK: Record<'starter' | 'basic' | 'pro' | 'premium', number> = {
  starter: 0,
  basic: 1,
  pro: 2,
  premium: 3,
};

interface LanguageOptionConfig {
  id: LanguageHelpOption;
  title: string;
  subtitle: string;
  iconName: any;
  iconColor: string;
  iconBg: string;
}

const LANGUAGE_OPTIONS: LanguageOptionConfig[] = [
  {
    id: 'english_only',
    title: 'English only',
    subtitle: 'Maya speaks in English only',
    iconName: 'globe-outline',
    iconColor: '#2B5BFF',
    iconBg: '#E0EDFF',
  },
  {
    id: 'sinhala_support',
    title: 'Sinhala Support',
    subtitle: 'Maya mixes Sinhala and English when you need help.',
    iconName: 'chatbubble-ellipses-outline',
    iconColor: '#9333EA',
    iconBg: '#F3E8FF',
  },
  {
    id: 'deep_guidance',
    title: 'Deep Guidance',
    subtitle: 'Maya uses both languages in every turn.',
    iconName: 'book-outline',
    iconColor: '#EA580C',
    iconBg: '#FFEDD5',
  },
];

interface CorrectionOptionConfig {
  id: AICorrectionOption;
  title: string;
  subtitle: string;
  iconType: 'sprout' | 'scale-balance' | 'flash-outline';
  iconColor: string;
  iconBg: string;
}

const CORRECTION_OPTIONS: CorrectionOptionConfig[] = [
  {
    id: 'let_me_speak',
    title: 'Let me speak',
    subtitle: 'No interruptions. Review at the end.',
    iconType: 'sprout',
    iconColor: '#059669',
    iconBg: '#E6F9F0',
  },
  {
    id: 'keep_on_track',
    title: 'Keep me on track',
    subtitle: 'Occasional corrections.',
    iconType: 'scale-balance',
    iconColor: '#2B5BFF',
    iconBg: '#E0EDFF',
  },
  {
    id: 'correct_instantly',
    title: 'Correct me instantly',
    subtitle: 'Every time I make a mistake.',
    iconType: 'flash-outline',
    iconColor: '#DB2777',
    iconBg: '#FCE7F3',
  },
];

export function CreateSessionModal({
  visible,
  onClose,
  onStartSession,
  scenarioId,
  scenarioTitle,
  initialTopic = '',
  isPro = false,
  planTier: propPlanTier,
  onUpgradePrompt,
}: CreateSessionModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const store = useOnboardingStore();

  const effectivePlanTier: 'starter' | 'basic' | 'pro' | 'premium' =
    propPlanTier ||
    ((store.user?.planTier?.toLowerCase() as any) || (isPro ? 'pro' : 'starter'));
  const userTierRank = TIER_RANK[effectivePlanTier] ?? 0;
  const isStarterUser = userTierRank === 0;
  const starterMinutes: SessionDurationMinutes = isStarterUser ? 3 : 5;

  const durationOptions: DurationOption[] = [
    { minutes: starterMinutes, tierLabel: 'Starter', requiredTier: 'starter' },
    { minutes: 10, tierLabel: 'Basic', requiredTier: 'basic' },
    { minutes: 15, tierLabel: 'Pro', requiredTier: 'pro' },
    { minutes: 30, tierLabel: 'Premium', requiredTier: 'premium' },
  ];

  // Selected State (Defaults match the Figma design)
  const [selectedMinutes, setSelectedMinutes] = useState<SessionDurationMinutes>(starterMinutes);
  const [languageHelp, setLanguageHelp] = useState<LanguageHelpOption>('english_only');
  const [aiCorrections, setAiCorrections] = useState<AICorrectionOption>('let_me_speak');
  const [pickerModal, setPickerModal] = useState<'language' | 'corrections' | null>(null);

  // Smooth Entry / Exit Animations
  const modalAnim = useRef(new Animated.Value(0)).current;
  const pickerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedMinutes(starterMinutes);
      setLanguageHelp('english_only');
      setAiCorrections('let_me_speak');
      setPickerModal(null);
      modalAnim.setValue(0);
      Animated.spring(modalAnim, {
        toValue: 1,
        tension: 65,
        friction: 11,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [visible, starterMinutes]);

  const handleClose = () => {
    if (pickerModal) {
      closePicker();
      return;
    }
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 230,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      onClose();
    });
  };

  const openPicker = (type: 'language' | 'corrections') => {
    setPickerModal(type);
    pickerAnim.setValue(0);
    Animated.spring(pickerAnim, {
      toValue: 1,
      tension: 70,
      friction: 12,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const closePicker = (callback?: () => void) => {
    Animated.timing(pickerAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setPickerModal(null);
      if (callback) callback();
    });
  };

  const isDurationLocked = (opt: DurationOption): boolean => {
    return userTierRank < (TIER_RANK[opt.requiredTier] ?? 0);
  };

  const isLanguageOptionLocked = (optId: LanguageHelpOption): boolean => {
    // Deep Guidance unlocks for any Pro/Paid plan (Basic, Pro, Premium)
    if (optId === 'deep_guidance') {
      return userTierRank < TIER_RANK.basic;
    }
    return false;
  };

  const handleSelectDuration = (opt: DurationOption) => {
    if (isDurationLocked(opt)) {
      if (onUpgradePrompt) {
        onUpgradePrompt();
      }
      return;
    }
    setSelectedMinutes(opt.minutes);
  };

  const handleSelectLanguageHelp = (optId: LanguageHelpOption) => {
    if (isLanguageOptionLocked(optId)) {
      if (onUpgradePrompt) {
        onUpgradePrompt();
      }
      return;
    }
    setLanguageHelp(optId);
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

  const currentLangOpt =
    LANGUAGE_OPTIONS.find((o) => o.id === languageHelp) || LANGUAGE_OPTIONS[0];

  const currentCorrectionOpt =
    CORRECTION_OPTIONS.find((o) => o.id === aiCorrections) || CORRECTION_OPTIONS[1];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={[styles.backdrop, !isDesktop && styles.backdropMobile]}>
        {/* Animated Backdrop touch to dismiss */}
        <Animated.View
          style={[
            styles.backdropTouchArea,
            {
              opacity: modalAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="Close modal"
            accessibilityRole="button"
          />
        </Animated.View>

        <View style={[styles.modalContainer, !isDesktop && styles.modalContainerMobile]}>
          <Animated.View
            style={[
              styles.card,
              isDesktop ? styles.cardDesktop : styles.cardMobile,
              !isDesktop && {
                transform: [
                  {
                    translateY: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [Math.max(windowHeight, 850), 0],
                    }),
                  },
                ],
              },
              isDesktop && {
                opacity: modalAnim,
                transform: [
                  {
                    scale: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
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
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Content Container (No Scrollbar) */}
            <View style={[styles.scrollContent, !isDesktop && styles.scrollContentMobile]}>
              {/* SECTION 1: Practice Time */}
              <View style={[styles.sectionContainer, !isDesktop && styles.sectionContainerMobile]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconBadge, { backgroundColor: '#E0EDFF' }]}>
                    <Ionicons name="time-outline" size={20} color="#2B5BFF" />
                  </View>
                  <View style={styles.sectionTextGroup}>
                    <Text style={styles.sectionTitle}>Practice time</Text>
                    <Text style={styles.sectionSubtitle}>How long do you want to practice?</Text>
                  </View>
                </View>

                {/* 4 Duration Cards Grid (Figma Spec) */}
                <View style={[styles.durationRow, !isDesktop && styles.durationRowMobile]}>
                  {durationOptions.map((opt) => {
                    const locked = isDurationLocked(opt);
                    const isSelected = !locked && selectedMinutes === opt.minutes;

                    if (locked) {
                      return (
                        <Pressable
                          key={opt.tierLabel}
                          style={({ pressed }) => [
                            styles.durationCard,
                            !isDesktop && styles.durationCardMobile,
                            styles.durationCardLocked,
                            pressed && styles.btnPressed,
                          ]}
                          onPress={() => handleSelectDuration(opt)}
                          accessibilityRole="button"
                          accessibilityLabel={`${opt.minutes} minutes ${opt.tierLabel} locked. Tap to upgrade.`}
                        >
                          {/* Top-Right Lock Icon */}
                          <View style={styles.cardTopRightIndicator}>
                            <Ionicons name="lock-closed" size={14} color="#475569" />
                          </View>

                          {/* Middle Row: Gray Clock Circle + Minutes & Crown Tier */}
                          <View style={styles.durationCardMainRow}>
                            <View style={styles.durationClockCircleLocked}>
                              <Ionicons name="time-outline" size={18} color="#475569" />
                            </View>
                            <View style={styles.durationTextCol}>
                              <Text style={styles.durationMinutesTextLocked}>
                                {opt.minutes} min
                              </Text>
                              <View style={styles.durationTierCrownRow}>
                                <SmallCrownSvg color="#D97706" size={12} />
                                <Text style={styles.durationTierTextLocked}>
                                  {opt.tierLabel}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Bottom Upgrade Pill Button */}
                          <View style={styles.cardUpgradePill}>
                            <Text style={styles.cardUpgradePillText}>Upgrade</Text>
                          </View>
                        </Pressable>
                      );
                    }

                    return (
                      <Pressable
                        key={opt.tierLabel}
                        style={({ pressed }) => [
                          styles.durationCard,
                          !isDesktop && styles.durationCardMobile,
                          styles.durationCardUnlocked,
                          isSelected && styles.durationCardSelected,
                          pressed && styles.btnPressed,
                        ]}
                        onPress={() => handleSelectDuration(opt)}
                        accessibilityRole="button"
                        accessibilityLabel={`${opt.minutes} minutes ${opt.tierLabel}`}
                      >
                        {/* Top-Right Radio Indicator */}
                        <View style={styles.cardTopRightIndicator}>
                          <RadioIndicator selected={isSelected} />
                        </View>

                        {/* Middle Row: Blue Clock Circle + Minutes & Tier */}
                        <View style={styles.durationCardMainRow}>
                          <View
                            style={[
                              styles.durationClockCircleUnlocked,
                              isSelected && styles.durationClockCircleSelected,
                            ]}
                          >
                            <Ionicons
                              name="time-outline"
                              size={19}
                              color={isSelected ? '#0D4EFD' : '#64748B'}
                            />
                          </View>
                          <View style={styles.durationTextCol}>
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
                                isSelected && styles.durationTierSelected,
                              ]}
                            >
                              {opt.tierLabel}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* SECTION 2: Language Help */}
              <View style={[styles.sectionContainer, !isDesktop && styles.sectionContainerMobile]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconBadge, { backgroundColor: '#E6F9F0' }]}>
                    <Ionicons name="language-outline" size={20} color="#059669" />
                  </View>
                  <View style={styles.sectionTextGroup}>
                    <Text style={styles.sectionTitle}>Language help</Text>
                    <Text style={styles.sectionSubtitle}>
                      Practise with friendly Sinhala coaching whenever you need help.
                    </Text>
                  </View>
                </View>

                {isDesktop ? (
                  <View style={styles.threeColRow}>
                    {LANGUAGE_OPTIONS.map((opt) => {
                      const locked = isLanguageOptionLocked(opt.id);
                      const isSelected = !locked && languageHelp === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={({ pressed }) => [
                            styles.choiceCard,
                            locked && styles.choiceCardLocked,
                            isSelected && styles.choiceCardSelected,
                            pressed && styles.btnPressed,
                          ]}
                          onPress={() => handleSelectLanguageHelp(opt.id)}
                          accessibilityRole="button"
                        >
                          {/* Top-Right Radio or Lock */}
                          <View style={styles.cardTopRightIndicator}>
                            {locked ? (
                              <Ionicons name="lock-closed" size={14} color="#475569" />
                            ) : (
                              <RadioIndicator selected={isSelected} />
                            )}
                          </View>

                          <View style={styles.choiceTopRow}>
                            <View style={[styles.choiceIconCircle, { backgroundColor: opt.iconBg }]}>
                              <Ionicons name={opt.iconName} size={18} color={opt.iconColor} />
                            </View>
                            <View style={styles.choiceTextCol}>
                              <Text
                                style={[
                                  styles.choiceTitle,
                                  locked && styles.choiceTitleLocked,
                                  isSelected && styles.choiceTitleSelected,
                                ]}
                              >
                                {opt.title}
                              </Text>
                              <Text style={styles.choiceSubtitle}>{opt.subtitle}</Text>
                            </View>
                          </View>

                          {locked && (
                            <View style={[styles.cardUpgradePill, { marginTop: 8, width: '78%', alignSelf: 'center' }]}>
                              <Text style={styles.cardUpgradePillText}>Upgrade</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  /* Mobile Collapsed Single Card with Change > */
                  <Pressable
                    style={({ pressed }) => [styles.summaryCard, pressed && styles.btnPressed]}
                    onPress={() => openPicker('language')}
                    accessibilityRole="button"
                    accessibilityLabel={`Language help: ${currentLangOpt.title}. Tap to change.`}
                  >
                    <View style={[styles.choiceIconCircle, { backgroundColor: currentLangOpt.iconBg }]}>
                      <Ionicons name={currentLangOpt.iconName} size={18} color={currentLangOpt.iconColor} />
                    </View>
                    <View style={styles.summaryTextCol}>
                      <Text style={styles.summaryTitle}>{currentLangOpt.title}</Text>
                      <Text style={styles.summarySubtitle} numberOfLines={1}>
                        {currentLangOpt.subtitle}
                      </Text>
                    </View>
                    <View style={styles.changeActionRow}>
                      <Text style={styles.changeText}>Change</Text>
                      <Ionicons name="chevron-forward" size={16} color="#0D4EFD" />
                    </View>
                  </Pressable>
                )}
              </View>

              {/* SECTION 3: AI corrections */}
              <View style={[styles.sectionContainer, !isDesktop && styles.sectionContainerMobile]}>
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

                {isDesktop ? (
                  <View style={styles.threeColRow}>
                    {CORRECTION_OPTIONS.map((opt) => {
                      const isSelected = aiCorrections === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={({ pressed }) => [
                            styles.choiceCard,
                            isSelected && styles.choiceCardSelected,
                            pressed && styles.btnPressed,
                          ]}
                          onPress={() => setAiCorrections(opt.id)}
                          accessibilityRole="button"
                        >
                          {/* Top-Right Radio Indicator */}
                          <View style={styles.cardTopRightIndicator}>
                            <RadioIndicator selected={isSelected} />
                          </View>

                          <View style={styles.choiceTopRow}>
                            <View style={[styles.choiceIconCircle, { backgroundColor: opt.iconBg }]}>
                              {opt.iconType === 'scale-balance' ? (
                                <Ionicons name="options-outline" size={19} color={opt.iconColor} />
                              ) : opt.iconType === 'sprout' ? (
                                <Ionicons name="leaf-outline" size={19} color={opt.iconColor} />
                              ) : (
                                <Ionicons name="flash-outline" size={18} color={opt.iconColor} />
                              )}
                            </View>
                            <View style={styles.choiceTextCol}>
                              <Text
                                style={[
                                  styles.choiceTitle,
                                  isSelected && styles.choiceTitleSelected,
                                ]}
                              >
                                {opt.title}
                              </Text>
                              <Text style={styles.choiceSubtitle}>{opt.subtitle}</Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  /* Mobile Collapsed Single Card with Change > */
                  <Pressable
                    style={({ pressed }) => [styles.summaryCard, pressed && styles.btnPressed]}
                    onPress={() => openPicker('corrections')}
                    accessibilityRole="button"
                    accessibilityLabel={`AI corrections: ${currentCorrectionOpt.title}. Tap to change.`}
                  >
                    <View style={[styles.choiceIconCircle, { backgroundColor: currentCorrectionOpt.iconBg }]}>
                      {currentCorrectionOpt.iconType === 'scale-balance' ? (
                        <Ionicons name="options-outline" size={19} color={currentCorrectionOpt.iconColor} />
                      ) : currentCorrectionOpt.iconType === 'sprout' ? (
                        <Ionicons name="leaf-outline" size={19} color={currentCorrectionOpt.iconColor} />
                      ) : (
                        <Ionicons name="flash-outline" size={18} color={currentCorrectionOpt.iconColor} />
                      )}
                    </View>
                    <View style={styles.summaryTextCol}>
                      <Text style={styles.summaryTitle}>{currentCorrectionOpt.title}</Text>
                      <Text style={styles.summarySubtitle} numberOfLines={1}>
                        {currentCorrectionOpt.subtitle}
                      </Text>
                    </View>
                    <View style={styles.changeActionRow}>
                      <Text style={styles.changeText}>Change</Text>
                      <Ionicons name="chevron-forward" size={16} color="#2B5BFF" />
                    </View>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Bottom Actions Bar */}
            <View style={[styles.footerRow, !isDesktop && styles.footerRowMobile]}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
                onPress={handleClose}
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

            {/* SUB-PICKER POPUP / BOTTOM SHEET OVERLAY */}
            {pickerModal && (
              <View style={styles.pickerOverlay}>
                <Animated.View
                  style={[
                    styles.pickerBackdropTouch,
                    {
                      opacity: pickerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                  ]}
                >
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => closePicker()}
                    accessibilityRole="button"
                    accessibilityLabel="Close picker"
                  />
                </Animated.View>
                <Animated.View
                  style={[
                    styles.pickerSheet,
                    {
                      transform: [
                        {
                          translateY: pickerAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [500, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  {/* Sheet Handle */}
                  <View style={styles.sheetHandle} />

                  {/* Header */}
                  <View style={styles.pickerHeaderRow}>
                    <View style={styles.pickerHeaderLeft}>
                      <View
                        style={[
                          styles.sectionIconBadge,
                          {
                            backgroundColor:
                              pickerModal === 'language' ? '#E6F9F0' : '#FDE8EE',
                          },
                        ]}
                      >
                        {pickerModal === 'language' ? (
                          <Ionicons name="language-outline" size={18} color="#059669" />
                        ) : (
                          <Ionicons name="chatbubbles-outline" size={18} color="#E11D48" />
                        )}
                      </View>
                      <View style={styles.sectionTextGroup}>
                        <Text style={styles.pickerHeaderTitle}>
                          {pickerModal === 'language' ? 'Language help' : 'AI corrections'}
                        </Text>
                        <Text style={styles.pickerHeaderSubtitle}>
                          {pickerModal === 'language'
                            ? "Choose how much Sinhala support you'd like"
                            : 'Choose when Maya should correct your mistakes'}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
                      onPress={() => closePicker()}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={18} color="#64748B" />
                    </Pressable>
                  </View>

                  {/* Option Cards */}
                  <View style={styles.pickerOptionsList}>
                    {pickerModal === 'language'
                      ? LANGUAGE_OPTIONS.map((opt) => {
                          const locked = isLanguageOptionLocked(opt.id);
                          const isSelected = !locked && languageHelp === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              style={({ pressed }) => [
                                styles.pickerItemCard,
                                locked && styles.choiceCardLocked,
                                isSelected && styles.pickerItemCardSelected,
                                pressed && styles.btnPressed,
                              ]}
                              onPress={() => {
                                if (locked) {
                                  closePicker(() => {
                                    if (onUpgradePrompt) onUpgradePrompt();
                                  });
                                  return;
                                }
                                setLanguageHelp(opt.id);
                                closePicker();
                              }}
                              accessibilityRole="button"
                            >
                              <View style={[styles.choiceIconCircle, { backgroundColor: opt.iconBg }]}>
                                <Ionicons name={opt.iconName} size={18} color={opt.iconColor} />
                              </View>
                              <View style={styles.choiceTextCol}>
                                <Text
                                  style={[
                                    styles.choiceTitle,
                                    locked && styles.choiceTitleLocked,
                                    isSelected && styles.choiceTitleSelected,
                                  ]}
                                >
                                  {opt.title}
                                </Text>
                                <Text style={styles.choiceSubtitle}>{opt.subtitle}</Text>
                              </View>
                              {locked ? (
                                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                                  <Ionicons name="lock-closed" size={14} color="#475569" />
                                  <View style={[styles.cardUpgradePill, { paddingHorizontal: 10, height: 24 }]}>
                                    <Text style={styles.cardUpgradePillText}>Upgrade</Text>
                                  </View>
                                </View>
                              ) : (
                                <RadioIndicator selected={isSelected} />
                              )}
                            </Pressable>
                          );
                        })
                      : CORRECTION_OPTIONS.map((opt) => {
                          const isSelected = aiCorrections === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              style={({ pressed }) => [
                                styles.pickerItemCard,
                                isSelected && styles.pickerItemCardSelected,
                                pressed && styles.btnPressed,
                              ]}
                              onPress={() => {
                                setAiCorrections(opt.id);
                                closePicker();
                              }}
                              accessibilityRole="button"
                            >
                              <View style={[styles.choiceIconCircle, { backgroundColor: opt.iconBg }]}>
                                {opt.iconType === 'scale-balance' ? (
                                  <Ionicons name="options-outline" size={19} color={opt.iconColor} />
                                ) : opt.iconType === 'sprout' ? (
                                  <Ionicons name="leaf-outline" size={19} color={opt.iconColor} />
                                ) : (
                                  <Ionicons name="flash-outline" size={18} color={opt.iconColor} />
                                )}
                              </View>
                              <View style={styles.choiceTextCol}>
                                <Text
                                  style={[
                                    styles.choiceTitle,
                                    isSelected && styles.choiceTitleSelected,
                                  ]}
                                >
                                  {opt.title}
                                </Text>
                                <Text style={styles.choiceSubtitle}>{opt.subtitle}</Text>
                              </View>
                              {isSelected ? (
                                <Ionicons name="checkmark-circle" size={22} color="#2B5BFF" />
                              ) : (
                                <View style={styles.radioUnchecked} />
                              )}
                            </Pressable>
                          );
                        })}
                  </View>
                </Animated.View>
              </View>
            )}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radioCircleOuter, selected && styles.radioCircleOuterSelected]}>
      {selected && <View style={styles.radioCircleInnerDot} />}
    </View>
  );
}

function SmallCrownSvg({ color = '#D97706', size = 12 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M2 12.5L3.2 5.5L6.2 8.2L8 3.5L9.8 8.2L12.8 5.5L14 12.5H2Z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdropMobile: {
    justifyContent: 'flex-end',
    padding: 0,
  },
  backdropTouchArea: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 670,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainerMobile: {
    maxWidth: '100%',
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 22px 55px -12px rgba(15, 23, 42, 0.26), 0 0 1px rgba(15, 23, 42, 0.1)',
        } as any)
      : {
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.2,
          shadowRadius: 24,
          elevation: 14,
        }),
  },
  cardDesktop: {
    maxWidth: 600,
  },
  cardMobile: {
    maxWidth: '100%',
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 26 : 16,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0D4EFD',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 5px 14px rgba(13, 78, 253, 0.28)',
        } as any)
      : {
          shadowColor: '#0D4EFD',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
          elevation: 4,
        }),
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17.5,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerHighlight: {
    color: '#0D4EFD',
  },
  headerSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748B',
    marginTop: 0.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  /* Content Area */
  scrollArea: {
    flexShrink: 1,
  },
  scrollAreaMobile: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    gap: 7,
    paddingBottom: 0,
  },
  scrollContentMobile: {
    gap: 7,
    paddingBottom: 0,
  },

  /* Section Containers */
  sectionContainer: {
    width: '100%',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0px 1px 2px rgba(15, 23, 42, 0.05)',
        } as any)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        }),
  },
  sectionContainerMobile: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionIconBadge: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTextGroup: {
    flex: 1,
  },
  sectionTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#0F172A',
  },
  sectionSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10.8,
    color: '#64748B',
    marginTop: 0.5,
  },

  /* Duration Options (Section 1 - Figma Spec, Compact) */
  durationRow: {
    flexDirection: 'row',
    gap: 7,
  },
  durationRowMobile: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  durationCard: {
    flex: 1,
    minWidth: 105,
    minHeight: 64,
    borderRadius: 11,
    borderWidth: 1.4,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 7,
    justifyContent: 'space-between',
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  durationCardMobile: {
    flexBasis: '48%',
    minWidth: '47%',
    maxWidth: '49%',
  },
  durationCardUnlocked: {
    justifyContent: 'center',
  },
  durationCardSelected: {
    borderColor: '#0D4EFD',
    backgroundColor: '#F5F9FF',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 10px rgba(13, 78, 253, 0.08)',
        } as any)
      : {
          shadowColor: '#0D4EFD',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
  durationCardLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  cardTopRightIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 2,
  },
  radioCircleOuter: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleOuterSelected: {
    borderColor: '#0D4EFD',
  },
  radioCircleInnerDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    backgroundColor: '#0D4EFD',
  },
  durationCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  durationClockCircleUnlocked: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationClockCircleSelected: {
    backgroundColor: '#DCEBFF',
  },
  durationClockCircleLocked: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationTextCol: {
    flex: 1,
  },
  durationMinutesText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#0F172A',
  },
  durationMinutesTextSelected: {
    color: '#0D4EFD',
  },
  durationMinutesTextLocked: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#475569',
  },
  durationTierCrownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 0.5,
  },
  durationTierText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10,
    color: '#64748B',
    marginTop: 0.5,
  },
  durationTierSelected: {
    color: '#0D4EFD',
  },
  durationTierTextLocked: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10,
    color: '#64748B',
  },
  cardUpgradePill: {
    marginTop: 5,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#FDEBD0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  cardUpgradePillText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#B45309',
  },

  /* 3-Column Choice Row (Sections 2 & 3, Compact) */
  threeColRow: {
    flexDirection: 'row',
    gap: 7,
  },
  threeColRowMobile: {
    flexDirection: 'column',
    gap: 6,
  },
  choiceCard: {
    flex: 1,
    minHeight: 58,
    borderRadius: 11,
    borderWidth: 1.4,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 7,
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  choiceCardLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  choiceCardSelected: {
    borderColor: '#0D4EFD',
    backgroundColor: '#F5F9FF',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 10px rgba(13, 78, 253, 0.08)',
        } as any)
      : {
          shadowColor: '#0D4EFD',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
  choiceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 10,
  },
  choiceIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceTextCol: {
    flex: 1,
  },
  choiceTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11.5,
    color: '#0F172A',
  },
  choiceTitleLocked: {
    color: '#475569',
  },
  choiceTitleSelected: {
    color: '#0D4EFD',
  },
  choiceSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 9.8,
    color: '#64748B',
    lineHeight: 12.5,
    marginTop: 1,
  },

  /* Bottom Actions Bar */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerRowMobile: {
    marginTop: 8,
    paddingTop: 8,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cancelBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0F172A',
  },
  startBtn: {
    flex: 2,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0D4EFD',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 6px 16px rgba(13, 78, 253, 0.28)',
        } as any)
      : {
          shadowColor: '#0D4EFD',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 8,
          elevation: 5,
        }),
  },
  startBtnText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#FFFFFF',
  },
  startBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  btnPressed: {
    opacity: 0.8,
  },

  /* Mobile Summary Card */
  summaryCard: {
    width: '100%',
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  summaryTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  summaryTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 14,
    color: '#0F172A',
  },
  summarySubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1.5,
  },
  changeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 6,
  },
  changeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#2B5BFF',
  },

  /* Sub-Picker Popup Overlay */
  pickerOverlay: {
    ...(StyleSheet.absoluteFill as any),
    zIndex: 9999,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  pickerBackdropTouch: {
    ...(StyleSheet.absoluteFill as any),
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  pickerSheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 22,
    gap: 14,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 -10px 40px rgba(15, 23, 42, 0.2)',
        } as any)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 20,
        }),
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  pickerHeaderTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0F172A',
  },
  pickerHeaderSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  pickerOptionsList: {
    gap: 10,
  },
  pickerItemCard: {
    width: '100%',
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  pickerItemCardSelected: {
    borderColor: '#2B5BFF',
    backgroundColor: '#F8FBFF',
  },
  radioUnchecked: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
});
