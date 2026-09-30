import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  ImageSourcePropType,
  Platform,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Path,
  Polygon,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';

export type PopupPreset =
  | 'unlock-premium'
  | 'daily-limit'
  | 'practice-complete'
  | 'level-up'
  | 'get-extra-time'
  | 'custom';

export interface CommonPopupProps {
  visible: boolean;
  onClose: () => void;
  preset?: PopupPreset;

  // Header graphics
  imageSource?: ImageSourcePropType;
  renderHeaderGraphic?: () => React.ReactNode;
  levelNumber?: number;

  // Text content
  title?: string;
  titleHighlight?: string;
  subtitle?: string;

  // Middle custom content / slot (e.g. for minutes progress bar or stats)
  children?: React.ReactNode;

  // Minutes card (used by practice-complete or custom)
  minutesUsed?: number;
  minutesTotal?: number;
  minutesLabel?: string;
  minutesHintText?: string;

  // Primary action button
  primaryButtonText?: string;
  primaryButtonIcon?: 'crown' | 'play' | 'arrow' | 'mic' | 'none' | React.ReactNode;
  showPrimaryArrow?: boolean;
  onPrimaryPress?: () => void;

  // Footer / Secondary action
  footerText?: string;
  footerButtonText?: string;
  onFooterButtonPress?: () => void;

  // Modal behavior
  showCloseButton?: boolean;
  closeOnBackdropPress?: boolean;
  showImageFade?: boolean;
  containerStyle?: ViewStyle;
  onSelectPackage?: (pkg: { id: string; minutes: number; price: string }) => void;
}

// Default images for presets
const PRESET_IMAGES = {
  'unlock-premium': require('@/assets/images/mayacrown.png'),
  'daily-limit': require('@/assets/images/mayaclock.png'),
  'practice-complete': require('@/assets/images/mayathumb.png'),
};

/**
 * Level Hexagon Badge with soft glow for Level Up popups
 */
export function LevelHexagonBadge({ level = 5, size = 130 }: { level?: number; size?: number }) {
  return (
    <View style={badgeStyles.wrapper}>
      {/* Outer Glow */}
      <View style={badgeStyles.glowCircle} />
      
      <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
        <Defs>
          <LinearGradient id="hexGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#3B82F6" />
            <Stop offset="50%" stopColor="#2563EB" />
            <Stop offset="100%" stopColor="#1D4ED8" />
          </LinearGradient>
          <LinearGradient id="borderGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#93C5FD" />
            <Stop offset="100%" stopColor="#3B82F6" />
          </LinearGradient>
        </Defs>

        {/* Outer Hexagon border */}
        <Polygon
          points="60,6 108,33 108,87 60,114 12,87 12,33"
          fill="url(#hexGrad)"
          stroke="url(#borderGrad)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Subtle Inner Bevel / Highlight */}
        <Polygon
          points="60,14 100,37 100,83 60,106 20,83 20,37"
          fill="none"
          stroke="#60A5FA"
          strokeWidth="1.2"
          strokeOpacity="0.5"
          strokeLinejoin="round"
        />
      </Svg>

      {/* Level label & Number */}
      <View style={badgeStyles.textContainer}>
        <Text style={badgeStyles.levelLabel}>Level</Text>
        <Text style={badgeStyles.levelNumber}>{level}</Text>
      </View>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  wrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  glowCircle: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    filter: Platform.OS === 'web' ? 'blur(16px)' : undefined,
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLabel: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
    marginBottom: -2,
  },
  levelNumber: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 42,
    lineHeight: 46,
    color: '#FFFFFF',
  },
});

/**
 * Common Popup Component
 */
