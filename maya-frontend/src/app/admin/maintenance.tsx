import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminAuthStore } from '@/services/store/admin-auth-store';
import { mayaAlert } from '@/components/ui/alert-modal';
import { SmsCampaignReport } from '@/components/admin/SmsCampaignReport';
import { renderSmsTemplate, smsSegments as countSmsSegments } from '@/utils/sms-template';

type MainSectionTab = 'maintenance' | 'sms';
type SmsAudience = 'all' | 'paid' | 'nonpaid' | 'specific';

interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  estimatedEndTime?: string;
}

interface RegisteredUserItem {
  id: string;
  displayName: string;
  phoneNumber: string;
  email?: string | null;
  planTier: string;
  planStatus: string;
  avatarUrl?: string | null;
}

const DEFAULT_MAINTENANCE: MaintenanceConfig = {
  enabled: false,
  title: 'Maya is Tuning Up!',
  message:
    'We are currently conducting scheduled improvements to ensure your English speaking coach is smoother, faster, and always reliable. We will be back online shortly!',
  estimatedEndTime: '15 minutes',
};

const SMS_PRESETS = [
  {
    id: 'back_online',
    label: "🟢 We're Back Online",
    text: "We're back online! Your Maya AI English speaking coach is ready. Jump in now at https://app.speakwithmaya.com",
  },
  {
    id: 'maintenance_notice',
    label: '🛠️ Scheduled Maintenance',
    text: 'Maya AI Notice: We are conducting quick system maintenance. Practice sessions will resume shortly at https://app.speakwithmaya.com',
  },
  {
    id: 'pro_pass_offer',
    label: '🎁 Pro Pass Gift',
    text: 'Special Gift: We have unlocked a free 3-Day Pro Pass with 120 minutes of speaking on SpeakWithMaya! Log in now: https://app.speakwithmaya.com',
  },
  {
    id: 'daily_reminder',
    label: '⚡ Daily Speaking Goal',
    text: 'Your daily English speaking goal is waiting! Spend just 5 minutes practicing with Maya today: https://app.speakwithmaya.com',
  },
];

