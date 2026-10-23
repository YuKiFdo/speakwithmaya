import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';

export interface AppConfigState {
  smsGateway: 'smsapi' | 'ideamart' | 'mspace';
  pricingNotice: string;
  termsDisclaimer: string;
  smsTemplate: string;
  ideamartPricingNotice: string;
  ideamartTermsDisclaimer: string;
  ideamartSmsTemplate: string;
  ideamartEnabled: boolean;
  mspaceEnabled: boolean;
  telcoUnsubButtonEnabled: boolean;
}

const DEFAULT_CONFIG: AppConfigState = {
  smsGateway: 'smsapi',
  pricingNotice: '',
  termsDisclaimer: '',
  smsTemplate: 'Your Maya AI English Coach verification code is: {CODE}. Valid for 5 minutes. Do not share this code.',
  ideamartPricingNotice: 'Dialog / Mobitel / Hutch: LKR 5 + tax /day. Airtime billing.',
  ideamartTermsDisclaimer: 'By subscribing, LKR 5 + taxes per day will be deducted from your Dialog, Mobitel, or Hutch mobile balance.',
  ideamartSmsTemplate: 'Maya AI: Your OTP is {CODE}. Valid for 5 min. Do not share this code.',
  ideamartEnabled: true,
  mspaceEnabled: true,
  telcoUnsubButtonEnabled: true,
};

