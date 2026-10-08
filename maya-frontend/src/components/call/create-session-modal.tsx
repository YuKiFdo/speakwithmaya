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
  onUpgradePrompt,
}: CreateSessionModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  // Selected State (Defaults match the uploaded design)
  const [selectedMinutes, setSelectedMinutes] = useState<SessionDurationMinutes>(5);
  const [languageHelp, setLanguageHelp] = useState<LanguageHelpOption>('english_only');
  const [aiCorrections, setAiCorrections] = useState<AICorrectionOption>('keep_on_track');
  const [pickerModal, setPickerModal] = useState<'language' | 'corrections' | null>(null);

  // Smooth Entry / Exit Animations
  const modalAnim = useRef(new Animated.Value(0)).current;
  const pickerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedMinutes(5);
      setLanguageHelp('english_only');
      setAiCorrections('keep_on_track');
      setPickerModal(null);
      modalAnim.setValue(0);
      Animated.spring(modalAnim, {
        toValue: 1,
        tension: 65,
        friction: 11,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    if (pickerModal) {
      closePicker();
      return;
    }
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
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
      duration: 170,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setPickerModal(null);
      if (callback) callback();
    });
  };

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

  const currentLangOpt =
    LANGUAGE_OPTIONS.find((o) => o.id === languageHelp) || LANGUAGE_OPTIONS[0];

  const currentCorrectionOpt =
    CORRECTION_OPTIONS.find((o) => o.id === aiCorrections) || CORRECTION_OPTIONS[1];

  // Whether mobile height is limited enough to need scrollbar
  const isScrollNeeded = !isDesktop && windowHeight < 520;

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
                      outputRange: [380, 0],
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

            {/* Content Container (fits to content on mobile, scrolls only on tiny screens) */}
            <ScrollView
              style={[styles.scrollArea, !isDesktop && styles.scrollAreaMobile]}
              contentContainerStyle={[styles.scrollContent, !isDesktop && styles.scrollContentMobile]}
              showsVerticalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              scrollEnabled={!isDesktop ? windowHeight < 560 : true}
            >
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
              <View style={[styles.sectionContainer, !isDesktop && styles.sectionContainerMobile]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIconBadge, { backgroundColor: '#E6F9F0' }]}>
                    <MaterialIcons name="translate" size={20} color="#059669" />
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
                      const isSelected = languageHelp === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={({ pressed }) => [
                            styles.choiceCard,
                            isSelected && styles.choiceCardSelected,
                            pressed && styles.btnPressed,
                          ]}
                          onPress={() => setLanguageHelp(opt.id)}
                          accessibilityRole="button"
                        >
                          <View style={[styles.choiceIconCircle, { backgroundColor: opt.iconBg }]}>
                            <Ionicons name={opt.iconName} size={18} color={opt.iconColor} />
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
                      <Ionicons name="chevron-forward" size={16} color="#2B5BFF" />
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
                          <View style={[styles.choiceIconCircle, { backgroundColor: opt.iconBg }]}>
                            {opt.iconType === 'scale-balance' ? (
                              <MaterialCommunityIcons name="scale-balance" size={19} color={opt.iconColor} />
                            ) : opt.iconType === 'sprout' ? (
                              <MaterialCommunityIcons name="sprout" size={19} color={opt.iconColor} />
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
                        <MaterialCommunityIcons name="scale-balance" size={19} color={currentCorrectionOpt.iconColor} />
                      ) : currentCorrectionOpt.iconType === 'sprout' ? (
                        <MaterialCommunityIcons name="sprout" size={19} color={currentCorrectionOpt.iconColor} />
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
            </ScrollView>

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
                            outputRange: [320, 0],
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
                          <MaterialIcons name="translate" size={18} color="#059669" />
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
                          const isSelected = languageHelp === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              style={({ pressed }) => [
                                styles.pickerItemCard,
                                isSelected && styles.pickerItemCardSelected,
                                pressed && styles.btnPressed,
                              ]}
                              onPress={() => {
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
                                  <MaterialCommunityIcons name="scale-balance" size={19} color={opt.iconColor} />
                                ) : opt.iconType === 'sprout' ? (
                                  <MaterialCommunityIcons name="sprout" size={19} color={opt.iconColor} />
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
    borderRadius: 26,
    width: '100%',
    paddingHorizontal: 25,
    paddingTop: 22,
    paddingBottom: 22,
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
    maxWidth: 630,
  },
  cardMobile: {
    maxWidth: '100%',
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    height: '92%',
    maxHeight: '95%',
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2B5BFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 16px rgba(43, 91, 255, 0.32)',
        } as any)
      : {
          shadowColor: '#2B5BFF',
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
    fontSize: 20.5,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerHighlight: {
    color: '#2B5BFF',
  },
  headerSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  /* Scrollable Area */
  scrollArea: {
    maxHeight: 600,
  },
  scrollAreaMobile: {
    flex: 1,
    maxHeight: undefined,
    ...(Platform.OS === 'web'
      ? ({
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as any)
      : {}),
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 6,
  },
  scrollContentMobile: {
    gap: 10,
    paddingBottom: 4,
  },

  /* Section Containers */
  sectionContainer: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 0.63,
    borderColor: '#F1F5F9',
    borderTopWidth: 0.63,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0px 0.63px 1.25px -0.63px rgba(0, 0, 0, 0.08), 0px 0.63px 1.88px 0px rgba(0, 0, 0, 0.08)',
        } as any)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
          elevation: 1,
        }),
  },
  sectionContainerMobile: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 11,
  },
  sectionIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTextGroup: {
    flex: 1,
  },
  sectionTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 14.5,
    color: '#0F172A',
  },
  sectionSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },

  /* Duration Options (Section 1) */
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationRowMobile: {
    gap: 7,
  },
  durationCard: {
    flex: 1,
    height: 66,
    borderRadius: 14,
    borderWidth: 1.2,
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
          boxShadow: '0 0 0 1px #2B5BFF, 0 3px 12px rgba(43, 91, 255, 0.12)',
        } as any)
      : {
          shadowColor: '#2B5BFF',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 5,
          elevation: 2,
        }),
  },
  cardTopRightBadges: {
    position: 'absolute',
    top: 5,
    right: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  durationMinutesText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 16,
    color: '#0F172A',
  },
  durationMinutesTextSelected: {
    color: '#2B5BFF',
  },
  durationTierText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
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
    gap: 9,
  },
  threeColRowMobile: {
    flexDirection: 'column',
    gap: 7,
  },
  choiceCard: {
    flex: 1,
    minHeight: 65,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  choiceCardSelected: {
    borderColor: '#2B5BFF',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 1px #2B5BFF, 0 3px 12px rgba(43, 91, 255, 0.12)',
        } as any)
      : {
          shadowColor: '#2B5BFF',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 5,
          elevation: 2,
        }),
  },
  choiceIconCircle: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceTextCol: {
    flex: 1,
  },
  choiceTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#0F172A',
  },
  choiceTitleSelected: {
    color: '#2B5BFF',
  },
  choiceSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10.8,
    color: '#64748B',
    lineHeight: 14,
    marginTop: 1.5,
  },

  /* Bottom Actions Bar */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerRowMobile: {
    marginTop: 12,
    paddingTop: 10,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 13,
    borderWidth: 1.2,
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
    height: 48,
    borderRadius: 13,
    backgroundColor: '#2B5BFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(43, 91, 255, 0.32)',
        } as any)
      : {
          shadowColor: '#2B5BFF',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5,
        }),
  },
  startBtnText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 14,
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
