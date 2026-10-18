import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { MilestoneItem } from '@/app/(tabs)/roadmap';

export interface ScenarioBriefingDetails {
  category: string;
  title: string;
  description: string;
  userRole: string;
  mayaRole: string;
  goalTitle: string;
  goalDescription: string;
}

export function resolveScenarioBriefingData(item: MilestoneItem | null | undefined): ScenarioBriefingDetails {
  if (!item) {
    return {
      category: 'Role Play Practice',
      title: 'Speaking Practice',
      description: 'Practice real-world conversations with Maya.',
      userRole: 'Hotel guest',
      mayaRole: 'Hotel receptionist',
      goalTitle: 'Stay calm and find a solution',
      goalDescription: 'Express your thoughts clearly and work toward a positive outcome.',
    };
  }

  const category = (item.topic && item.topic.trim()) || 'Role Play Practice';
  const title = (item.title && item.title.trim()) || 'Roleplay Scenario';
  const description =
    (item.scenarioBriefing && item.scenarioBriefing.trim()) ||
    (item.description && item.description.trim()) ||
    'Get ready for an authentic conversation practice session with Maya.';

  // 1. User Role with context-aware fallback
  let userRole = (item.userRole || '').trim();
  if (!userRole) {
    const textToCheck = `${item.title} ${item.scenarioPrompt || ''} ${item.scenarioBriefing || ''}`.toLowerCase();
    if (textToCheck.includes('hotel') || textToCheck.includes('room')) {
      userRole = 'Hotel guest';
    } else if (textToCheck.includes('interview') || textToCheck.includes('candidate')) {
      userRole = 'Job candidate';
    } else if (textToCheck.includes('flight') || textToCheck.includes('airport')) {
      userRole = 'Airline passenger';
    } else if (textToCheck.includes('cafe') || textToCheck.includes('coffee')) {
      userRole = 'Cafe customer';
    } else if (textToCheck.includes('friend') || textToCheck.includes('scholarship')) {
      userRole = 'Supportive friend';
    } else {
      userRole = 'English learner';
    }
  }

  // 2. Maya's Role with context-aware fallback
  let mayaRole = (item.mayaRole || '').trim();
  if (!mayaRole) {
    const textToCheck = `${item.title} ${item.scenarioPrompt || ''} ${item.scenarioBriefing || ''}`.toLowerCase();
    if (textToCheck.includes('hotel') || textToCheck.includes('room')) {
      mayaRole = 'Hotel receptionist';
    } else if (textToCheck.includes('interview')) {
      mayaRole = 'Hiring Manager';
    } else if (textToCheck.includes('flight') || textToCheck.includes('airport')) {
      mayaRole = 'Airline service agent';
    } else if (textToCheck.includes('cafe') || textToCheck.includes('coffee')) {
      mayaRole = 'Barista';
    } else if (textToCheck.includes('friend')) {
      mayaRole = 'Close friend';
    } else {
      mayaRole = 'Maya (English Coach)';
    }
  }

  // 3. Goal Title with context-aware fallback
  let goalTitle = (item.goalTitle || '').trim();
  if (!goalTitle) {
    const textToCheck = `${item.title} ${item.scenarioPrompt || ''} ${item.scenarioBriefing || ''}`.toLowerCase();
    if (textToCheck.includes('hotel') || textToCheck.includes('mix-up') || textToCheck.includes('complaint')) {
      goalTitle = 'Stay calm and find a solution';
    } else if (textToCheck.includes('interview')) {
      goalTitle = 'Defend your experience with STAR structure';
    } else if (textToCheck.includes('flight')) {
      goalTitle = 'Negotiate vouchers and swift rebooking';
    } else if (textToCheck.includes('friend')) {
      goalTitle = 'Listen with empathy and offer comfort';
    } else if (textToCheck.includes('cafe')) {
      goalTitle = 'Order smoothly & enjoy casual small talk';
    } else {
      goalTitle = 'Speak Confidently & Reach Agreement';
    }
  }

  // 4. Goal Description with context-aware fallback
  let goalDescription = (item.goalDescription || '').trim();
  if (!goalDescription) {
    if (item.practicePoints && item.practicePoints.length > 0) {
      goalDescription = item.practicePoints.join('. ') + '.';
    } else if (item.scenarioBriefing) {
      goalDescription = item.scenarioBriefing;
    } else {
      goalDescription = 'Express your disappointment politely, explain your concern clearly, and negotiate a good solution.';
    }
  }

  return {
    category,
    title,
    description,
    userRole,
    mayaRole,
    goalTitle,
    goalDescription,
  };
}

interface ScenarioBriefingModalProps {
  visible: boolean;
  item: MilestoneItem | null;
  onClose: () => void;
  onStartRoleplay: (item: MilestoneItem) => void;
}