export default function AdminSettingsScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [smsGateway, setSmsGateway] = useState<'smsapi' | 'ideamart' | 'mspace'>('smsapi');
  const [pricingNotice, setPricingNotice] = useState(DEFAULT_CONFIG.pricingNotice);
  const [termsDisclaimer, setTermsDisclaimer] = useState(DEFAULT_CONFIG.termsDisclaimer);
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_CONFIG.smsTemplate);
  const [ideamartPricingNotice, setIdeamartPricingNotice] = useState(DEFAULT_CONFIG.ideamartPricingNotice);
  const [ideamartTermsDisclaimer, setIdeamartTermsDisclaimer] = useState(DEFAULT_CONFIG.ideamartTermsDisclaimer);
  const [ideamartSmsTemplate, setIdeamartSmsTemplate] = useState(DEFAULT_CONFIG.ideamartSmsTemplate);

  // Telco Gateways Toggles
  const [ideamartEnabled, setIdeamartEnabled] = useState(true);
  const [mspaceEnabled, setMspaceEnabled] = useState(true);
  const [telcoUnsubButtonEnabled, setTelcoUnsubButtonEnabled] = useState(true);

  const getEffectiveTelcoPricingNotice = (ideaOn: boolean, mspaceOn: boolean, customVal?: string) => {
    if (customVal !== undefined && customVal !== '') return customVal;
    if (ideaOn && mspaceOn) return 'Dialog / Mobitel / Hutch: LKR 5 + tax /day. Airtime billing.';
    if (ideaOn) return 'Dialog / Hutch: LKR 5 + tax /day. Airtime billing.';
    if (mspaceOn) return 'Mobitel: LKR 5 + tax /day. Airtime billing.';
    return 'Telco carrier billing is currently disabled.';
  };

  const getEffectiveTelcoDisclaimer = (ideaOn: boolean, mspaceOn: boolean, customVal?: string) => {
    if (customVal !== undefined && customVal !== '') return customVal;
    if (ideaOn && mspaceOn) return 'By subscribing, LKR 5 + taxes per day will be deducted from your Dialog, Mobitel, or Hutch mobile balance.';
    if (ideaOn) return 'By subscribing, LKR 5 + taxes per day will be deducted from your Dialog or Hutch mobile balance.';
    if (mspaceOn) return 'By subscribing, LKR 5 + taxes per day will be deducted from your Mobitel mobile balance.';
    return '';
  };

  const handleToggleIdeamart = () => {
    const nextIdea = !ideamartEnabled;
    setIdeamartEnabled(nextIdea);
    setIdeamartPricingNotice((prev) => getEffectiveTelcoPricingNotice(nextIdea, mspaceEnabled));
    setIdeamartTermsDisclaimer((prev) => getEffectiveTelcoDisclaimer(nextIdea, mspaceEnabled));
  };

  const handleToggleMspace = () => {
    const nextMspace = !mspaceEnabled;
    setMspaceEnabled(nextMspace);
    setIdeamartPricingNotice((prev) => getEffectiveTelcoPricingNotice(ideamartEnabled, nextMspace));
    setIdeamartTermsDisclaimer((prev) => getEffectiveTelcoDisclaimer(ideamartEnabled, nextMspace));
  };

  const fetchConfig = async (isManualReload = false) => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      let res = await fetch(`${getBackendBaseUrl()}/v1/admin/app-config`);
      if (!res.ok) {
        res = await fetch(`${getBackendBaseUrl()}/v1/app-config`);
      }
      if (res.ok) {
        const data: AppConfigState = await res.json();
        setSmsGateway(data.smsGateway || 'smsapi');

        // Only override if not already customized or if it contains the legacy default with daily fees
        const isLegacyNormalPricing = data.pricingNotice && data.pricingNotice.includes('LKR 12');
        const isLegacyNormalDisclaimer = data.termsDisclaimer && data.termsDisclaimer.includes('LKR 12');

        setPricingNotice(isLegacyNormalPricing ? '' : (data.pricingNotice ?? ''));
        setTermsDisclaimer(isLegacyNormalDisclaimer ? '' : (data.termsDisclaimer ?? ''));
        setSmsTemplate(data.smsTemplate || DEFAULT_CONFIG.smsTemplate);

        const ideaOn = data.ideamartEnabled ?? true;
        const mspaceOn = data.mspaceEnabled ?? true;
        setIdeamartEnabled(ideaOn);
        setMspaceEnabled(mspaceOn);

        // Check if legacy telco text has STOP MAYA or helpline/sub fee
        const isLegacyTelcoDisclaimer = data.ideamartTermsDisclaimer && data.ideamartTermsDisclaimer.includes('STOP MAYA');
        const isLegacyTelcoSms = data.ideamartSmsTemplate && (data.ideamartSmsTemplate.includes('Sub fee') || data.ideamartSmsTemplate.includes('Helpline'));

        setIdeamartPricingNotice(data.ideamartPricingNotice || getEffectiveTelcoPricingNotice(ideaOn, mspaceOn));
        setIdeamartTermsDisclaimer(
          isLegacyTelcoDisclaimer
            ? getEffectiveTelcoDisclaimer(ideaOn, mspaceOn)
            : (data.ideamartTermsDisclaimer || getEffectiveTelcoDisclaimer(ideaOn, mspaceOn))
        );
        setIdeamartSmsTemplate(
          isLegacyTelcoSms
            ? DEFAULT_CONFIG.ideamartSmsTemplate
            : (data.ideamartSmsTemplate || DEFAULT_CONFIG.ideamartSmsTemplate)
        );

        setTelcoUnsubButtonEnabled(data.telcoUnsubButtonEnabled ?? true);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to load app config: ${err?.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMsg('');
      setSaveSuccess(false);

      const payload = {
        smsGateway,
        pricingNotice,
        termsDisclaimer,
        smsTemplate,
        ideamartPricingNotice,
        ideamartTermsDisclaimer,
        ideamartSmsTemplate,
        ideamartEnabled,
        mspaceEnabled,
        telcoUnsubButtonEnabled,
      };

      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/app-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'Failed to save configuration');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.mainLayout}>
        {/* Sidebar */}
        <AdminSidebar
          activeRoute="/admin/settings"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content Area */}
        <View style={styles.contentArea}>
          <AdminTopBar
            title="SMS & Gateway Configuration"
            subtitle="Switch between Normal SMS (Direct OTP) and Telco SMS (Carrier Billing). Configure IdeaMart and mSpace credentials and copy."
            badgeText={`Gateway: ${smsGateway === 'smsapi' ? 'Normal SMS (SMSAPI.LK)' : 'Telco SMS (Carrier Billing)'}`}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            rightElement={
              <Pressable
                onPress={() => fetchConfig(true)}
                style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
              >
                <Feather name="refresh-cw" size={14} color="#0d9488" />
                <Text style={styles.refreshBtnText}>Reload</Text>
              </Pressable>
            }
          />

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollBodyContent}>
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#0d9488" />
                <Text style={styles.loadingText}>Loading settings...</Text>
              </View>
            ) : (
              <View style={styles.formCard}>
                {/* Status Messages */}
                {!!errorMsg && (
                  <View style={styles.errorBanner}>
                    <Feather name="alert-circle" size={16} color="#dc2626" />
                    <Text style={styles.errorBannerText}>{errorMsg}</Text>
                  </View>
                )}

                {saveSuccess && (
                  <View style={styles.successBanner}>
                    <Feather name="check-circle" size={16} color="#16a34a" />
                    <Text style={styles.successBannerText}>
                      Settings saved successfully! Registration screen will now update in real time.
                    </Text>
                  </View>
                )}

                {/* Gateway Switcher Section */}
                <View style={styles.sectionHeader}>
                  <Feather name="radio" size={18} color="#0f766e" />
                  <Text style={styles.sectionTitle}>Active SMS Provider Gateway</Text>
                </View>
                <Text style={styles.sectionDesc}>
                  Select which provider dispatches verification codes and which copy appears on the mobile number screen.
                </Text>

                <View style={styles.gatewayOptionsGrid}>
                  {/* Option 1: Normal SMS (SMSAPI.LK) */}
                  <Pressable
                    onPress={() => setSmsGateway('smsapi')}
                    style={[
                      styles.gatewayCard,
                      smsGateway === 'smsapi' && styles.gatewayCardActive,
                    ]}
                  >
                    <View style={styles.gatewayRadioRow}>
                      <View
                        style={[
                          styles.radioCircle,
                          smsGateway === 'smsapi' && styles.radioCircleActive,
                        ]}
                      >
                        {smsGateway === 'smsapi' && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.gatewayName}>Normal SMS (SMSAPI.LK)</Text>
                        <Text style={styles.gatewaySub}>Standard OTP Verification</Text>
                      </View>
                      <View style={styles.badgeStandard}>
                        <Text style={styles.badgeStandardText}>Standard OTP</Text>
                      </View>
                    </View>
                    <Text style={styles.gatewayExplain}>
                      Sends instant 6-digit OTP codes through SMSAPI.LK (TRCSL approved route). Ideal for standard onboarding and card/online billing.
                    </Text>
                  </Pressable>

                  {/* Option 2: Telco SMS (Carrier Billing) */}
                  <Pressable
                    onPress={() => setSmsGateway('ideamart')}
                    style={[
                      styles.gatewayCard,
                      smsGateway !== 'smsapi' && styles.gatewayCardActive,
                    ]}
                  >
                    <View style={styles.gatewayRadioRow}>
                      <View
                        style={[
                          styles.radioCircle,
                          smsGateway !== 'smsapi' && styles.radioCircleActive,
                        ]}
                      >
                        {smsGateway !== 'smsapi' && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.gatewayName}>Telco SMS (Direct Carrier Billing)</Text>
                        <Text style={styles.gatewaySub}>Airtime Billing via IdeaMart & mSpace</Text>
                      </View>
                      <View style={styles.badgeIdeamart}>
                        <Text style={styles.badgeIdeamartText}>Telco Billing</Text>
                      </View>
                    </View>
                    <Text style={styles.gatewayExplain}>
                      Enables carrier billing via Dialog (IdeaMart) and Mobitel (mSpace) SDP gateways. Daily micro-charges deducted directly from subscriber airtime.
                    </Text>
                  </Pressable>
                </View>

                {/* Section Divider */}
                <View style={styles.divider} />

                {/* Active Gateway Customization Form */}
                {smsGateway === 'smsapi' ? (
                  <View style={styles.configFieldsGroup}>
                    <View style={styles.groupHeaderRow}>
                      <Feather name="edit-3" size={17} color="#0f766e" />
                      <Text style={styles.groupHeaderTitle}>Normal SMS Gateway Copy & Templates</Text>
                    </View>

                    {/* Field 1: Pricing Notice Under Number Header */}
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>Subtitle Notice (Optional - Below "Enter your mobile number"):</Text>
                      <Text style={styles.fieldHelp}>
                        Optional notice on the mobile screen. Leave blank if standard registration (no airtime cost).
                      </Text>
                      <TextInput
                        style={styles.fieldInputMulti}
                        multiline
                        numberOfLines={2}
                        value={pricingNotice}
                        onChangeText={setPricingNotice}
                        placeholder="Leave empty or customize notice"
                      />
                    </View>

                    {/* Field 2: Terms & Disclaimer Under Button */}
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>Terms & Disclaimer Text (Below "Send Verification Code"):</Text>
                      <Text style={styles.fieldHelp}>
                        Terms and privacy disclaimer shown at the bottom of the registration card.
                      </Text>
                      <TextInput
                        style={styles.fieldInputMultiTall}
                        multiline
                        numberOfLines={3}
                        value={termsDisclaimer}
                        onChangeText={setTermsDisclaimer}
                        placeholder="By continuing, you agree to our Terms of Service & Privacy Policy."
                      />
                    </View>

                    {/* Field 3: SMS Message Template */}
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>SMS Message Body Template:</Text>
                      <Text style={styles.fieldHelp}>
                        The exact SMS message sent to the user's phone. Use <Text style={{ ...fontStyle('inter', 'bold'), color: '#0d9488' }}>{'{CODE}'}</Text> where the 6-digit OTP should appear.
                      </Text>
                      <TextInput
                        style={styles.fieldInputMulti}
                        multiline
                        numberOfLines={2}
                        value={smsTemplate}
                        onChangeText={setSmsTemplate}
                        placeholder="Your Maya AI English Coach verification code is: {CODE}. Valid for 5 minutes. Do not share this code."
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.configFieldsGroup}>
                    {/* Section Header */}
                    <View style={styles.groupHeaderRow}>
                      <Feather name="smartphone" size={18} color="#2563eb" />
                      <Text style={[styles.groupHeaderTitle, { color: '#1e40af' }]}>Telco Gateways & Options</Text>
                    </View>
                    <Text style={styles.sectionDesc}>
                      Turn individual mobile network gateways on/off. Gateway API credentials and endpoints are securely configured on the server via environment variables (.env).
                    </Text>

                    {/* Provider 1: IdeaMart (Dialog & Hutch) */}
                    <View style={[styles.providerBox, ideamartEnabled && styles.providerBoxActive]}>
                      <View style={styles.providerHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.providerTitle}>IdeaMart (Dialog & Hutch)</Text>
                            <View style={[styles.statusPill, ideamartEnabled ? styles.statusPillOn : styles.statusPillOff]}>
                              <Text style={[styles.statusPillText, ideamartEnabled ? styles.statusPillTextOn : styles.statusPillTextOff]}>
                                {ideamartEnabled ? 'ENABLED' : 'DISABLED'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.providerSub}>
                            Covers Dialog (077, 076, 074) and Hutch (078, 072) mobile subscribers.
                          </Text>
                        </View>
                        <Pressable
                          onPress={handleToggleIdeamart}
                          style={[styles.switchTrack, ideamartEnabled && styles.switchTrackActive]}
                        >
                          <View style={[styles.switchThumb, ideamartEnabled && styles.switchThumbActive]} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Provider 2: mSpace (Mobitel) */}
                    <View style={[styles.providerBox, mspaceEnabled && styles.providerBoxActive]}>
                      <View style={styles.providerHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.providerTitle}>mSpace (Mobitel)</Text>
                            <View style={[styles.statusPill, mspaceEnabled ? styles.statusPillOn : styles.statusPillOff]}>
                              <Text style={[styles.statusPillText, mspaceEnabled ? styles.statusPillTextOn : styles.statusPillTextOff]}>
                                {mspaceEnabled ? 'ENABLED' : 'DISABLED'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.providerSub}>
                            Covers Mobitel (070, 071) mobile subscribers.
                          </Text>
                        </View>
                        <Pressable
                          onPress={handleToggleMspace}
                          style={[styles.switchTrack, mspaceEnabled && styles.switchTrackActive]}
                        >
                          <View style={[styles.switchThumb, mspaceEnabled && styles.switchThumbActive]} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Option 3: Telco In-App Unsubscribe Button Toggle */}
                    <View style={styles.providerBox}>
                      <View style={styles.providerHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.providerTitle}>In-App Unsubscribe Option</Text>
                            <View style={[styles.statusPill, telcoUnsubButtonEnabled ? styles.statusPillOn : styles.statusPillOff]}>
                              <Text style={[styles.statusPillText, telcoUnsubButtonEnabled ? styles.statusPillTextOn : styles.statusPillTextOff]}>
                                {telcoUnsubButtonEnabled ? 'VISIBLE' : 'HIDDEN'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.providerSub}>
                            Allows subscribed users to unsubscribe from their mobile airtime plan directly inside the app.
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => setTelcoUnsubButtonEnabled(!telcoUnsubButtonEnabled)}
                          style={[styles.switchTrack, telcoUnsubButtonEnabled && styles.switchTrackActive]}
                        >
                          <View style={[styles.switchThumb, telcoUnsubButtonEnabled && styles.switchThumbActive]} />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Telco Pricing Notice */}
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>Telco Pricing Notice (Below Mobile Number):</Text>
                      <Text style={styles.fieldHelp}>
                        Displayed on the mobile number screen when Telco Carrier Billing is active.
                      </Text>
                      <TextInput
                        style={styles.fieldInputMulti}
                        multiline
                        numberOfLines={2}
                        value={ideamartPricingNotice}
                        onChangeText={setIdeamartPricingNotice}
                        placeholder="Dialog / Mobitel / Hutch: LKR 5 + tax /day. Airtime billing."
                      />
                    </View>

                    {/* Telco Terms & Disclaimer */}
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>Telco Terms & Disclaimer (Below Button):</Text>
                      <Text style={styles.fieldHelp}>
                        Carrier terms disclosure regarding airtime deductions for the Starter Plan.
                      </Text>
                      <TextInput
                        style={styles.fieldInputMultiTall}
                        multiline
                        numberOfLines={3}
                        value={ideamartTermsDisclaimer}
                        onChangeText={setIdeamartTermsDisclaimer}
                        placeholder="By subscribing, LKR 5 + taxes per day will be deducted from your Dialog, Mobitel, or Hutch mobile balance."
                      />
                    </View>

                    {/* Telco SMS Message Template */}
                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>Telco SMS Message Body Template:</Text>
                      <Text style={styles.fieldHelp}>
                        SMS content dispatched via Telco gateways. Must contain the <Text style={{ ...fontStyle('inter', 'bold'), color: '#2563eb' }}>{'{CODE}'}</Text> placeholder.
                      </Text>
                      <TextInput
                        style={styles.fieldInputMulti}
                        multiline
                        numberOfLines={2}
                        value={ideamartSmsTemplate}
                        onChangeText={setIdeamartSmsTemplate}
                        placeholder="Maya AI: Your OTP is {CODE}. Valid for 5 min. Do not share this code."
                      />
                    </View>
                  </View>
                )}

                {/* Save Button Row */}
                <View style={styles.actionsBar}>
                  <Pressable
                    onPress={handleSave}
                    disabled={isSaving}
                    style={({ pressed }) => [
                      styles.saveButton,
                      isSaving && { opacity: 0.7 },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Feather name="save" size={16} color="#ffffff" />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollBody: {
    flex: 1,
  },
  scrollBodyContent: {
    padding: 24,
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 8,
  },
  refreshBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#0d9488',
  },
  loadingBox: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748b',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
      } as any,
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
  },
  errorBannerText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#dc2626',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
  },
  successBannerText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13.5,
    color: '#16a34a',
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0F172A',
  },
  sectionDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginTop: -10,
  },
  gatewayOptionsGrid: {
    gap: 14,
  },
  gatewayCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  gatewayCardActive: {
    borderColor: '#0d9488',
    backgroundColor: '#F0FDFA',
  },
  gatewayRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#0d9488',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0d9488',
  },
  gatewayName: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
  },
  gatewaySub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748b',
  },
  gatewayExplain: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginLeft: 32,
  },
  badgeStandard: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#E0F2FE',
    borderRadius: 6,
  },
  badgeStandardText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#0369A1',
  },
  badgeIdeamart: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  badgeIdeamartText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#1D4ED8',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  configFieldsGroup: {
    gap: 18,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  groupHeaderTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
  },
  fieldItem: {
    gap: 6,
  },
  fieldLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 14,
    color: '#1E293B',
  },
  fieldHelp: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#64748B',
  },
  fieldInputMulti: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#0F172A',
    minHeight: 64,
    textAlignVertical: 'top',
  },
  fieldInputMultiTall: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#0F172A',
    minHeight: 96,
    textAlignVertical: 'top',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0d9488',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveButtonText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 14,
    color: '#FFFFFF',
  },
  providerBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 16,
  },
  providerBoxActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#F8FAFC',
  },
  providerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  providerTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0F172A',
  },
  providerSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillOn: {
    backgroundColor: '#DCFCE7',
  },
  statusPillOff: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    letterSpacing: 0.5,
  },
  statusPillTextOn: {
    color: '#16A34A',
  },
  statusPillTextOff: {
    color: '#94A3B8',
  },
  switchTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#CBD5E1',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#0d9488',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
});