export default function AdminMaintenanceScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);
  const [activeTab, setActiveTab] = useState<MainSectionTab>('maintenance');

  // Maintenance State
  const [loadingMaintenance, setLoadingMaintenance] = useState(true);
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceConfig>(DEFAULT_MAINTENANCE);

  // SMS Broadcast State
  const [audience, setAudience] = useState<SmsAudience>('all');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loadingAudienceCount, setLoadingAudienceCount] = useState(false);
  const [specificNumbersText, setSpecificNumbersText] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  // Tracked link + template variables ({{name}}, {{first_name}}, {{link}})
  const [smsLink, setSmsLink] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [previewName, setPreviewName] = useState('Nimal Perera');
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const smsSelectionRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [testNumber, setTestNumber] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [lastBroadcastResult, setLastBroadcastResult] = useState<{
    totalTargeted: number;
    totalSent: number;
    totalFailed: number;
    date: string;
  } | null>(null);

  // Registered Users Search & Multi-Select for Specific Audience
  const [availableUsers, setAvailableUsers] = useState<RegisteredUserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<RegisteredUserItem[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Keep sidebar in sync with screen size
  useEffect(() => {
    setSidebarOpen(!isPhone);
  }, [isPhone]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'x-admin-token': AdminAuthStore.getToken() || '',
  });

  // Helper to extract unique numbers from both selected users and manual text
  const getSpecificRecipientNumbers = useCallback((): string[] => {
    const numberSet = new Set<string>();

    // 1. From selected users
    selectedUsers.forEach((u) => {
      const clean = u.phoneNumber.replace(/\D/g, '');
      if (clean.length >= 9) {
        numberSet.add(clean);
      }
    });

    // 2. From manual text input
    if (specificNumbersText.trim()) {
      const parsed = specificNumbersText
        .split(/[\n,;]+/)
        .map((n) => n.trim().replace(/\D/g, ''))
        .filter((n) => n.length >= 9);

      parsed.forEach((n) => numberSet.add(n));
    }

    return Array.from(numberSet);
  }, [selectedUsers, specificNumbersText]);

  // Fetch Current Maintenance Status
  const fetchMaintenanceConfig = useCallback(async () => {
    try {
      setLoadingMaintenance(true);
      const res = await fetch(`${getBackendBaseUrl()}/v1/app-config`);
      if (res.ok) {
        const data = await res.json();
        if (data?.maintenanceMode) {
          setMaintenance({
            enabled: Boolean(data.maintenanceMode.enabled),
            title: data.maintenanceMode.title || DEFAULT_MAINTENANCE.title,
            message: data.maintenanceMode.message || DEFAULT_MAINTENANCE.message,
            estimatedEndTime: data.maintenanceMode.estimatedEndTime || '',
          });
        }
      }
    } catch (e: any) {
      console.warn('Failed to load maintenance config:', e.message);
    } finally {
      setLoadingMaintenance(false);
    }
  }, []);

  // Fetch registered users for the multi-select dropdown
  const fetchRegisteredUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/users?limit=1000`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const usersList: RegisteredUserItem[] = (data.users || [])
          .filter((u: any) => u.phoneNumber && u.phoneNumber.trim().length >= 7)
          .map((u: any) => ({
            id: u.id,
            displayName: u.displayName || 'Unnamed Student',
            phoneNumber: u.phoneNumber,
            email: u.email || null,
            planTier: (u.planTier || 'starter').toLowerCase(),
            planStatus: (u.planStatus || 'active').toLowerCase(),
            avatarUrl: u.avatarUrl || null,
          }));
        setAvailableUsers(usersList);
      }
    } catch (e: any) {
      console.warn('Failed to load registered users:', e.message);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Fetch Audience Count for SMS
  const fetchAudienceCount = useCallback(async (targetAudience: SmsAudience) => {
    if (targetAudience === 'specific') {
      const parsed = getSpecificRecipientNumbers();
      setAudienceCount(parsed.length);
      return;
    }

    try {
      setLoadingAudienceCount(true);
      const res = await fetch(
        `${getBackendBaseUrl()}/v1/admin/sms-audience-count?audience=${targetAudience}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setAudienceCount(typeof data.count === 'number' ? data.count : 0);
      }
    } catch {
      setAudienceCount(null);
    } finally {
      setLoadingAudienceCount(false);
    }
  }, [getSpecificRecipientNumbers]);

  useEffect(() => {
    fetchMaintenanceConfig();
  }, [fetchMaintenanceConfig]);

  useEffect(() => {
    if (activeTab === 'sms') {
      fetchAudienceCount(audience);
      if (availableUsers.length === 0) {
        fetchRegisteredUsers();
      }
    }
  }, [activeTab, audience, fetchAudienceCount, fetchRegisteredUsers, availableUsers.length]);

  // Keep specific audience count in sync when selected users or manual text change
  useEffect(() => {
    if (audience === 'specific') {
      setAudienceCount(getSpecificRecipientNumbers().length);
    }
  }, [audience, selectedUsers, specificNumbersText, getSpecificRecipientNumbers]);

  // Handle User Toggle in Dropdown
  const handleToggleUserSelection = (user: RegisteredUserItem) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      if (exists) {
        return prev.filter((u) => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  // Filter registered users based on search text
  const filteredUsers = availableUsers.filter((u) => {
    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.trim().toLowerCase();
    const cleanPhoneDigits = u.phoneNumber.replace(/\D/g, '');
    const cleanQueryDigits = q.replace(/\D/g, '');

    const nameMatch = u.displayName.toLowerCase().includes(q);
    const emailMatch = u.email ? u.email.toLowerCase().includes(q) : false;
    const phoneMatch =
      u.phoneNumber.toLowerCase().includes(q) ||
      (cleanQueryDigits.length > 0 && cleanPhoneDigits.includes(cleanQueryDigits));

    return nameMatch || emailMatch || phoneMatch;
  });

  const areAllFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedUsers.some((sel) => sel.id === u.id));

  const handleSelectAllFiltered = () => {
    if (areAllFilteredSelected) {
      const matchingIds = new Set(filteredUsers.map((u) => u.id));
      setSelectedUsers((prev) => prev.filter((u) => !matchingIds.has(u.id)));
    } else {
      const existingIds = new Set(selectedUsers.map((u) => u.id));
      const toAdd = filteredUsers.filter((u) => !existingIds.has(u.id));
      setSelectedUsers((prev) => [...prev, ...toAdd]);
    }
  };

  // Toggle Maintenance Mode (On/Off)
  const handleToggleMaintenance = async () => {
    const nextState = !maintenance.enabled;
    const confirmed = await mayaAlert.confirm({
      title: nextState ? 'Enable Maintenance Mode?' : 'Bring App Live Online?',
      message: nextState
        ? 'Enabling maintenance mode will display the maintenance overlay to ALL regular students worldwide. Practice calls will be locked until you bring the app back online.'
        : 'Bringing the app online will instantly remove the maintenance banner for all students and allow normal speaking practice.',
      confirmText: nextState ? 'Enable Maintenance' : 'Bring App Live',
      cancelText: 'Cancel',
      type: nextState ? 'warning' : 'info',
      isDestructive: nextState,
    });
    if (!confirmed) return;

    try {
      setIsTogglingMaintenance(true);
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/app-config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          maintenanceMode: {
            ...maintenance,
            enabled: nextState,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to update maintenance mode status');
      setMaintenance((prev) => ({ ...prev, enabled: nextState }));
      await mayaAlert.success(
        nextState
          ? '🛠️ Application is now under Maintenance Mode. Students will see the Maya maintenance screen.'
          : '🟢 Application is now LIVE and accessible to all students worldwide.',
        nextState ? 'Maintenance Mode Enabled' : 'App is Live!'
      );
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Could not update maintenance status', 'Error');
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  // Save Maintenance Copy & Settings
  const handleSaveMaintenanceNotice = async () => {
    if (!maintenance.title.trim() || !maintenance.message.trim()) {
      await mayaAlert.error('Notice headline and message cannot be empty.', 'Missing Information');
      return;
    }

    try {
      setIsSavingMaintenance(true);
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/app-config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          maintenanceMode: maintenance,
        }),
      });

      if (!res.ok) throw new Error('Failed to save maintenance notice');
      await mayaAlert.success('Maintenance screen notice updated successfully!', 'Notice Saved');
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Could not save notice', 'Save Error');
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  // Send Single Test SMS
  const handleSendTestSms = async () => {
    if (!testNumber.trim()) {
      await mayaAlert.error('Please enter a recipient mobile number for the test SMS.', 'Missing Number');
      return;
    }
    if (!smsMessage.trim()) {
      await mayaAlert.error('Please enter SMS message text before sending.', 'Empty Message');
      return;
    }

    try {
      setIsSendingTest(true);
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/broadcast-sms`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          audience: 'specific',
          phoneNumbers: [testNumber.trim()],
          message: smsMessage.trim(),
          ...(smsLink.trim() ? { linkUrl: smsLink.trim(), campaignName: `${campaignName.trim() || 'Test'} (test)` } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch test SMS');
      }

      if (data.jobId) {
        // Poll for completion (test SMS has 1 recipient, finishes quickly)
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const pollRes = await fetch(`${getBackendBaseUrl()}/v1/admin/broadcast-sms/${data.jobId}`, {
            headers: getAuthHeaders(),
          });
          if (pollRes.ok) {
            const jobStatus = await pollRes.json();
            if (jobStatus.status === 'completed') {
              if (jobStatus.totalFailed > 0) {
                throw new Error('SMS Gateway rejected or failed to deliver the test SMS.');
              }
              break;
            } else if (jobStatus.status === 'failed') {
              throw new Error(jobStatus.message || 'Failed to send test SMS');
            }
          }
        }
      }

      await mayaAlert.success(
        `Test SMS sent successfully to ${testNumber.trim()}! Please check your handset.`,
        'Test SMS Delivered'
      );
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Failed to send test SMS', 'Delivery Error');
    } finally {
      setIsSendingTest(false);
    }
  };

  // Execute Broadcast SMS
  const handleBroadcastSms = async () => {
    if (!smsMessage.trim()) {
      await mayaAlert.error('Please enter SMS message text before broadcasting.', 'Empty Message');
      return;
    }

    let targetNumbers: string[] | undefined = undefined;
    if (audience === 'specific') {
      const parsed = getSpecificRecipientNumbers();

      if (parsed.length === 0) {
        await mayaAlert.error(
          'Please select at least one registered student or enter a valid mobile number.',
          'No Recipients Selected'
        );
        return;
      }
      targetNumbers = parsed;
    }

    const targetCount = audience === 'specific' ? (targetNumbers?.length || 0) : (audienceCount || 0);
    const audienceLabel =
      audience === 'all'
        ? 'All Registered Students'
        : audience === 'paid'
        ? 'Paid Subscribers Only'
        : audience === 'nonpaid'
        ? 'Free / Starter Students'
        : `${targetCount} Specific Recipient(s) (${selectedUsers.length} selected student(s)${
            specificNumbersText.trim() ? ' + manual numbers' : ''
          })`;

    const confirmed = await mayaAlert.confirm({
      title: 'Confirm SMS Broadcast',
      message: `Are you sure you want to dispatch this SMS to ${audienceLabel}?\n\nTarget Recipients: ${targetCount} user(s)\n\nSMS Message:\n"${smsMessage.trim()}"`,
      confirmText: 'Dispatch SMS Now',
      cancelText: 'Cancel',
      type: 'warning',
    });
    if (!confirmed) return;

    try {
      setIsBroadcasting(true);
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/broadcast-sms`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          audience,
          phoneNumbers: targetNumbers,
          message: smsMessage.trim(),
          ...(smsLink.trim() ? { linkUrl: smsLink.trim(), campaignName: campaignName.trim() || undefined } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Broadcast request failed');
      }

      if (data.jobId) {
        // Poll background job for live progress
        let isDone = false;
        const startTime = Date.now();
        while (!isDone && Date.now() - startTime < 15 * 60 * 1000) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          try {
            const pollRes = await fetch(`${getBackendBaseUrl()}/v1/admin/broadcast-sms/${data.jobId}`, {
              headers: getAuthHeaders(),
            });
            if (pollRes.ok) {
              const jobStatus = await pollRes.json();
              setLastBroadcastResult({
                totalTargeted: jobStatus.totalTargeted || data.totalTargeted || 0,
                totalSent: jobStatus.totalSent || 0,
                totalFailed: jobStatus.totalFailed || 0,
                date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              });

              if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
                isDone = true;
                setReportRefreshKey((k) => k + 1); // show the new campaign in the click report
                if (jobStatus.status === 'completed') {
                  await mayaAlert.success(
                    `Broadcast completed!\n\n• Successfully Sent: ${jobStatus.totalSent}\n• Failed: ${jobStatus.totalFailed}\n• Total Targeted: ${jobStatus.totalTargeted}`,
                    'Broadcast Complete'
                  );
                } else {
                  await mayaAlert.error(jobStatus.message || 'Broadcast job failed', 'Broadcast Failed');
                }
                break;
              }
            }
          } catch (pollErr: any) {
            console.warn('[Broadcast Poll Warning]', pollErr);
          }
        }
      } else {
        setLastBroadcastResult({
          totalTargeted: data.totalTargeted || 0,
          totalSent: data.totalSent || 0,
          totalFailed: data.totalFailed || 0,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        await mayaAlert.success(
          `Broadcast completed!\n\n• Successfully Sent: ${data.totalSent || 0}\n• Failed: ${data.totalFailed || 0}\n• Total Targeted: ${data.totalTargeted || 0}`,
          'Broadcast Complete'
        );
      }
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Broadcast could not be completed', 'Broadcast Failed');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // SMS character calculation
  // Preview exactly what one recipient receives (same renderer as the backend). The sample
  // link has the real length (8-char token), so the SMS part count is accurate.
  const sampleLink = (() => {
    const raw = smsLink.trim();
    if (!raw) return null;
    try {
      const u = new URL(raw);
      u.searchParams.set('r', 'Ab3xK9mQ');
      return u.toString();
    } catch {
      return raw;
    }
  })();
  const smsPreview = renderSmsTemplate(smsMessage, { name: previewName, link: sampleLink });
  const smsCount = countSmsSegments(smsPreview);
  const charCount = smsCount.chars;
  const smsSegments = smsCount.segments;
  const smsLinkInvalid = Boolean(smsLink.trim()) && !/^https:\/\/(app\.|www\.)?speakwithmaya\.com(\/|$)/i.test(smsLink.trim());

  const insertSmsVariable = (token: string) => {
    const { start, end } = smsSelectionRef.current;
    const before = smsMessage.slice(0, start);
    const after = smsMessage.slice(end);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    const next = `${before}${pad}${token}${after}`;
    setSmsMessage(next);
    const caret = (before + pad + token).length;
    smsSelectionRef.current = { start: caret, end: caret };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layoutRoot}>
        {/* Modular Admin Sidebar */}
        <AdminSidebar
          activeRoute="/admin/maintenance"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <View style={styles.mainContainer}>
          <AdminTopBar
            title="App Maintenance & SMS Broadcasts"
            subtitle="Manage scheduled downtime notices and dispatch targeted SMS announcements to users."
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            rightElement={
              <Pressable
                onPress={() => {
                  fetchMaintenanceConfig();
                  if (activeTab === 'sms') fetchAudienceCount(audience);
                }}
                style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Refresh Data"
              >
                <Feather name="refresh-cw" size={15} color="#0d9488" />
              </Pressable>
            }
          />

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Navigation Tabs */}
            <View style={styles.tabsContainer}>
              <Pressable
                onPress={() => setActiveTab('maintenance')}
                style={[styles.tabButton, activeTab === 'maintenance' && styles.tabButtonActive]}
              >
                <Feather
                  name="tool"
                  size={16}
                  color={activeTab === 'maintenance' ? '#0d9488' : '#64748B'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'maintenance' && styles.tabButtonTextActive,
                  ]}
                >
                  App Maintenance Mode
                </Text>
                {maintenance.enabled && (
                  <View style={styles.tabBadgeAmber}>
                    <Text style={styles.tabBadgeAmberText}>ACTIVE</Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('sms')}
                style={[styles.tabButton, activeTab === 'sms' && styles.tabButtonActive]}
              >
                <Feather
                  name="send"
                  size={16}
                  color={activeTab === 'sms' ? '#0d9488' : '#64748B'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'sms' && styles.tabButtonTextActive,
                  ]}
                >
                  Send SMS Broadcast
                </Text>
              </Pressable>
            </View>

            {/* TAB 1: APP MAINTENANCE MODE */}
            {activeTab === 'maintenance' && (
              <View style={styles.tabContentWrap}>
                {/* 1. Live Status Hero Card */}
                <View
                  style={[
                    styles.heroStatusCard,
                    maintenance.enabled ? styles.heroStatusCardMaintenance : styles.heroStatusCardLive,
                  ]}
                >
                  <View style={styles.heroStatusLeft}>
                    <View
                      style={[
                        styles.heroStatusIconCircle,
                        maintenance.enabled
                          ? { backgroundColor: '#FEF3C7' }
                          : { backgroundColor: '#DCFCE7' },
                      ]}
                    >
                      <Text style={{ fontSize: 26 }}>{maintenance.enabled ? '🛠️' : '🟢'}</Text>
                    </View>
                    <View style={styles.heroStatusTextCol}>
                      <View style={styles.heroStatusBadgeRow}>
                        <View
                          style={[
                            styles.statusPill,
                            maintenance.enabled ? styles.statusPillAmber : styles.statusPillGreen,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              maintenance.enabled
                                ? { color: '#B45309' }
                                : { color: '#15803D' },
                            ]}
                          >
                            {maintenance.enabled ? 'MAINTENANCE MODE ACTIVE' : 'LIVE ONLINE & OPERATIONAL'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.heroStatusTitle}>
                        {maintenance.enabled
                          ? 'App is currently restricted for all regular students'
                          : 'All students can access Maya and practice speaking freely'}
                      </Text>
                      <Text style={styles.heroStatusDesc}>
                        {maintenance.enabled
                          ? 'Non-admin visitors are currently greeted with the Maya maintenance overlay. Only admins can browse the platform.'
                          : 'No maintenance locks are active. Student practice calls and billing renewals are operating normally.'}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.toggleMaintenanceBtn,
                      maintenance.enabled
                        ? styles.toggleMaintenanceBtnLive
                        : styles.toggleMaintenanceBtnMaintenance,
                      pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                      isTogglingMaintenance && { opacity: 0.6 },
                    ]}
                    onPress={handleToggleMaintenance}
                    disabled={isTogglingMaintenance}
                  >
                    {isTogglingMaintenance ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather
                          name={maintenance.enabled ? 'check-circle' : 'alert-triangle'}
                          size={16}
                          color="#FFFFFF"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.toggleMaintenanceBtnText}>
                          {maintenance.enabled ? 'Bring App Live Online' : 'Put App into Maintenance'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {/* 2. Notice Customization & Live Mockup Grid */}
                <View style={[styles.gridRow, isPhone && styles.gridRowPhone]}>
                  {/* Form Left Col */}
                  <View style={[styles.card, { flex: 1.2 }]}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardHeaderIcon}>
                        <Feather name="edit-3" size={16} color="#0d9488" />
                      </View>
                      <View>
                        <Text style={styles.cardTitle}>Student Maintenance Notice</Text>
                        <Text style={styles.cardSubtitle}>
                          Customize the message displayed on the student maintenance screen.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>Headline Title:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={maintenance.title}
                        onChangeText={(t) => setMaintenance((prev) => ({ ...prev, title: t }))}
                        placeholder="e.g. Maya is Tuning Up!"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>Notice Message:</Text>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        value={maintenance.message}
                        onChangeText={(m) => setMaintenance((prev) => ({ ...prev, message: m }))}
                        multiline
                        numberOfLines={4}
                        placeholder="Explain the scheduled maintenance to students..."
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.fieldItem}>
                      <Text style={styles.fieldLabel}>Estimated Completion (Optional):</Text>
                      <TextInput
                        style={styles.textInput}
                        value={maintenance.estimatedEndTime || ''}
                        onChangeText={(e) => setMaintenance((prev) => ({ ...prev, estimatedEndTime: e }))}
                        placeholder="e.g. 15 minutes, or 3:00 PM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View style={styles.cardActionsRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.saveBtn,
                          pressed && { opacity: 0.88 },
                          isSavingMaintenance && { opacity: 0.6 },
                        ]}
                        onPress={handleSaveMaintenanceNotice}
                        disabled={isSavingMaintenance}
                      >
                        {isSavingMaintenance ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="save" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.saveBtnText}>Save Notice Changes</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>

                  {/* Student Screen Preview Mockup Right Col */}
                  <View style={[styles.card, { flex: 0.95 }]}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardHeaderIcon}>
                        <Feather name="smartphone" size={16} color="#6366F1" />
                      </View>
                      <View>
                        <Text style={styles.cardTitle}>Live Student Preview</Text>
                        <Text style={styles.cardSubtitle}>
                          Real-time rendering of what users see when accessing the app.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.previewPhoneFrame}>
                      <View style={styles.previewBadge}>
                        <Text style={styles.previewBadgeText}>🛠️ SCHEDULED MAINTENANCE</Text>
                      </View>

                      <Image
                        source={require('@/assets/images/maya-maintenance.png')}
                        style={styles.previewAvatar}
                        resizeMode="contain"
                      />

                      <Text style={styles.previewTitle}>
                        {maintenance.title || 'Maya is Tuning Up!'}
                      </Text>

                      <Text style={styles.previewMessage}>
                        {maintenance.message ||
                          'We are currently conducting scheduled improvements to ensure your English speaking coach is smoother, faster, and always reliable.'}
                      </Text>

                      {maintenance.estimatedEndTime ? (
                        <View style={styles.previewEstimateBox}>
                          <Text style={styles.previewEstimateLabel}>Estimated Completion:</Text>
                          <Text style={styles.previewEstimateValue}>
                            {maintenance.estimatedEndTime}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.previewCheckBtn}>
                        <Text style={styles.previewCheckBtnText}>Check Again / Refresh</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* TAB 2: SEND SMS BROADCAST */}
            {activeTab === 'sms' && (
              <View style={styles.tabContentWrap}>
                {/* Audience Selection Card */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderIcon}>
                      <Feather name="users" size={16} color="#0d9488" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>1. Select Target Audience</Text>
                      <Text style={styles.cardSubtitle}>
                        Choose who receives your broadcast announcement or marketing SMS.
                      </Text>
                    </View>

                    {/* Live Counter Pill */}
                    <View style={styles.audienceCounterPill}>
                      {loadingAudienceCount ? (
                        <ActivityIndicator size="small" color="#0d9488" />
                      ) : (
                        <Text style={styles.audienceCounterPillText}>
                          👥 Target: {audienceCount !== null ? audienceCount : '—'} users
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.audienceSelectorGrid}>
                    {/* Option 1: All Users */}
                    <Pressable
                      style={[
                        styles.audienceOptionCard,
                        audience === 'all' && styles.audienceOptionCardActive,
                      ]}
                      onPress={() => setAudience('all')}
                    >
                      <View style={styles.audienceIconRow}>
                        <Ionicons
                          name="globe-outline"
                          size={20}
                          color={audience === 'all' ? '#0d9488' : '#64748B'}
                        />
                        <View
                          style={[
                            styles.radioCircle,
                            audience === 'all' && styles.radioCircleActive,
                          ]}
                        />
                      </View>
                      <Text style={styles.audienceOptionTitle}>All Registered Users</Text>
                      <Text style={styles.audienceOptionDesc}>
                        Broadcast to every student in the database with a verified mobile number.
                      </Text>
                    </Pressable>

                    {/* Option 2: Paid Subscribers Only */}
                    <Pressable
                      style={[
                        styles.audienceOptionCard,
                        audience === 'paid' && styles.audienceOptionCardActive,
                      ]}
                      onPress={() => setAudience('paid')}
                    >
                      <View style={styles.audienceIconRow}>
                        <Ionicons
                          name="star"
                          size={20}
                          color={audience === 'paid' ? '#0d9488' : '#D97706'}
                        />
                        <View
                          style={[
                            styles.radioCircle,
                            audience === 'paid' && styles.radioCircleActive,
                          ]}
                        />
                      </View>
                      <Text style={styles.audienceOptionTitle}>Paid Subscribers Only</Text>
                      <Text style={styles.audienceOptionDesc}>
                        Active Pro, Premium, and Basic recurring subscribers.
                      </Text>
                    </Pressable>

                    {/* Option 3: Free / Starter Users */}
                    <Pressable
                      style={[
                        styles.audienceOptionCard,
                        audience === 'nonpaid' && styles.audienceOptionCardActive,
                      ]}
                      onPress={() => setAudience('nonpaid')}
                    >
                      <View style={styles.audienceIconRow}>
                        <Ionicons
                          name="sparkles-outline"
                          size={20}
                          color={audience === 'nonpaid' ? '#0d9488' : '#64748B'}
                        />
                        <View
                          style={[
                            styles.radioCircle,
                            audience === 'nonpaid' && styles.radioCircleActive,
                          ]}
                        />
                      </View>
                      <Text style={styles.audienceOptionTitle}>Free / Starter Students</Text>
                      <Text style={styles.audienceOptionDesc}>
                        Users on the Starter plan. Ideal for upgrade promotions and re-engagement.
                      </Text>
                    </Pressable>

                    {/* Option 4: Specific Students & Numbers */}
                    <Pressable
                      style={[
                        styles.audienceOptionCard,
                        audience === 'specific' && styles.audienceOptionCardActive,
                      ]}
                      onPress={() => {
                        setAudience('specific');
                        if (availableUsers.length === 0) {
                          fetchRegisteredUsers();
                        }
                      }}
                    >
                      <View style={styles.audienceIconRow}>
                        <Ionicons
                          name="person-add-outline"
                          size={20}
                          color={audience === 'specific' ? '#0d9488' : '#64748B'}
                        />
                        <View
                          style={[
                            styles.radioCircle,
                            audience === 'specific' && styles.radioCircleActive,
                          ]}
                        />
                      </View>
                      <Text style={styles.audienceOptionTitle}>Specific Students & Numbers</Text>
                      <Text style={styles.audienceOptionDesc}>
                        Search & multi-select registered students from a dropdown or enter custom phone numbers.
                      </Text>
                    </Pressable>
                  </View>

                  {/* Specific Students & Numbers Selector */}
                  {audience === 'specific' && (
                    <View style={styles.specificBoxContainer}>
                      {/* Search & Select Registered Students */}
                      <View style={styles.specificFieldGroup}>
                        <View style={styles.specificHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Feather name="user-check" size={15} color="#0d9488" />
                            <Text style={styles.fieldLabel}>Search & Select Registered Students:</Text>
                          </View>
                          {selectedUsers.length > 0 && (
                            <Pressable
                              onPress={() => setSelectedUsers([])}
                              hitSlop={6}
                              style={({ pressed }) => [styles.clearSelectedBtn, pressed && { opacity: 0.6 }]}
                            >
                              <Text style={styles.clearSelectedBtnText}>Clear All ({selectedUsers.length})</Text>
                            </Pressable>
                          )}
                        </View>

                        {/* Selected User Tag Chips */}
                        {selectedUsers.length > 0 && (
                          <View style={styles.selectedChipsWrap}>
                            {selectedUsers.map((user) => (
                              <View key={user.id} style={styles.userChip}>
                                <View style={styles.userChipAvatar}>
                                  <Text style={styles.userChipAvatarText}>
                                    {user.displayName.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <Text style={styles.userChipName} numberOfLines={1}>
                                  {user.displayName}
                                </Text>
                                <Text style={styles.userChipPhone}>
                                  ({user.phoneNumber.replace(/^(\+?94|0)?/, '0')})
                                </Text>
                                <Pressable
                                  onPress={() => handleToggleUserSelection(user)}
                                  hitSlop={8}
                                  style={({ pressed }) => [styles.userChipRemoveBtn, pressed && { opacity: 0.5 }]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Remove ${user.displayName}`}
                                >
                                  <Feather name="x" size={13} color="#64748B" />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Search Input Bar */}
                        <View style={styles.userSearchInputWrap}>
                          <Feather name="search" size={16} color="#94A3B8" style={{ marginLeft: 12 }} />
                          <TextInput
                            style={styles.userSearchInput}
                            placeholder="Type student name, phone (07x...), or email to search..."
                            placeholderTextColor="#94A3B8"
                            value={userSearchQuery}
                            onChangeText={(q) => {
                              setUserSearchQuery(q);
                              if (!isUserDropdownOpen) setIsUserDropdownOpen(true);
                            }}
                            onFocus={() => setIsUserDropdownOpen(true)}
                          />
                          {userSearchQuery.trim().length > 0 && (
                            <Pressable
                              onPress={() => setUserSearchQuery('')}
                              hitSlop={6}
                              style={{ paddingHorizontal: 8 }}
                            >
                              <Feather name="x-circle" size={16} color="#94A3B8" />
                            </Pressable>
                          )}
                          <Pressable
                            onPress={() => setIsUserDropdownOpen((prev) => !prev)}
                            style={styles.dropdownToggleBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Toggle dropdown"
                          >
                            <Feather
                              name={isUserDropdownOpen ? 'chevron-up' : 'chevron-down'}
                              size={18}
                              color="#64748B"
                            />
                          </Pressable>
                        </View>

                        {/* Dropdown Menu List */}
                        {isUserDropdownOpen && (
                          <View style={styles.userDropdownContainer}>
                            {isLoadingUsers ? (
                              <View style={styles.dropdownLoadingRow}>
                                <ActivityIndicator size="small" color="#0d9488" />
                                <Text style={styles.dropdownLoadingText}>Loading registered students...</Text>
                              </View>
                            ) : filteredUsers.length === 0 ? (
                              <View style={styles.dropdownEmptyRow}>
                                <Text style={styles.dropdownEmptyText}>
                                  No students found matching "{userSearchQuery}".
                                </Text>
                              </View>
                            ) : (
                              <>
                                {/* Dropdown Header Toolbar */}
                                <View style={styles.dropdownToolbar}>
                                  <Text style={styles.dropdownToolbarCount}>
                                    Showing {filteredUsers.length} of {availableUsers.length} students
                                  </Text>
                                  <View style={{ flexDirection: 'row', gap: 10 }}>
                                    {filteredUsers.length > 0 && (
                                      <Pressable
                                        onPress={handleSelectAllFiltered}
                                        style={({ pressed }) => [styles.dropdownToolbarAction, pressed && { opacity: 0.7 }]}
                                      >
                                        <Text style={styles.dropdownToolbarActionText}>
                                          {areAllFilteredSelected ? 'Deselect Matching' : 'Select All Matching'}
                                        </Text>
                                      </Pressable>
                                    )}
                                    <Pressable
                                      onPress={() => setIsUserDropdownOpen(false)}
                                      style={({ pressed }) => [styles.dropdownToolbarClose, pressed && { opacity: 0.7 }]}
                                    >
                                      <Text style={styles.dropdownToolbarCloseText}>Done</Text>
                                    </Pressable>
                                  </View>
                                </View>

                                {/* Scrollable List */}
                                <ScrollView
                                  style={styles.dropdownListScroll}
                                  nestedScrollEnabled={true}
                                  keyboardShouldPersistTaps="handled"
                                  showsVerticalScrollIndicator={true}
                                >
                                  {filteredUsers.slice(0, 100).map((user) => {
                                    const isSelected = selectedUsers.some((u) => u.id === user.id);
                                    const isPro = user.planTier === 'pro' || user.planTier === 'premium';
                                    const isTrial = user.planStatus === 'trialing';

                                    return (
                                      <Pressable
                                        key={user.id}
                                        onPress={() => handleToggleUserSelection(user)}
                                        style={({ pressed }) => [
                                          styles.dropdownUserItem,
                                          isSelected && styles.dropdownUserItemActive,
                                          pressed && { backgroundColor: '#F0FDFA' },
                                        ]}
                                      >
                                        {/* Avatar */}
                                        <View style={[styles.itemAvatar, isSelected && styles.itemAvatarSelected]}>
                                          <Text style={[styles.itemAvatarText, isSelected && styles.itemAvatarTextSelected]}>
                                            {user.displayName.charAt(0).toUpperCase()}
                                          </Text>
                                        </View>

                                        {/* User Info */}
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.itemUserName} numberOfLines={1}>
                                              {user.displayName}
                                            </Text>
                                            {isTrial ? (
                                              <View style={styles.trialBadgeSmall}>
                                                <Text style={styles.trialBadgeSmallText}>TRIAL</Text>
                                              </View>
                                            ) : isPro ? (
                                              <View style={styles.proBadgeSmall}>
                                                <Text style={styles.proBadgeSmallText}>{user.planTier.toUpperCase()}</Text>
                                              </View>
                                            ) : (
                                              <View style={styles.starterBadgeSmall}>
                                                <Text style={styles.starterBadgeSmallText}>STARTER</Text>
                                              </View>
                                            )}
                                          </View>
                                          <Text style={styles.itemUserPhone}>
                                            {user.phoneNumber} {user.email ? `• ${user.email}` : ''}
                                          </Text>
                                        </View>

                                        {/* Checkbox */}
                                        <Ionicons
                                          name={isSelected ? 'checkbox' : 'square-outline'}
                                          size={20}
                                          color={isSelected ? '#0d9488' : '#94A3B8'}
                                        />
                                      </Pressable>
                                    );
                                  })}
                                  {filteredUsers.length > 100 && (
                                    <View style={styles.dropdownListFooter}>
                                      <Text style={styles.dropdownListFooterText}>
                                        Showing first 100 results. Use search to narrow down further.
                                      </Text>
                                    </View>
                                  )}
                                </ScrollView>
                              </>
                            )}
                          </View>
                        )}
                      </View>

                      {/* Manual Phone Numbers Collapsible */}
                      <View style={styles.manualNumbersSection}>
                        <Pressable
                          onPress={() => setShowManualInput((prev) => !prev)}
                          style={styles.toggleManualInputBtn}
                        >
                          <Feather
                            name={showManualInput ? 'minus-circle' : 'plus-circle'}
                            size={14}
                            color="#0d9488"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.toggleManualInputBtnText}>
                            {showManualInput
                              ? 'Hide Custom Phone Numbers'
                              : '+ Or Add/Paste Custom Numbers Manually'}
                          </Text>
                        </Pressable>

                        {showManualInput && (
                          <View style={styles.manualInputContainer}>
                            <Text style={styles.fieldLabel}>
                              Enter Additional Phone Numbers (comma or line separated):
                            </Text>
                            <TextInput
                              style={[styles.textInput, styles.textArea, { minHeight: 70 }]}
                              value={specificNumbersText}
                              onChangeText={setSpecificNumbersText}
                              multiline
                              placeholder="0771234567, 0743303318, +94712345678"
                              placeholderTextColor="#94A3B8"
                            />
                            <Text style={styles.fieldHelp}>
                              Raw mobile numbers entered here will be combined with the selected students above.
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>

                {/* Message Composer Card */}
                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderIcon}>
                      <Feather name="message-square" size={16} color="#0d9488" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>2. Compose Broadcast Message</Text>
                      <Text style={styles.cardSubtitle}>
                        Use variables to personalise each SMS. 160 chars per part (70 if it contains Sinhala/Tamil or emoji).
                      </Text>
                    </View>

                    <View style={styles.charCounterBadge}>
                      <Text
                        style={[
                          styles.charCounterText,
                          smsSegments > 1 && { color: '#B45309' },
                        ]}
                      >
                        {charCount} chars · {smsSegments} SMS {smsSegments === 1 ? 'part' : 'parts'}
                        {smsCount.unicode ? ' · Unicode (70/part)' : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Preset Templates */}
                  <View style={styles.presetsRow}>
                    <Text style={styles.presetsLabel}>Quick Presets:</Text>
                    {SMS_PRESETS.map((p) => (
                      <Pressable
                        key={p.id}
                        style={({ pressed }) => [styles.presetPill, pressed && { opacity: 0.75 }]}
                        onPress={() => setSmsMessage(p.text)}
                      >
                        <Text style={styles.presetPillText}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* SMS Input */}
                  <TextInput
                    style={[styles.textInput, styles.textArea, { minHeight: 110 }]}
                    value={smsMessage}
                    onChangeText={setSmsMessage}
                    onSelectionChange={(e) => {
                      smsSelectionRef.current = e.nativeEvent.selection;
                    }}
                    multiline
                    placeholder="Hi {{first_name|there}}, your next lesson is ready! {{link}}"
                    placeholderTextColor="#94A3B8"
                  />

                  {/* Variables: inserted at the cursor */}
                  <View style={styles.presetsRow}>
                    <Text style={styles.presetsLabel}>Insert:</Text>
                    {[
                      { token: '{{first_name|there}}', label: 'First name' },
                      { token: '{{name}}', label: 'Full name' },
                      { token: '{{link}}', label: 'Tracked link' },
                    ].map((v) => (
                      <Pressable
                        key={v.token}
                        style={({ pressed }) => [styles.presetPill, pressed && { opacity: 0.75 }]}
                        onPress={() => insertSmsVariable(v.token)}
                      >
                        <Text style={styles.presetPillText}>+ {v.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.smsHelpText}>
                    {'{{first_name|there}}'} uses {'"there"'} when a user has no name. Without {'{{link}}'}, the link is added at the end.
                  </Text>

                  {/* Tracked link (optional) */}
                  <View style={styles.smsLinkRow}>
                    <View style={{ flex: 1.4 }}>
                      <Text style={styles.fieldLabel}>Tracked link (optional):</Text>
                      <TextInput
                        style={[styles.textInput, smsLinkInvalid && { borderColor: '#DC2626' }]}
                        value={smsLink}
                        onChangeText={setSmsLink}
                        placeholder="https://app.speakwithmaya.com/"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {smsLinkInvalid && (
                        <Text style={[styles.smsHelpText, { color: '#DC2626' }]}>Must start with https://app.speakwithmaya.com</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Campaign name:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={campaignName}
                        onChangeText={setCampaignName}
                        placeholder="e.g. November comeback"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  {/* Live preview: what one recipient receives */}
                  <View style={styles.smsPreviewBox}>
                    <View style={styles.smsPreviewHeader}>
                      <Text style={styles.fieldLabel}>Preview as:</Text>
                      <TextInput
                        style={[styles.textInput, styles.smsPreviewNameInput]}
                        value={previewName}
                        onChangeText={setPreviewName}
                        placeholder="(user without a name)"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={styles.smsPhone}>
                      <Text style={styles.smsPhoneSender}>SpeakWithMaya</Text>
                      <View style={styles.smsBubble}>
                        <Text style={styles.smsBubbleText}>
                          {smsPreview || 'Your message preview appears here.'}
                        </Text>
                      </View>
                      <Text style={styles.smsPhoneMeta}>
                        {charCount} chars · {smsSegments} SMS {smsSegments === 1 ? 'part' : 'parts'} per user
                        {sampleLink ? ' · each user gets their own link' : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Test Send Row */}
                  <View style={styles.testSendRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.fieldLabel}>Test Phone Number:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={testNumber}
                        onChangeText={setTestNumber}
                        placeholder="0743303318 (Your Mobile)"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.testSendBtn,
                        pressed && { opacity: 0.85 },
                        isSendingTest && { opacity: 0.6 },
                      ]}
                      onPress={handleSendTestSms}
                      disabled={isSendingTest}
                    >
                      {isSendingTest ? (
                        <ActivityIndicator size="small" color="#0d9488" />
                      ) : (
                        <>
                          <Feather name="send" size={14} color="#0d9488" style={{ marginRight: 6 }} />
                          <Text style={styles.testSendBtnText}>Send Single Test</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {/* Final Broadcast Action Button */}
                  <View style={styles.broadcastActionBox}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.broadcastSubmitBtn,
                        pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                        (isBroadcasting || !smsMessage.trim() || smsLinkInvalid) && { opacity: 0.5 },
                      ]}
                      onPress={handleBroadcastSms}
                      disabled={isBroadcasting || !smsMessage.trim() || smsLinkInvalid}
                    >
                      {isBroadcasting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Feather name="radio" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.broadcastSubmitBtnText}>
                            Broadcast SMS to {audienceCount !== null ? `${audienceCount} Users` : 'Audience'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {/* Last Broadcast Result Log */}
                  {lastBroadcastResult && (
                    <View style={styles.broadcastResultBanner}>
                      <Feather name="check-circle" size={18} color="#15803D" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.broadcastResultTitle}>
                          Broadcast dispatched at {lastBroadcastResult.date}
                        </Text>
                        <Text style={styles.broadcastResultDesc}>
                          Targeted: {lastBroadcastResult.totalTargeted} | Sent: {lastBroadcastResult.totalSent} | Failed: {lastBroadcastResult.totalFailed}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Tracked-link click report */}
                <SmsCampaignReport authHeaders={getAuthHeaders} refreshKey={reportRefreshKey} />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Tabs */
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButtonActive: {
    backgroundColor: '#F0FDFA',
    borderColor: '#0D9488',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#64748B',
    ...fontStyle('inter', 'semiBold'),
  },
  tabButtonTextActive: {
    color: '#0F766E',
    ...fontStyle('inter', 'bold'),
  },
  tabBadgeAmber: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 8,
  },
  tabBadgeAmberText: {
    fontSize: 9.5,
    color: '#B45309',
    ...fontStyle('inter', 'bold'),
  },
  tabContentWrap: {
    gap: 20,
  },

  /* Hero Status Card */
  heroStatusCard: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  heroStatusCardLive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  heroStatusCardMaintenance: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  heroStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 280,
    gap: 16,
  },
  heroStatusIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatusTextCol: {
    flex: 1,
  },
  heroStatusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillGreen: {
    backgroundColor: '#DCFCE7',
  },
  statusPillAmber: {
    backgroundColor: '#FEF3C7',
  },
  statusPillText: {
    fontSize: 10.5,
    ...fontStyle('inter', 'bold'),
    letterSpacing: 0.5,
  },
  heroStatusTitle: {
    fontSize: 16,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
    marginBottom: 4,
  },
  heroStatusDesc: {
    fontSize: 13,
    color: '#475569',
    ...fontStyle('inter', 'regular'),
    lineHeight: 18,
  },
  toggleMaintenanceBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleMaintenanceBtnLive: {
    backgroundColor: '#16A34A',
  },
  toggleMaintenanceBtnMaintenance: {
    backgroundColor: '#D97706',
  },
  toggleMaintenanceBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },

  /* Grid Layout */
  gridRow: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  gridRowPhone: {
    flexDirection: 'column',
  },

  /* Cards */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15.5,
    color: '#0F172A',
    ...fontStyle('outfit', 'bold'),
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
    marginTop: 2,
  },

  /* Fields */
  fieldItem: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12.5,
    color: '#334155',
    ...fontStyle('inter', 'semiBold'),
    marginBottom: 6,
  },
  fieldHelp: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
    marginTop: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0F172A',
    ...fontStyle('inter', 'regular'),
  },
  textArea: {
    textAlignVertical: 'top',
    minHeight: 85,
  },
  cardActionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    backgroundColor: '#0D9488',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    fontSize: 13.5,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },

  /* Student Preview Mockup */
  previewPhoneFrame: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  previewBadgeText: {
    fontSize: 10.5,
    color: '#B45309',
    ...fontStyle('inter', 'bold'),
    letterSpacing: 0.5,
  },
  previewAvatar: {
    width: 80,
    height: 80,
    marginBottom: 14,
  },
  previewTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    ...fontStyle('outfit', 'bold'),
    textAlign: 'center',
    marginBottom: 8,
  },
  previewMessage: {
    fontSize: 12,
    color: '#94A3B8',
    ...fontStyle('inter', 'regular'),
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  previewEstimateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 16,
  },
  previewEstimateLabel: {
    fontSize: 11,
    color: '#94A3B8',
    ...fontStyle('inter', 'regular'),
  },
  previewEstimateValue: {
    fontSize: 11,
    color: '#38BDF8',
    ...fontStyle('inter', 'bold'),
  },
  previewCheckBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  previewCheckBtnText: {
    fontSize: 12.5,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },

  /* SMS Audience Selector */
  audienceCounterPill: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  audienceCounterPillText: {
    fontSize: 12,
    color: '#0F766E',
    ...fontStyle('inter', 'bold'),
  },
  audienceSelectorGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  audienceOptionCard: {
    flex: 1,
    minWidth: 220,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    backgroundColor: '#F8FAFC',
  },
  audienceOptionCardActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  audienceIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  radioCircleActive: {
    borderColor: '#0D9488',
    backgroundColor: '#0D9488',
  },
  audienceOptionTitle: {
    fontSize: 13.5,
    color: '#0F172A',
    ...fontStyle('inter', 'bold'),
    marginBottom: 4,
  },
  audienceOptionDesc: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
    lineHeight: 16,
  },
  /* Specific Students & Numbers Selector */
  specificBoxContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  specificFieldGroup: {
    marginBottom: 12,
  },
  specificHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clearSelectedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  clearSelectedBtnText: {
    fontSize: 11.5,
    color: '#DC2626',
    ...fontStyle('inter', 'bold'),
  },
  selectedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    gap: 6,
  },
  userChipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userChipAvatarText: {
    fontSize: 10,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },
  userChipName: {
    fontSize: 12,
    color: '#0F766E',
    ...fontStyle('inter', 'semiBold'),
    maxWidth: 130,
  },
  userChipPhone: {
    fontSize: 11,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  userChipRemoveBtn: {
    padding: 2,
  },
  userSearchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 44,
  },
  userSearchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
    ...fontStyle('inter', 'regular'),
  },
  dropdownToggleBtn: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDropdownContainer: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
        zIndex: 50,
      } as any,
      default: {
        elevation: 6,
      },
    }),
  },
  dropdownLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  dropdownLoadingText: {
    fontSize: 12.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
  },
  dropdownEmptyRow: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownEmptyText: {
    fontSize: 12.5,
    color: '#94A3B8',
    ...fontStyle('inter', 'regular'),
  },
  dropdownToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dropdownToolbarCount: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  dropdownToolbarAction: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F0FDFA',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  dropdownToolbarActionText: {
    fontSize: 11,
    color: '#0D9488',
    ...fontStyle('inter', 'bold'),
  },
  dropdownToolbarClose: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#0D9488',
    borderRadius: 6,
  },
  dropdownToolbarCloseText: {
    fontSize: 11,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },
  dropdownListScroll: {
    maxHeight: 250,
  },
  dropdownUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownUserItemActive: {
    backgroundColor: '#F0FDFA',
  },
  itemAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemAvatarSelected: {
    backgroundColor: '#0D9488',
  },
  itemAvatarText: {
    fontSize: 13,
    color: '#475569',
    ...fontStyle('inter', 'bold'),
  },
  itemAvatarTextSelected: {
    color: '#FFFFFF',
  },
  itemUserName: {
    fontSize: 13,
    color: '#0F172A',
    ...fontStyle('inter', 'semiBold'),
  },
  itemUserPhone: {
    fontSize: 11.5,
    color: '#64748B',
    ...fontStyle('inter', 'regular'),
    marginTop: 2,
  },
  trialBadgeSmall: {
    backgroundColor: '#F3E8FF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  trialBadgeSmallText: {
    fontSize: 9,
    color: '#7C3AED',
    ...fontStyle('inter', 'bold'),
  },
  proBadgeSmall: {
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  proBadgeSmallText: {
    fontSize: 9,
    color: '#2563EB',
    ...fontStyle('inter', 'bold'),
  },
  starterBadgeSmall: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  starterBadgeSmallText: {
    fontSize: 9,
    color: '#64748B',
    ...fontStyle('inter', 'medium'),
  },
  dropdownListFooter: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  dropdownListFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    ...fontStyle('inter', 'regular'),
  },
  manualNumbersSection: {
    marginTop: 10,
  },
  toggleManualInputBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggleManualInputBtnText: {
    fontSize: 12.5,
    color: '#0D9488',
    ...fontStyle('inter', 'semiBold'),
  },
  manualInputContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  /* Composer */
  charCounterBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  charCounterText: {
    fontSize: 11.5,
    color: '#475569',
    ...fontStyle('inter', 'medium'),
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  presetsLabel: {
    fontSize: 12,
    color: '#64748B',
    ...fontStyle('inter', 'semiBold'),
  },
  presetPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetPillText: {
    fontSize: 11.5,
    color: '#334155',
    ...fontStyle('inter', 'medium'),
  },
  smsHelpText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 6,
  },
  smsLinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  smsPreviewBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  smsPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  smsPreviewNameInput: {
    flex: 1,
    paddingVertical: 6,
  },
  smsPhone: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  smsPhoneSender: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 10,
  },
  smsBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: '#E9E9EB',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smsBubbleText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    lineHeight: 19,
    color: '#0F172A',
  },
  smsPhoneMeta: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 10,
    textAlign: 'center',
  },
  testSendRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  testSendBtn: {
    height: 40,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  testSendBtnText: {
    fontSize: 12.5,
    color: '#0F766E',
    ...fontStyle('inter', 'bold'),
  },
  broadcastActionBox: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  broadcastSubmitBtn: {
    backgroundColor: '#0D9488',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastSubmitBtnText: {
    fontSize: 14.5,
    color: '#FFFFFF',
    ...fontStyle('inter', 'bold'),
  },
  broadcastResultBanner: {
    marginTop: 16,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  broadcastResultTitle: {
    fontSize: 13,
    color: '#15803D',
    ...fontStyle('inter', 'bold'),
  },
  broadcastResultDesc: {
    fontSize: 12,
    color: '#166534',
    ...fontStyle('inter', 'regular'),
    marginTop: 2,
  },
});
