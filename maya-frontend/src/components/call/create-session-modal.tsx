import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

export type SessionDurationMinutes = 5 | 10 | 15 | 30;
export type LanguageHelpMode = 'sinhala' | 'english';

export interface CreateSessionConfig {
  durationMinutes: SessionDurationMinutes;
  durationSeconds: number;
  languageMode: LanguageHelpMode;
  aiSuggestions: boolean;
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

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  compact?: boolean;
}

function ToggleSwitch({ value, onValueChange, compact = false }: ToggleSwitchProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: compact ? [2, 18] : [2, 20],
  });

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#CBD5E1', '#2B5BFF'],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={8}
      style={styles.switchPressable}
    >
      <Animated.View
        style={[
          compact ? styles.switchTrackCompact : styles.switchTrack,
          { backgroundColor },
        ]}
      >
        <Animated.View
          style={[
            compact ? styles.switchThumbCompact : styles.switchThumb,
            { transform: [{ translateX }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

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
  const isBottomSheet = !isDesktop;

  // Selected State
  const [selectedMinutes, setSelectedMinutes] = useState<SessionDurationMinutes>(5);
  const [languageMode, setLanguageMode] = useState<LanguageHelpMode>('sinhala');
  const [aiSuggestions, setAiSuggestions] = useState<boolean>(true);
  const [topicText, setTopicText] = useState<string>(initialTopic);

  // Sync initial topic when opening
  useEffect(() => {
    if (visible) {
      if (initialTopic) {
        setTopicText(initialTopic);
      } else if (scenarioId) {
        if (scenarioId === 'job-interview') {
          setTopicText('Job Interview for Software Engineer');
        } else if (scenarioId === 'workplace') {
          setTopicText('Daily Standup & Project Status Update');
        } else if (scenarioId === 'travel-english') {
          setTopicText('Checking in at the Airport & Asking for Directions');
        } else if (scenarioId === 'ielts-speaking') {
          setTopicText('IELTS Speaking Part 2: A memorable journey');
        } else if (scenarioId === 'role-play') {
          setTopicText('Ordering food at a restaurant');
        } else {
          setTopicText('');
        }
      } else {
        setTopicText('');
      }
    }
  }, [visible, initialTopic, scenarioId]);

  // Contextual placeholder based on scenario
  const getPlaceholderText = () => {
    if (scenarioId === 'job-interview') {
      return 'e.g. Software Engineer interview at a tech company, Customer Service role...';
    }
    if (scenarioId === 'workplace') {
      return 'e.g. Discussing project deadlines, presenting in a team meeting...';
    }
    if (scenarioId === 'travel-english') {
      return 'e.g. Booking a hotel in London, ordering food at a restaurant...';
    }
    if (scenarioId === 'ielts-speaking') {
      return 'e.g. Describe a person who influenced you, discuss renewable energy...';
    }
    return 'e.g. Talk about my weekend plans, a job interview, travelling to Japan...';
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
    const finalTopic = topicText.trim() || (scenarioTitle ? `${scenarioTitle} practice` : 'General Spoken English Practice');
    onStartSession({
      durationMinutes: selectedMinutes,
      durationSeconds: selectedMinutes * 60,
      languageMode,
      aiSuggestions,
      topic: finalTopic,
      scenarioId,
      scenarioTitle,
    });
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType={isBottomSheet ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isBottomSheet && styles.backdropBottomSheet]}>
        {/* Backdrop touch to dismiss */}
        <Pressable
          style={styles.backdropTouchArea}
          onPress={onClose}
          accessibilityLabel="Close modal"
          accessibilityRole="button"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, isBottomSheet && styles.modalContainerBottomSheet]}
        >
          <View
            style={[
              styles.card,
              isDesktop ? styles.cardDesktop : styles.bottomSheetCard,
            ]}
          >
            {/* Top Sheet Handle Bar (Mobile Bottom Sheet like Extra Time Modal) */}
            {isBottomSheet && <View style={styles.sheetHandleBar} />}

            {/* Header */}
            <View style={[styles.headerRow, isDesktop ? styles.headerRowDesktop : styles.headerRowMobile]}>
              <View style={styles.headerLeft}>
                {/* Blue Plus Icon Circle */}
                <View style={[styles.avatarCircle, isDesktop && styles.avatarCircleDesktop]}>
                  <Ionicons name="add" size={isDesktop ? 24 : 22} color="#FFFFFF" />
                </View>
                <View style={styles.headerTextGroup}>
                  <Text style={[styles.headerTitle, isDesktop ? styles.headerTitleDesktop : styles.headerTitleMobile]}>
                    Create New <Text style={styles.headerHighlight}>Session</Text>
                  </Text>
                  <Text style={[styles.headerSubtitle, isDesktop ? styles.headerSubtitleDesktop : styles.headerSubtitleMobile]}>
                    Choose your settings and let's start talking!
                  </Text>
                </View>
              </View>

              {/* Close Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.closeBtn,
                  isDesktop && styles.closeBtnDesktop,
                  pressed && styles.btnPressed,
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <Ionicons name="close" size={isDesktop ? 20 : 20} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Scrollable Content Area */}
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={[
                styles.scrollContent,
                isDesktop ? styles.scrollContentDesktop : styles.scrollContentMobile,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={!isDesktop}
            >
              {/* SECTION 1: Practice Time */}
              <View style={[styles.sectionContainer, isDesktop && styles.sectionContainerDesktop]}>
                <View style={[styles.sectionHeader, isDesktop && styles.sectionHeaderDesktop]}>
                  <View style={[styles.sectionIconBadge, isDesktop && styles.sectionIconBadgeDesktop]}>
                    <Ionicons name="time-outline" size={isDesktop ? 22 : 22} color="#2B5BFF" />
                  </View>
                  <View style={styles.sectionTextGroup}>
                    <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
                      Practice time
                    </Text>
                    <Text style={[styles.sectionSubtitle, isDesktop && styles.sectionSubtitleDesktop]}>
                      How long do you want to practice?
                    </Text>
                  </View>
                </View>

                {/* 4 Duration Cards Grid */}
                <View style={[styles.durationRow, isDesktop && styles.durationRowDesktop]}>
                  {DURATION_OPTIONS.map((opt) => {
                    const isSelected = selectedMinutes === opt.minutes;
                    return (
                      <Pressable
                        key={opt.minutes}
                        style={({ pressed }) => [
                          styles.durationCard,
                          isDesktop ? styles.durationCardDesktop : styles.durationCardMobile,
                          isSelected && styles.durationCardSelected,
                          pressed && styles.btnPressed,
                        ]}
                        onPress={() => handleSelectDuration(opt)}
                        accessibilityRole="button"
                        accessibilityLabel={`${opt.minutes} minutes ${opt.tierLabel}`}
                      >
                        {opt.isPremium && (
                          <View
                            style={[
                              styles.cardTopRightBadges,
                              isDesktop && styles.cardTopRightBadgesDesktop,
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="crown"
                              size={isDesktop ? 13 : 12}
                              color="#F59E0B"
                            />
                            <Ionicons
                              name="lock-closed-outline"
                              size={isDesktop ? 13 : 12}
                              color="#94A3B8"
                            />
                          </View>
                        )}
                        <Text
                          style={[
                            styles.durationMinutesText,
                            isDesktop && styles.durationMinutesTextDesktop,
                            isSelected && styles.durationMinutesTextSelected,
                          ]}
                        >
                          {opt.minutes} min
                        </Text>
                        <Text
                          style={[
                            styles.durationTierText,
                            isDesktop && styles.durationTierTextDesktop,
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

              {/* SECTION 2: Language Help & AI Suggestions (Side-by-Side on Desktop/Tablet, Column on Mobile) */}
              <View
                style={[
                  styles.twoColRow,
                  isDesktop ? styles.twoColRowDesktop : styles.twoColRowMobile,
                ]}
              >
                {/* Language Help Card */}
                <View
                  style={[
                    styles.colCard,
                    isDesktop ? styles.colCardDesktop : styles.colCardMobile,
                  ]}
                >
                  <View style={[styles.sectionHeader, isDesktop && styles.sectionHeaderDesktop]}>
                    <View
                      style={[
                        styles.sectionIconBadge,
                        isDesktop && styles.sectionIconBadgeDesktop,
                        { backgroundColor: '#ECFDF5' },
                      ]}
                    >
                      <MaterialIcons name="translate" size={isDesktop ? 20 : 20} color="#10B981" />
                    </View>
                    <View style={styles.sectionTextGroup}>
                      <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
                        Language help
                      </Text>
                      <Text style={[styles.sectionSubtitle, isDesktop && styles.sectionSubtitleDesktop]}>
                        Show explanations in Sinhala?
                      </Text>
                    </View>
                  </View>

                  {/* Radio Choice Pills */}
                  <View style={[styles.radioGroupRow, isDesktop && styles.radioGroupRowDesktop]}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.radioPill,
                        isDesktop && styles.radioPillDesktop,
                        languageMode === 'sinhala' && styles.radioPillSelected,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => setLanguageMode('sinhala')}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: languageMode === 'sinhala' }}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          isDesktop && styles.radioCircleDesktop,
                          languageMode === 'sinhala' && styles.radioCircleSelected,
                        ]}
                      >
                        {languageMode === 'sinhala' && (
                          <View
                            style={[styles.radioDot, isDesktop && styles.radioDotDesktop]}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.radioText,
                          isDesktop && styles.radioTextDesktop,
                          languageMode === 'sinhala' && styles.radioTextSelected,
                        ]}
                      >
                        in Sinhala
                      </Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.radioPill,
                        isDesktop && styles.radioPillDesktop,
                        languageMode === 'english' && styles.radioPillSelected,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={() => setLanguageMode('english')}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: languageMode === 'english' }}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          isDesktop && styles.radioCircleDesktop,
                          languageMode === 'english' && styles.radioCircleSelected,
                        ]}
                      >
                        {languageMode === 'english' && (
                          <View
                            style={[styles.radioDot, isDesktop && styles.radioDotDesktop]}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.radioText,
                          isDesktop && styles.radioTextDesktop,
                          languageMode === 'english' && styles.radioTextSelected,
                        ]}
                      >
                        English only
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* AI Suggestions Card */}
                <View
                  style={[
                    styles.colCard,
                    isDesktop ? styles.colCardDesktop : styles.colCardMobile,
                  ]}
                >
                  <View style={styles.aiSuggestionHeader}>
                    <View style={styles.aiSuggestionTitleLeft}>
                      <View
                        style={[
                          styles.sectionIconBadge,
                          isDesktop && styles.sectionIconBadgeDesktop,
                        ]}
                      >
                        <Ionicons name="sparkles" size={isDesktop ? 20 : 20} color="#2B5BFF" />
                      </View>
                      <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
                        AI Suggestions
                      </Text>
                    </View>
                    <ToggleSwitch
                      value={aiSuggestions}
                      onValueChange={setAiSuggestions}
                      compact={isDesktop}
                    />
                  </View>
                  <Text
                    style={[
                      styles.aiSuggestionSubtitle,
                      isDesktop && styles.aiSuggestionSubtitleDesktop,
                    ]}
                  >
                    Get grammar feedback, rephrase suggestions and more.
                  </Text>
                </View>
              </View>

              {/* SECTION 3: What do you want to talk about? */}
              <View style={[styles.sectionContainer, isDesktop && styles.sectionContainerDesktop]}>
                <View style={[styles.sectionHeader, isDesktop && styles.sectionHeaderDesktop]}>
                  <View
                    style={[
                      styles.sectionIconBadge,
                      isDesktop && styles.sectionIconBadgeDesktop,
                      { backgroundColor: '#F5F3FF' },
                    ]}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={isDesktop ? 20 : 20}
                      color="#8B5CF6"
                    />
                  </View>
                  <View style={styles.sectionTextGroup}>
                    <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
                      What do you want to talk about?
                    </Text>
                    <Text style={[styles.sectionSubtitle, isDesktop && styles.sectionSubtitleDesktop]}>
                      Choose a topic or type your own.
                    </Text>
                  </View>
                </View>

                {/* Input Card Container */}
                <View style={[styles.inputContainer, isDesktop && styles.inputContainerDesktop]}>
                  <TextInput
                    style={[styles.textInput, isDesktop && styles.textInputDesktop]}
                    multiline
                    numberOfLines={isDesktop ? 3 : 3}
                    maxLength={200}
                    placeholder={getPlaceholderText()}
                    placeholderTextColor="#94A3B8"
                    value={topicText}
                    onChangeText={setTopicText}
                  />

                  {/* Bottom Counter & Mic Button */}
                  <View style={[styles.inputActionsCol, isDesktop && styles.inputActionsColDesktop]}>
                    <Pressable
                      style={({ pressed }) => [styles.micButton, pressed && styles.btnPressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Voice input"
                      hitSlop={8}
                    >
                      <Ionicons name="mic-outline" size={isDesktop ? 20 : 20} color="#64748B" />
                    </Pressable>
                    <Text style={[styles.charCountText, isDesktop && styles.charCountTextDesktop]}>
                      {topicText.length}/200
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View
              style={[
                styles.footerRow,
                isDesktop ? styles.footerRowDesktop : styles.footerRowMobile,
              ]}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  isDesktop && styles.cancelBtnDesktop,
                  pressed && styles.btnPressed,
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.cancelBtnText, isDesktop && styles.cancelBtnTextDesktop]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.startBtn,
                  isDesktop && styles.startBtnDesktop,
                  pressed && styles.btnPressed,
                ]}
                onPress={handleStart}
                accessibilityRole="button"
                accessibilityLabel="Start Session"
              >
                <Text style={[styles.startBtnText, isDesktop && styles.startBtnTextDesktop]}>
                  Start Session →
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        } as any)
      : {}),
  },
  backdropBottomSheet: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        } as any)
      : {}),
  },
  backdropTouchArea: {
    ...StyleSheet.absoluteFill,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 680,
    alignItems: 'center',
  },
  modalContainerBottomSheet: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    justifyContent: 'flex-end',
    marginTop: 'auto',
    marginBottom: 0,
    padding: 0,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.22), 0 0 1px rgba(0, 0, 0, 0.1)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.14,
        shadowRadius: 24,
        elevation: 10,
      },
    }),
  },
  cardDesktop: {
    maxWidth: 680,
    maxHeight: '94vh' as any,
    borderRadius: 28,
  },
  bottomSheetCard: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: Platform.OS === 'web' ? ('88vh' as any) : '88%',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sheetHandleBar: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
    flexShrink: 0,
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerRowDesktop: {
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerRowMobile: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 10px rgba(37, 99, 235, 0.35)' } as any,
      default: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  avatarCircleDesktop: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 21,
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerTitleDesktop: {
    fontSize: 21,
    letterSpacing: -0.4,
  },
  headerTitleMobile: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  headerHighlight: {
    color: '#2563EB',
  },
  headerSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  headerSubtitleDesktop: {
    fontSize: 13,
    marginTop: 2,
  },
  headerSubtitleMobile: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnDesktop: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  /* Scrollable Area */
  scrollArea: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  scrollContentDesktop: {
    paddingHorizontal: 26,
    paddingBottom: 18,
    gap: 14,
  },
  scrollContentMobile: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },

  /* Section Containers */
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
  },
  sectionContainerDesktop: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionHeaderDesktop: {
    gap: 12,
    marginBottom: 14,
  },
  sectionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconBadgeDesktop: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sectionTextGroup: {
    flex: 1,
  },
  sectionTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16.5,
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionTitleDesktop: {
    fontSize: 16.5,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  sectionSubtitleDesktop: {
    fontSize: 13,
    marginTop: 1,
  },

  /* Duration Cards */
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  durationRowDesktop: {
    gap: 10,
  },
  durationCard: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 74,
  },
  durationCardDesktop: {
    minHeight: 74,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  durationCardMobile: {
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 12,
  },
  durationCardSelected: {
    borderColor: '#2B5BFF',
    borderWidth: 2,
    backgroundColor: '#F4F7FF',
  },
  cardTopRightBadges: {
    position: 'absolute',
    top: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardTopRightBadgesDesktop: {
    top: 6,
    right: 8,
    gap: 3,
  },
  durationMinutesText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16.5,
    color: '#0F172A',
  },
  durationMinutesTextDesktop: {
    fontSize: 16.5,
  },
  durationMinutesTextSelected: {
    color: '#2B5BFF',
  },
  durationTierText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  durationTierTextDesktop: {
    fontSize: 12.5,
    marginTop: 2,
  },
  durationTierSelected: {
    color: '#64748B',
  },
  durationTierPremium: {
    color: '#F59E0B',
    ...fontStyle('inter', 'semiBold'),
  },

  /* Section 2: Two Columns */
  twoColRow: {
    flexDirection: 'row',
    gap: 14,
  },
  twoColRowDesktop: {
    gap: 14,
  },
  twoColRowMobile: {
    flexDirection: 'column',
    gap: 10,
  },
  colCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
  },
  colCardDesktop: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  colCardMobile: {
    width: '100%',
    padding: 14,
    borderRadius: 14,
  },
  radioGroupRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  radioGroupRowDesktop: {
    gap: 10,
    marginTop: 6,
  },
  radioPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  radioPillDesktop: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 14,
    gap: 8,
  },
  radioPillSelected: {
    borderColor: '#2B5BFF',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleDesktop: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  radioCircleSelected: {
    borderColor: '#2B5BFF',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2B5BFF',
  },
  radioDotDesktop: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#334155',
  },
  radioTextDesktop: {
    fontSize: 14,
  },
  radioTextSelected: {
    ...fontStyle('inter', 'bold'),
    color: '#2B5BFF',
  },

  /* AI Suggestions Column */
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiSuggestionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiSuggestionSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginTop: 10,
  },
  aiSuggestionSubtitleDesktop: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },

  /* Toggle Switch */
  switchPressable: {
    padding: 2,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  switchTrackCompact: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
      },
    }),
  },
  switchThumbCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      } as any,
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
      },
    }),
  },

  /* Section 3: Topic */
  inputContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  inputContainerDesktop: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    minHeight: 96,
  },
  textInput: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    color: '#0F172A',
    minHeight: 50,
    textAlignVertical: 'top',
    padding: 0,
    lineHeight: 20,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  textInputDesktop: {
    fontSize: 13.5,
    minHeight: 50,
    lineHeight: 20,
  },
  inputActionsCol: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  inputActionsColDesktop: {
    gap: 3,
    marginTop: 2,
  },
  micButton: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCountText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#94A3B8',
  },
  charCountTextDesktop: {
    fontSize: 11.5,
  },

  /* Footer */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
  footerRowDesktop: {
    paddingHorizontal: 26,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 12,
  },
  footerRowMobile: {
    paddingHorizontal: 16,
    paddingTop: 10,
    ...(Platform.OS === 'web'
      ? ({
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
        } as any)
      : {
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        }),
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnDesktop: {
    paddingVertical: 13,
    borderRadius: 16,
  },
  cancelBtnText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    color: '#334155',
  },
  cancelBtnTextDesktop: {
    fontSize: 15,
  },
  startBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' } as any,
      default: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  startBtnDesktop: {
    paddingVertical: 13,
    borderRadius: 16,
  },
  startBtnText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15.5,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  startBtnTextDesktop: {
    fontSize: 15.5,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});
