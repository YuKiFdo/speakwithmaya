import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ImageSourcePropType,
  Platform,
  ViewStyle,
} from 'react-native';
import Svg, {
  Path,
  Polygon,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';

export type PopupPreset =
  | 'unlock-premium'
  | 'daily-limit'
  | 'practice-complete'
  | 'level-up'
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
  primaryButtonIcon?: 'crown' | 'play' | 'arrow' | 'none' | React.ReactNode;
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
    if (React.isValidElement(finalBtnIcon)) {
      return <View style={styles.btnLeadingIcon}>{finalBtnIcon}</View>;
    }
    return null;
  };

  // Calculate progress for minutes widget
  const minutesPercent = Math.min(100, Math.max(0, Math.round((minutesUsed / (minutesTotal || 1)) * 100)));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Click outside to close */}
        {closeOnBackdropPress && (
          <Pressable
            style={styles.backdropTouchArea}
            onPress={onClose}
            accessibilityLabel="Close popup"
            accessibilityRole="button"
          />
        )}

        {/* Modal Card */}
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
});