export function ScenarioBriefingModal({
  visible,
  item,
  onClose,
  onStartRoleplay,
}: ScenarioBriefingModalProps) {
  const { isPhone } = useBreakpoint();
  const [internalVisible, setInternalVisible] = useState(visible);
  const [isBtnHovered, setIsBtnHovered] = useState(false);

  // Audio briefing states
  const [audioLang, setAudioLang] = useState<'en' | 'si'>('en');
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [hasAudioFinished, setHasAudioFinished] = useState<boolean>(false);
  const [audioLoading, setAudioLoading] = useState<boolean>(false);
  const audioRef = useRef<any>(null);

  // Smooth entrance/exit animations
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const playBriefingAudio = (lang: 'en' | 'si', targetLevelId?: string) => {
    const lvlId = targetLevelId || item?.id;
    if (!lvlId) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (typeof Audio === 'undefined') {
      // Non-web fallback
      setHasAudioFinished(true);
      setIsAudioPlaying(false);
      return;
    }

    const baseUrl = getBackendBaseUrl();
    const streamUrl = `${baseUrl}/v1/roadmap/levels/${lvlId}/briefing-audio?lang=${lang}`;

    setAudioLoading(true);
    setIsAudioPlaying(true);
    setHasAudioFinished(false);

    try {
      const audio = new Audio(streamUrl);
      audioRef.current = audio;

      audio.oncanplay = () => {
        setAudioLoading(false);
      };

      audio.onended = () => {
        setIsAudioPlaying(false);
        setHasAudioFinished(true);
        setAudioLoading(false);
      };

      audio.onerror = (e) => {
        console.warn('[BriefingModal] Audio streaming error, enabling roleplay button:', e);
        setIsAudioPlaying(false);
        setHasAudioFinished(true);
        setAudioLoading(false);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[BriefingModal] Autoplay prevented or error:', err);
          setIsAudioPlaying(false);
          setHasAudioFinished(true);
          setAudioLoading(false);
        });
      }
    } catch (err) {
      console.warn('[BriefingModal] Failed to initialize Audio:', err);
      setIsAudioPlaying(false);
      setHasAudioFinished(true);
      setAudioLoading(false);
    }
  };

  useEffect(() => {
    if (visible && item) {
      setInternalVisible(true);
      slideAnim.setValue(isPhone ? 60 : 30);
      opacityAnim.setValue(0);
      backdropAnim.setValue(0);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 250,
          mass: 0.8,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      // Start Maya's voice briefing immediately
      setAudioLang('en');
      playBriefingAudio('en', item.id);
    } else if (!visible && internalVisible) {
      handleAnimatedClose();
    }
  }, [visible, item]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAnimatedClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsAudioPlaying(false);

    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: isPhone ? 60 : 25,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setInternalVisible(false);
      onClose();
    });
  };

  const handleLanguageToggle = (lang: 'en' | 'si') => {
    if (audioLang === lang && isAudioPlaying) return;
    setAudioLang(lang);
    playBriefingAudio(lang, item?.id);
  };

  const handleSkipBriefing = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsAudioPlaying(false);
    setHasAudioFinished(true);
  };

  const handleReplay = () => {
    playBriefingAudio(audioLang, item?.id);
  };

  if (!internalVisible || !item) return null;

  const data = resolveScenarioBriefingData(item);

  return (
    <Modal
      visible={internalVisible}
      transparent
      animationType="none"
      onRequestClose={handleAnimatedClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Backdrop (Darkened blur on desktop, tinted on mobile) */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, isPhone ? 0.65 : 0.55],
              }),
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleAnimatedClose} />
        </Animated.View>

        {/* Content Container (Full-screen mobile sheet or desktop modal card) */}
        <Animated.View
          style={[
            styles.containerCard,
            isPhone ? styles.containerCardMobile : styles.containerCardDesktop,
            {
              opacity: opacityAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
            {/* Header with Category Tag and Close Button */}
            <View style={styles.headerRow}>
              <Text style={styles.categoryTag} numberOfLines={1}>
                {data.category}
              </Text>
              
              <Pressable
                onPress={handleAnimatedClose}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.closeBtnPressed,
                ]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close scenario preview"
              >
                <Feather name="x" size={20} color="#64748B" />
              </Pressable>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Scenario Main Title */}
              <Text style={styles.mainTitle}>{data.title}</Text>

              {/* Scenario Premise / Description */}
              <Text style={styles.mainDescription}>{data.description}</Text>

              {/* Center Prominent Language Toggle Button */}
              <View style={styles.centerVoiceToggleContainer}>
                <Pressable
                  onPress={() => handleLanguageToggle(audioLang === 'en' ? 'si' : 'en')}
                  style={({ pressed }) => [
                    styles.centerVoiceBtn,
                    audioLang === 'si' ? styles.centerVoiceBtnSinhala : styles.centerVoiceBtnEnglish,
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle voice briefing language"
                >
                  <Ionicons
                    name={audioLang === 'si' ? 'volume-high' : 'chatbubble-ellipses-outline'}
                    size={17}
                    color={audioLang === 'si' ? '#0057FF' : '#D97706'}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.centerVoiceBtnText, audioLang === 'si' && styles.centerVoiceBtnTextSinhala]}>
                    {audioLang === 'en'
                      ? '🇱🇰 සිංහලෙන් අහන්න (Listen in Sinhala)'
                      : '🇬🇧 Listen in English (ඉංග්‍රීසියෙන් අහන්න)'}
                  </Text>
                </Pressable>
              </View>

              {/* Card 1: YOUR ROLE (Light Blue) */}
              <View style={styles.roleCardBlue}>
                <View style={styles.roleAvatarCircleBlue}>
                  <Ionicons name="person" size={20} color="#2563EB" />
                </View>
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleBadgeBlue}>YOUR ROLE</Text>
                  <Text style={styles.roleValueText}>{data.userRole}</Text>
                </View>
              </View>

              {/* Card 2: MAYA'S ROLE (Light Orange/Cream) */}
              <View style={styles.roleCardOrange}>
                <View style={styles.roleAvatarCircleOrange}>
                  <Ionicons name="headset" size={20} color="#EA580C" />
                </View>
                <View style={styles.roleTextContainer}>
                  <Text style={styles.roleBadgeOrange}>MAYA’S ROLE</Text>
                  <Text style={styles.roleValueText}>{data.mayaRole}</Text>
                </View>
              </View>

              {/* Card 3: YOUR GOAL (Light Green/Mint) */}
              <View style={styles.goalCardGreen}>
                <Text style={styles.goalBadgeGreen}>YOUR GOAL</Text>
                <Text style={styles.goalTitleText}>{data.goalTitle}</Text>
                <Text style={styles.goalDescriptionText}>{data.goalDescription}</Text>
              </View>
            </ScrollView>

            {/* Fixed CTA Action Button at Bottom */}
            <View style={styles.bottomFooter}>
              {isAudioPlaying ? (
                <View style={styles.ctaButtonDisabled}>
                  <ActivityIndicator size="small" color="#94A3B8" style={{ marginRight: 10 }} />
                  <Text style={styles.ctaButtonTextDisabled}>
                    {audioLoading ? '🔊 Preparing Maya’s voice...' : '🔊 Maya is briefing you...'}
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current = null;
                    }
                    onStartRoleplay(item);
                  }}
                  onHoverIn={() => setIsBtnHovered(true)}
                  onHoverOut={() => setIsBtnHovered(false)}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    isBtnHovered && styles.ctaButtonHovered,
                    pressed && styles.ctaButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Start Roleplay Practice"
                >
                  <Text style={styles.ctaButtonText}>Start Roleplay</Text>
                  <Ionicons name="arrow-forward" size={19} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
  },

  // Desktop Centered Floating Card
  containerCardDesktop: {
    width: '92%',
    maxWidth: 440,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 20,
    overflow: 'hidden',
  },

  // Mobile Clean Full-Height Sheet
  containerCardMobile: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  containerCard: {
    backgroundColor: '#FFFFFF',
  },

  safeContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  categoryTag: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 14,
    color: '#64748B',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  closeBtnPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.94 }],
  },

  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },

  mainTitle: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 27,
    lineHeight: 33,
    color: '#0F172A',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  mainDescription: {
    ...fontStyle('inter', 'regular'),
    fontSize: 15.5,
    lineHeight: 23,
    color: '#475569',
    marginBottom: 16,
  },

  // Center Prominent Voice Language Switcher
  centerVoiceToggleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  centerVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  centerVoiceBtnEnglish: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  centerVoiceBtnSinhala: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  centerVoiceBtnText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13.5,
    color: '#B45309',
  },
  centerVoiceBtnTextSinhala: {
    color: '#1D4ED8',
  },

  // Blue Card: YOUR ROLE
  roleCardBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F6FE',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  roleAvatarCircleBlue: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCEBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleBadgeBlue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#2563EB',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  roleValueText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#0F172A',
  },

  // Orange Card: MAYA'S ROLE
  roleCardOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  roleAvatarCircleOrange: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleBadgeOrange: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#EA580C',
    textTransform: 'uppercase',
    marginBottom: 2,
  },

  // Green Card: YOUR GOAL
  goalCardGreen: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 16,
  },
  goalBadgeGreen: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#059669',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  goalTitleText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 6,
  },
  goalDescriptionText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13.5,
    lineHeight: 20,
    color: '#475569',
  },

  // Fixed Bottom Button
  bottomFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    backgroundColor: '#FFFFFF',
  },
  ctaButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonHovered: {
    backgroundColor: '#2563EB',
    transform: [{ translateY: -1 }],
  },
  ctaButtonPressed: {
    backgroundColor: '#1D4ED8',
    transform: [{ scale: 0.98 }],
  },
  ctaButtonText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  ctaButtonDisabled: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaButtonTextDisabled: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15.5,
    color: '#64748B',
    letterSpacing: 0.2,
  },
});