export function CommonPopup({
  visible,
  onClose,
  preset = 'custom',
  imageSource,
  renderHeaderGraphic,
  levelNumber = 5,
  title,
  titleHighlight,
  subtitle,
  children,
  minutesUsed = 320,
  minutesTotal = 450,
  minutesLabel = 'Monthly AI minutes',
  minutesHintText = 'Use your remaining monthly minutes',
  primaryButtonText,
  primaryButtonIcon,
  showPrimaryArrow,
  onPrimaryPress,
  footerText,
  footerButtonText,
  onFooterButtonPress,
  showCloseButton,
  closeOnBackdropPress = true,
  showImageFade = true,
  containerStyle,
  onSelectPackage,
}: CommonPopupProps) {
  // Preset defaults resolution
  const resolvedPreset = preset;

  let finalImage = imageSource;
  if (!finalImage && !renderHeaderGraphic) {
    if (resolvedPreset === 'unlock-premium') {
      finalImage = PRESET_IMAGES['unlock-premium'];
    } else if (resolvedPreset === 'daily-limit') {
      finalImage = PRESET_IMAGES['daily-limit'];
    } else if (resolvedPreset === 'practice-complete') {
      finalImage = PRESET_IMAGES['practice-complete'];
    }
  }

  // Titles resolution
  let finalTitle = title;
  let finalHighlight = titleHighlight;
  let finalSubtitle = subtitle;
  let finalBtnText = primaryButtonText;
  let finalBtnIcon = primaryButtonIcon;
  let finalShowArrow = showPrimaryArrow;
  let finalFooterText = footerText;
  let finalFooterBtn = footerButtonText;
  let finalShowClose = showCloseButton;

  if (resolvedPreset === 'unlock-premium') {
    if (!finalTitle) {
      finalTitle = 'Unlock with Premium';
      finalHighlight = 'Premium';
    }
    if (!finalSubtitle) {
      finalSubtitle = 'This feature is available for Premium users only.';
    }
    if (!finalBtnText) finalBtnText = 'Upgrade to Premium';
    if (finalBtnIcon === undefined) finalBtnIcon = 'crown';
    if (finalShowArrow === undefined) finalShowArrow = true;
    if (finalFooterText === undefined) {
      finalFooterText = 'Upgrade to Premium and get access to all features.';
    }
  } else if (resolvedPreset === 'daily-limit') {
    if (!finalTitle) {
      finalTitle = "You've reached your daily limit!";
      finalHighlight = 'daily limit!';
    }
    if (!finalSubtitle) {
      finalSubtitle = 'Continue your practice with Premium.';
    }
    if (!finalBtnText) finalBtnText = 'Upgrade to Premium';
    if (finalBtnIcon === undefined) finalBtnIcon = 'crown';
    if (finalShowArrow === undefined) finalShowArrow = true;
    if (finalFooterText === undefined) {
      finalFooterText = 'Upgrade to Premium and get access to all features.';
    }
  } else if (resolvedPreset === 'practice-complete') {
    if (!finalTitle) {
      finalTitle = "Today's practice complete!";
      finalHighlight = 'complete!';
    }
    if (!finalSubtitle) {
      finalSubtitle = 'You can continue using your remaining monthly AI minutes';
    }
    if (!finalBtnText) finalBtnText = 'Keep Talking';
    if (finalBtnIcon === undefined) finalBtnIcon = 'play';
    if (finalShowArrow === undefined) finalShowArrow = true;
    if (finalFooterBtn === undefined) {
      finalFooterBtn = 'Upgrade for More Minutes →';
    }
    if (finalShowClose === undefined) finalShowClose = true;
  } else if (resolvedPreset === 'level-up') {
    if (!finalTitle) finalTitle = 'Level Up!';
    if (!finalSubtitle) {
      finalSubtitle = `You've reached Level ${levelNumber}!\nKeep going and become a more confident English speaker!`;
    }
    if (!finalBtnText) finalBtnText = 'Awesome!';
    if (finalBtnIcon === undefined) finalBtnIcon = 'none';
    if (finalShowArrow === undefined) finalShowArrow = false;
  } else if (resolvedPreset === 'get-extra-time') {
    if (!finalTitle) finalTitle = 'Keep the conversation going!';
    if (!finalHighlight) finalHighlight = 'going!';
    if (!finalSubtitle) {
      finalSubtitle = `You've used ${minutesUsed ?? 320} of ${minutesTotal ?? 600} minutes this month. Get extra minutes and continue practicing with Maya.`;
    }
    if (finalShowClose === undefined) finalShowClose = true;
  }

  // Render Title with optional highlighted word
  const renderTitle = () => {
    if (!finalTitle) return null;
    if (!finalHighlight) {
      return <Text style={styles.titleText}>{finalTitle}</Text>;
    }

    const parts = finalTitle.split(finalHighlight);
    return (
      <Text style={styles.titleText}>
        {parts[0]}
        <Text style={styles.titleHighlightText}>{finalHighlight}</Text>
        {parts[1] || ''}
      </Text>
    );
  };

  // Render primary button icon
  const renderPrimaryIcon = () => {
    if (finalBtnIcon === 'crown') {
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={styles.btnLeadingIcon}>
          <Path
            d="M2.5 19H21.5V20.5H2.5V19ZM3.5 17L2 7.5L7.5 12L12 4.5L16.5 12L22 7.5L20.5 17H3.5Z"
            fill="#FFFFFF"
          />
        </Svg>
      );
    }
    if (finalBtnIcon === 'play') {
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.btnLeadingIcon}>
          <Path d="M6 4L19 12L6 20V4Z" fill="#FFFFFF" />
        </Svg>
      );
    }
    if (finalBtnIcon === 'mic') {
      return (
        <Ionicons name="mic" size={18} color="#FFFFFF" style={styles.btnLeadingIcon} />
      );
    }
    if (React.isValidElement(finalBtnIcon)) {
      return <View style={styles.btnLeadingIcon}>{finalBtnIcon}</View>;
    }
    return null;
  };

  // Calculate progress for minutes widget
  const minutesPercent = Math.min(100, Math.max(0, Math.round((minutesUsed / (minutesTotal || 1)) * 100)));

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const isBottomSheet = !isDesktop && resolvedPreset === 'get-extra-time';

  return (
    <Modal
      transparent
      visible={visible}
      animationType={isBottomSheet ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isBottomSheet && styles.backdropBottomSheet]}>
        {/* Click outside to close */}
        {closeOnBackdropPress && (
          <Pressable
            style={styles.backdropTouchArea}
            onPress={onClose}
            accessibilityLabel="Close popup"
            accessibilityRole="button"
          />
        )}

        {resolvedPreset === 'get-extra-time' ? (
          <View
            style={[
              styles.card,
              styles.extraTimeModalCard,
              isDesktop ? styles.extraTimeModalCardDesktop : styles.extraTimeBottomSheet,
              containerStyle,
            ]}
          >
            {/* Top Sheet Handle Bar (Mobile Bottom Sheet) */}
            {!isDesktop && <View style={styles.sheetHandleBar} />}

            {/* Top Close Button (✕) in circle */}
            {finalShowClose && (
              <Pressable
                style={({ pressed }) => [
                  styles.sheetCloseButton,
                  pressed && styles.closeButtonPressed,
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="#64748B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            )}

            {/* Header Category Tag */}
            <Text style={styles.extraCategoryText}>GET EXTRA TALK TIME</Text>

            {/* Title */}
            <Text style={[styles.extraTitleText, !isDesktop && styles.extraTitleTextMobile]}>
              Keep the conversation <Text style={styles.extraHighlightText}>going!</Text>
            </Text>

            {/* Subtitle */}
            <Text style={[styles.extraSubtitleText, !isDesktop && styles.extraSubtitleTextMobile]}>
              {finalSubtitle}
            </Text>

            {/* 3 Package Cards (Side-by-Side Row) */}
            <View style={[styles.extraPackagesContainer, !isDesktop && styles.extraPackagesContainerMobileRow]}>
              {/* Package 1: +30 Min */}
              <View style={[styles.extraPackageCard, !isDesktop && styles.extraPackageCardMobileCol]}>
                <View style={[styles.extraPackageIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke="#0284C7" strokeWidth="2" />
                    <Path d="M12 6V12L15 15" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" />
                  </Svg>
                </View>
                <Text style={[styles.extraPackageTitle, !isDesktop && styles.extraPackageTitleMobile]}>
                  +30 Min
                </Text>
                <Text style={[styles.extraPackageSubtitle, !isDesktop && styles.extraPackageSubtitleMobile]}>
                  Quick Practice
                </Text>
                <Text style={[styles.extraPackagePrice, !isDesktop && styles.extraPackagePriceMobile]}>
                  Rs. 300
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.extraGetBtnOutline, pressed && styles.btnPressed]}
                  onPress={() => {
                    onClose();
                    onSelectPackage?.({ id: '30-min', minutes: 30, price: 'Rs. 300' });
                  }}
                >
                  <Text style={[styles.extraGetBtnOutlineText, !isDesktop && styles.extraGetBtnTextMobile]}>
                    Get Now
                  </Text>
                </Pressable>
              </View>

              {/* Package 2: +120 Min (Most Popular) */}
              <View
                style={[
                  styles.extraPackageCard,
                  styles.extraPackageCardPopular,
                  !isDesktop && styles.extraPackageCardMobileCol,
                ]}
              >
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>Most Popular</Text>
                </View>
                <View style={[styles.extraPackageIconCircle, { backgroundColor: '#EDE9FE' }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke="#6366F1" strokeWidth="2" />
                    <Path d="M12 6V12L15 15" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
                  </Svg>
                </View>
                <Text style={[styles.extraPackageTitle, !isDesktop && styles.extraPackageTitleMobile]}>
                  +120 Min
                </Text>
                <Text style={[styles.extraPackageSubtitle, !isDesktop && styles.extraPackageSubtitleMobile]}>
                  Keep Going
                </Text>
                <Text style={[styles.extraPackagePrice, !isDesktop && styles.extraPackagePriceMobile]}>
                  Rs. 900
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.extraGetBtnSolid, pressed && styles.btnPressed]}
                  onPress={() => {
                    onClose();
                    onSelectPackage?.({ id: '120-min', minutes: 120, price: 'Rs. 900' });
                  }}
                >
                  <Text style={[styles.extraGetBtnSolidText, !isDesktop && styles.extraGetBtnTextMobile]}>
                    Get Now
                  </Text>
                </Pressable>
              </View>

              {/* Package 3: +300 Min */}
              <View style={[styles.extraPackageCard, !isDesktop && styles.extraPackageCardMobileCol]}>
                <View style={[styles.extraPackageIconCircle, { backgroundColor: '#FCE7F3' }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke="#DB2777" strokeWidth="2" />
                    <Path d="M12 6V12L15 15" stroke="#DB2777" strokeWidth="2" strokeLinecap="round" />
                  </Svg>
                </View>
                <Text style={[styles.extraPackageTitle, !isDesktop && styles.extraPackageTitleMobile]}>
                  +300 Min
                </Text>
                <Text style={[styles.extraPackageSubtitle, !isDesktop && styles.extraPackageSubtitleMobile]}>
                  Max Practice
                </Text>
                <Text style={[styles.extraPackagePrice, !isDesktop && styles.extraPackagePriceMobile]}>
                  Rs. 2,000
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.extraGetBtnOutline, pressed && styles.btnPressed]}
                  onPress={() => {
                    onClose();
                    onSelectPackage?.({ id: '300-min', minutes: 300, price: 'Rs. 2,000' });
                  }}
                >
                  <Text style={[styles.extraGetBtnOutlineText, !isDesktop && styles.extraGetBtnTextMobile]}>
                    Get Now
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Bottom Banner */}
            <View style={styles.extraBannerContainer}>
              <View style={styles.extraBannerLeft}>
                <View style={styles.extraBannerIconBox}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Rect x="3" y="11" width="18" height="11" rx="2" stroke="#0057FF" strokeWidth="2" />
                    <Path d="M7 11V7A5 5 0 0 1 17 7V11" stroke="#0057FF" strokeWidth="2" />
                  </Svg>
                </View>

                <View style={styles.extraBannerTextCol}>
                  <Text style={styles.extraBannerTitle}>Need more than this?</Text>
                  <Text style={styles.extraBannerSubtitle}>
                    Check out our Monthly Plans for better value and more benefits
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.extraBannerBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  onClose();
                  if (onFooterButtonPress) {
                    onFooterButtonPress();
                  } else {
                    router.push('/upgrade');
                  }
                }}
              >
                <Text style={styles.extraBannerBtnText}>View Plans →</Text>
              </Pressable>
            </View>
          </View>
        ) : (
        /* Modal Card */
        <View style={[styles.card, containerStyle]}>
          {/* Top Close Button (✕) */}
          {finalShowClose && (
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="#64748B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          )}

          {/* Header Graphic */}
          <View style={styles.graphicContainer}>
            {renderHeaderGraphic ? (
              renderHeaderGraphic()
            ) : resolvedPreset === 'level-up' ? (
              <LevelHexagonBadge level={levelNumber} />
            ) : finalImage ? (
              <View style={styles.imageWrapper}>
                {/* Soft blue glow aura behind Maya */}
                <View style={styles.imageGlowAura} />

                {/* Maya Illustration */}
                <Image
                  source={finalImage}
                  style={styles.headerImage}
                  resizeMode="contain"
                />

                {/* White gradient fade blend at bottom to dissolve into card surface */}
                {showImageFade && (
                  <View style={styles.imageBottomFade}>
                    <Svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <Defs>
                        <LinearGradient
                          id="whiteFadeBlend"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                          <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.12" />
                          <Stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.55" />
                          <Stop offset="80%" stopColor="#FFFFFF" stopOpacity="0.9" />
                          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
                        </LinearGradient>
                      </Defs>
                      <Rect
                        x="0"
                        y="0"
                        width="100"
                        height="100"
                        fill="url(#whiteFadeBlend)"
                      />
                    </Svg>
                  </View>
                )}
              </View>
            ) : null}
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>{renderTitle()}</View>

          {/* Subtitle */}
          {finalSubtitle ? (
            <Text style={styles.subtitleText}>{finalSubtitle}</Text>
          ) : null}

          {/* Practice Complete / Minutes Widget */}
          {resolvedPreset === 'practice-complete' && (
            <View style={styles.minutesCard}>
              <View style={styles.minutesRow}>
                <View style={styles.clockIconBox}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
                      stroke="#2563EB"
                      strokeWidth="2"
                    />
                    <Path
                      d="M12 7V12L15 15"
                      stroke="#2563EB"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
                <Text style={styles.minutesLabelText}>{minutesLabel}</Text>
                <Text style={styles.minutesStatsText}>
                  <Text style={styles.minutesBoldText}>{minutesUsed}</Text>
                  {' / '}
                  {minutesTotal}
                </Text>
              </View>

              {/* Progress Track */}
              <View style={styles.minutesProgressTrack}>
                <View
                  style={[
                    styles.minutesProgressFill,
                    { width: `${minutesPercent}%` },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Custom Slot / Children */}
          {children}

          {/* Optional hint text */}
          {resolvedPreset === 'practice-complete' && minutesHintText ? (
            <Text style={styles.hintText}>{minutesHintText}</Text>
          ) : null}

          {/* Primary Action Button */}
          {finalBtnText ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={onPrimaryPress || onClose}
              accessibilityRole="button"
              accessibilityLabel={finalBtnText}
            >
              <View style={styles.primaryButtonContent}>
                {renderPrimaryIcon()}
                <Text style={styles.primaryButtonText}>{finalBtnText}</Text>
                {finalShowArrow && (
                  <Svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    style={styles.btnTrailingArrow}
                  >
                    <Path
                      d="M5 12H19M19 12L12 5M19 12L12 19"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </View>
            </Pressable>
          ) : null}

          {/* Footer Text / Muted Note */}
          {finalFooterText ? (
            <Text style={styles.footerNoteText}>{finalFooterText}</Text>
          ) : null}

          {/* Footer Text Link / Button */}
          {finalFooterBtn ? (
            <Pressable
              onPress={onFooterButtonPress}
              style={styles.footerButton}
              accessibilityRole="button"
            >
              <Text style={styles.footerButtonLabel}>{finalFooterBtn}</Text>
            </Pressable>
          ) : null}
        </View>
        )}
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
    paddingHorizontal: 20,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        } as any)
      : {}),
  },
  backdropTouchArea: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: 410,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 26,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 12px 28px rgba(0, 0, 0, 0.16)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.16,
          shadowRadius: 28,
          elevation: 12,
        }),
    zIndex: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  closeButtonPressed: {
    backgroundColor: '#E2E8F0',
    transform: [{ scale: 0.94 }],
  },
  graphicContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 160,
    marginBottom: 6,
  },
  imageWrapper: {
    position: 'relative',
    width: 250,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageGlowAura: {
    position: 'absolute',
    bottom: 25,
    width: 170,
    height: 90,
    borderRadius: 85,
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    filter: Platform.OS === 'web' ? 'blur(22px)' : undefined,
  },
  headerImage: {
    width: 250,
    height: 190,
  },
  imageBottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    pointerEvents: 'none',
  },
  titleContainer: {
    marginTop: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  titleText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    lineHeight: 32,
    color: '#0C1B33',
    textAlign: 'center',
  },
  titleHighlightText: {
    ...fontStyle('outfit', 'bold'),
    color: '#2563EB',
  },
  subtitleText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    lineHeight: 21,
    color: '#0C1B33',
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  // Minutes widget
  minutesCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  minutesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  clockIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  minutesLabelText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  minutesStatsText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
  },
  minutesBoldText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
    color: '#2563EB',
  },
  minutesProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  minutesProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2563EB',
  },
  hintText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: -4,
  },
  // Primary Button
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 6px 16px rgba(37, 99, 235, 0.35)' } as any)
      : {
          shadowColor: '#2563EB',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 4,
        }),
  },
  primaryButtonPressed: {
    backgroundColor: '#1D4ED8',
    transform: [{ scale: 0.98 }],
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLeadingIcon: {
    marginRight: 8,
  },
  btnTrailingArrow: {
    marginLeft: 8,
  },
  primaryButtonText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  // Footer
  footerNoteText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 10,
  },
  footerButton: {
    marginTop: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  footerButtonLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#2563EB',
    textAlign: 'center',
  },

  backdropBottomSheet: {
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
    paddingBottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  /* Get Extra Talk Time Modal Styles */
  extraTimeModalCard: {
    width: '92%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'stretch',
  },
  extraTimeModalCardDesktop: {
    maxWidth: 680,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
  },
  extraTimeBottomSheet: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'stretch',
  },
  sheetHandleBar: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetCloseButton: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  extraCategoryText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11.5,
    color: '#0057FF',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  extraTitleText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0F172A',
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  extraTitleTextMobile: {
    fontSize: 20,
    marginBottom: 4,
  },
  extraHighlightText: {
    color: '#0057FF',
  },
  extraSubtitleText: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 18,
  },
  extraSubtitleTextMobile: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 16,
  },
  extraPackagesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'stretch',
  },
  extraPackagesContainerMobileRow: {
    gap: 8,
    marginBottom: 14,
  },
  extraPackageCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
  },
  extraPackageCardMobileCol: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  extraPackageCardPopular: {
    borderColor: '#0057FF',
    borderWidth: 2,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px 4px 16px rgba(0, 87, 255, 0.14)' } as any)
      : {
          shadowColor: '#0057FF',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 4,
        }),
  },
  popularBadge: {
    position: 'absolute',
    top: -11,
    backgroundColor: '#0057FF',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 7,
    alignSelf: 'center',
    zIndex: 2,
  },
  popularBadgeText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 9.5,
    color: '#FFFFFF',
  },
  extraPackageIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  extraPackageTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14.5,
    color: '#0F172A',
    marginBottom: 2,
    textAlign: 'center',
  },
  extraPackageTitleMobile: {
    fontSize: 13.5,
  },
  extraPackageSubtitle: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 10.5,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
  },
  extraPackageSubtitleMobile: {
    fontSize: 9.5,
    marginBottom: 6,
  },
  extraPackagePrice: {
    ...fontStyle('outfit', 'extraBold'),
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 10,
  },
  extraPackagePriceMobile: {
    fontSize: 14.5,
    marginBottom: 8,
  },
  extraGetBtnOutline: {
    width: '90%',
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0057FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraGetBtnOutlineText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12,
    color: '#0057FF',
  },
  extraGetBtnSolid: {
    width: '90%',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#0057FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraGetBtnSolidText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12,
    color: '#FFFFFF',
  },
  extraGetBtnTextMobile: {
    fontSize: 11,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  extraBannerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0EDFF',
    padding: 12,
    gap: 10,
  },
  extraBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  extraBannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraBannerTextCol: {
    flex: 1,
  },
  extraBannerTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12.5,
    color: '#0F172A',
  },
  extraBannerSubtitle: {
    ...fontStyle('outfit', 'regular'),
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  extraBannerBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0057FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraBannerBtnText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 11.5,
    color: '#0057FF',
  },
});
