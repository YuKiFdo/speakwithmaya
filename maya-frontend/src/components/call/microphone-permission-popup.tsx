import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CommonPopup } from '@/components/ui/common-popup';
import { fontStyle } from '@/theme/fonts';

export type MicPermissionErrorType = 'denied' | 'insecure' | 'unsupported' | 'error' | null;

export type PlatformEnv =
  | 'ios-chrome'
  | 'ios-safari'
  | 'ios-other'
  | 'android'
  | 'desktop';

export function detectPlatformEnvironment(): PlatformEnv {
  if (Platform.OS === 'ios') return 'ios-chrome';
  if (Platform.OS === 'android') return 'android';

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop';
  }

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);

  if (isIOS) {
    if (/CriOS/i.test(ua)) return 'ios-chrome';
    if (/FxiOS/i.test(ua)) return 'ios-other';
    return 'ios-safari';
  }

  if (/android/i.test(ua)) {
    return 'android';
  }

  return 'desktop';
}

export interface MicrophonePermissionPopupProps {
  visible: boolean;
  onClose: () => void;
  onAllow: () => void;
  errorType?: MicPermissionErrorType;
}

export function MicrophonePermissionPopup({
  visible,
  onClose,
  onAllow,
  errorType = null,
}: MicrophonePermissionPopupProps) {
  const isDenied = errorType === 'denied';
  const isInsecure = errorType === 'insecure';
  const isUnsupported = errorType === 'unsupported';
  const isError = isDenied || isInsecure || isUnsupported;

  const env = useMemo(() => detectPlatformEnvironment(), [visible]);

  // Dynamic image: request permission vs blocked/denied
  const popupImage = isError
    ? require('@/assets/images/maya-mic-blocked.png')
    : require('@/assets/images/maya-request-mic.png');

  // Determine Title, Subtitle, and Button Text
  let title = 'Enable Your Microphone';
  let titleHighlight = 'Microphone';
  let subtitle = 'Maya needs microphone access to listen and speak with you in real time.';
  let primaryBtnText = 'Allow Microphone';

  if (isInsecure) {
    title = 'Secure Connection Required';
    titleHighlight = 'Required';
    subtitle = 'Browsers strictly require a secure HTTPS connection to access the microphone.';
    primaryBtnText = 'Reload via HTTPS';
  } else if (isDenied) {
    title = 'Microphone Access is Blocked';
    titleHighlight = 'Blocked';
    subtitle = 'Your browser or device has blocked microphone access for this website.';
    primaryBtnText = 'Try Again';
  } else if (isUnsupported) {
    title = 'Microphone Not Supported';
    titleHighlight = 'Not Supported';
    subtitle = 'This browser environment does not support audio capture. Please try Safari or Chrome.';
    primaryBtnText = 'Try Again';
  }

  const handlePrimaryPress = () => {
    if (isInsecure) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const httpsUrl = window.location.href.replace('http://', 'https://');
        window.location.href = httpsUrl;
      } else {
        onAllow();
      }
    } else {
      onAllow();
    }
  };

  // Dynamically render troubleshooting steps using Ionicons vector icons
  const renderTroubleshootingSteps = () => {
    if (env === 'android') {
      return (
        <View style={styles.troubleshootCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="settings-outline" size={15} color="#2563EB" />
            <Text style={styles.cardHeader}>How to enable on Android:</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepText}>
                Tap the <Text style={styles.stepBold}>tune or lock icon</Text> on the left of the address bar:
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.iconPill}>
                  <Ionicons name="options-outline" size={13} color="#2563EB" />
                  <Text style={styles.iconPillText}>Tune</Text>
                </View>
                <View style={styles.iconPill}>
                  <Ionicons name="lock-closed-outline" size={13} color="#2563EB" />
                  <Text style={styles.iconPillText}>Lock</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              Select <Text style={styles.stepBold}>Permissions → Microphone → Allow</Text>.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              Or go to Android <Text style={styles.stepBold}>Settings → Apps → Chrome → Permissions → Allow</Text>.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>4</Text>
            </View>
            <Text style={styles.stepText}>
              Tap <Text style={styles.stepBold}>Try Again</Text> below to connect.
            </Text>
          </View>
        </View>
      );
    }

    if (env === 'ios-safari') {
      return (
        <View style={styles.troubleshootCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="settings-outline" size={15} color="#2563EB" />
            <Text style={styles.cardHeader}>How to enable on iPhone Safari:</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepText}>
                In the address bar, tap the page settings icon:
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.iconPill}>
                  <Ionicons name="text-outline" size={13} color="#2563EB" />
                  <Text style={styles.iconPillText}>Website Settings</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              Set <Text style={styles.stepBold}>Microphone</Text> to <Text style={styles.stepBold}>Allow</Text>.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              Or open iPhone <Text style={styles.stepBold}>Settings → Safari → Microphone → Allow</Text>.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>4</Text>
            </View>
            <Text style={styles.stepText}>
              Tap <Text style={styles.stepBold}>Try Again</Text> below to connect.
            </Text>
          </View>
        </View>
      );
    }

    if (env === 'ios-chrome') {
      return (
        <View style={styles.troubleshootCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="settings-outline" size={15} color="#2563EB" />
            <Text style={styles.cardHeader}>How to enable on iPhone Chrome:</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <Text style={styles.stepText}>
              Open iPhone <Text style={styles.stepBold}>Settings → Chrome</Text> and toggle <Text style={styles.stepBold}>Microphone ON</Text>.
            </Text>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <View style={styles.stepTextContainer}>
              <Text style={styles.stepText}>
                In Chrome, tap the more options menu:
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.iconPill}>
                  <Ionicons name="ellipsis-horizontal" size={14} color="#2563EB" />
                  <Text style={styles.iconPillText}>Settings → Site Settings → Microphone → Allow</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNumCircle}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              Tap <Text style={styles.stepBold}>Try Again</Text> below to connect.
            </Text>
          </View>
        </View>
      );
    }

    // Desktop or other browsers
    return (
      <View style={styles.troubleshootCard}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="settings-outline" size={15} color="#2563EB" />
          <Text style={styles.cardHeader}>How to enable on your browser:</Text>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepNumCircle}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <View style={styles.stepTextContainer}>
            <Text style={styles.stepText}>
              Click the site settings icon on the address bar:
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.iconPill}>
                <Ionicons name="options-outline" size={13} color="#2563EB" />
                <Text style={styles.iconPillText}>Tune</Text>
              </View>
              <View style={styles.iconPill}>
                <Ionicons name="lock-closed-outline" size={13} color="#2563EB" />
                <Text style={styles.iconPillText}>Permissions</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepNumCircle}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <Text style={styles.stepText}>
            Toggle <Text style={styles.stepBold}>Microphone</Text> to <Text style={styles.stepBold}>Allow</Text>.
          </Text>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepNumCircle}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <Text style={styles.stepText}>
            Tap <Text style={styles.stepBold}>Try Again</Text> below to connect.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <CommonPopup
      visible={visible}
      onClose={onClose}
      preset="custom"
      imageSource={popupImage}
      title={title}
      titleHighlight={titleHighlight}
      subtitle={subtitle}
      primaryButtonText={primaryBtnText}
      primaryButtonIcon="mic"
      onPrimaryPress={handlePrimaryPress}
      footerButtonText="Cancel & Go Back"
      onFooterButtonPress={onClose}
      showCloseButton={true}
      closeOnBackdropPress={false}
    >
      {/* Help / Troubleshooting card when permission is denied */}
      {isDenied && renderTroubleshootingSteps()}

      {isInsecure && (
        <View style={styles.troubleshootCard}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={[styles.cardHeader, { color: '#DC2626' }]}>HTTPS Required:</Text>
          </View>
          <Text style={styles.stepText}>
            Web browsers block microphone permissions on insecure <Text style={styles.stepBold}>http://</Text> links. Please access via a secure <Text style={styles.stepBold}>https://</Text> connection or localhost.
          </Text>
        </View>
      )}
    </CommonPopup>
  );
}

const styles = StyleSheet.create({
  troubleshootCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    marginBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardHeader: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#334155',
    letterSpacing: -0.2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  stepNumCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#2563EB',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepText: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  stepBold: {
    ...fontStyle('inter', 'semiBold'),
    color: '#0F172A',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
  },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  iconPillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#1D4ED8',
  },
});
