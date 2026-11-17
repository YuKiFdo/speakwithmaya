import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { mayaAlert } from '@/components/ui/alert-modal';
import { getBackendBaseUrl } from '@/utils/backend-url';
import { AdminAuthStore } from '@/services/store/admin-auth-store';
import {
  promotionsApi,
  PromotionClaim,
  PromotionCampaign,
  PromotionsOverviewData,
} from '@/services/promotions/promotions-api';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  soft: '#f1f5f9',
  purple: '#7c3aed',
  purpleLight: '#f5f3ff',
  purpleBorder: '#ddd6fe',
  blue: '#0284c7',
  blueLight: '#f0f9ff',
  blueBorder: '#bae6fd',
  green: '#16a34a',
  greenLight: '#f0fdf4',
  greenBorder: '#bbf7d0',
  amber: '#d97706',
  amberLight: '#fef3c7',
  amberBorder: '#fde68a',
  red: '#ef4444',
  redLight: '#fef2f2',
  redBorder: '#fecaca',
};

const PROMO_TYPE_CONFIG: Record<
  string,
  { label: string; icon: keyof typeof Feather.glyphMap; bg: string; color: string; border: string }
> = {
  comeback: {
    label: 'Comeback / Outage',
    icon: 'rotate-ccw',
    bg: '#FEF3C7',
    color: '#B45309',
    border: '#FDE68A',
  },
  holiday: {
    label: 'Holiday / Seasonal',
    icon: 'gift',
    bg: '#FDF2F8',
    color: '#BE185D',
    border: '#FBCFE8',
  },
  referral: {
    label: 'Referral / Milestone',
    icon: 'users',
    bg: '#F0FDF4',
    color: '#15803D',
    border: '#BBF7D0',
  },
  marketing: {
    label: 'General Marketing',
    icon: 'tag',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    border: '#BFDBFE',
  },
};

const PAGE_SIZE = 15;

export default function AdminPromotionsScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'claims' | 'campaigns'>('claims');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Overview metrics
  const [overview, setOverview] = useState<PromotionsOverviewData>({
    totalComebacks: 0,
    totalClaims: 0,
    starterProPassClaims: 0,
    paidBonusClaims: 0,
    campaigns: [],
  });

  // Claims state
  const [claims, setClaims] = useState<PromotionClaim[]>([]);
  const [totalClaims, setTotalClaims] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('ALL');

  // Campaigns state
  const [campaignsList, setCampaignsList] = useState<PromotionCampaign[]>([]);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<PromotionCampaign | null>(null);
  const [submittingCampaign, setSubmittingCampaign] = useState(false);

  // Campaign Form State
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPromoType, setFormPromoType] = useState<'comeback' | 'holiday' | 'referral' | 'marketing'>('comeback');
  const [formStarterRewardType, setFormStarterRewardType] = useState<'pro_pass' | 'bonus_minutes'>('pro_pass');
  const [formStarterRewardValue, setFormStarterRewardValue] = useState('120');
  const [formStarterTrialDays, setFormStarterTrialDays] = useState('3');
  const [formPaidRewardValue, setFormPaidRewardValue] = useState('100');
  const [formAudience, setFormAudience] = useState<'all' | 'old_only' | 'new_only'>('old_only');
  const [formValidDays, setFormValidDays] = useState('7');
  const [formCutoffDate, setFormCutoffDate] = useState('2026-11-17');

  const handleOpenCreateModal = () => {
    setEditingCampaign(null);
    setFormCode('');
    setFormTitle('');
    setFormDesc('');
    setFormPromoType('comeback');
    setFormStarterRewardType('pro_pass');
    setFormStarterRewardValue('120');
    setFormStarterTrialDays('3');
    setFormPaidRewardValue('100');
    setFormAudience('old_only');
    setFormValidDays('7');
    setFormCutoffDate(new Date().toISOString().split('T')[0]);
    setCampaignModalOpen(true);
  };

  const handleOpenEditModal = (camp: PromotionCampaign) => {
    setEditingCampaign(camp);
    setFormCode(camp.id);
    setFormTitle(camp.title || '');
    setFormDesc(camp.description || '');
    setFormPromoType(camp.promoType || 'comeback');
    setFormStarterRewardType(
      camp.starterRewardType || (camp.rewardType === 'bonus_minutes' ? 'bonus_minutes' : 'pro_pass')
    );
    setFormStarterRewardValue(String(camp.starterRewardValue || camp.rewardValue || 120));
    setFormStarterTrialDays(String(camp.starterTrialDays || camp.trialDays || 3));
    setFormPaidRewardValue(String(camp.paidRewardValue || 100));
    setFormAudience(camp.targetAudience || 'all');
    setFormValidDays(String(camp.validDays || 7));
    setFormCutoffDate(camp.userCreatedBefore ? camp.userCreatedBefore.split('T')[0] : '2026-11-17');
    setCampaignModalOpen(true);
  };

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [ovData, claimsData, campsData] = await Promise.all([
        promotionsApi.getAdminPromotionsOverview(),
        promotionsApi.getAdminPromotionClaims({
          promoCode: selectedCampaign === 'ALL' ? undefined : selectedCampaign,
          page,
          limit: PAGE_SIZE,
        }),
        promotionsApi.getCampaigns().catch(() => []),
      ]);

      setOverview(ovData);
      setClaims(claimsData.data || []);
      setTotalClaims(claimsData.total || 0);
      setCampaignsList(campsData || []);

    } catch (err: any) {
      console.warn('Failed to fetch promotions data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, selectedCampaign]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Submit Create or Edit Campaign
  const handleSaveCampaign = async () => {
    if (!editingCampaign && !formCode.trim()) {
      await mayaAlert.error('Please provide a unique Promo Code (e.g. holiday-2026)', 'Missing Field');
      return;
    }
    if (!formTitle.trim()) {
      await mayaAlert.error('Please provide a Campaign Title', 'Missing Field');
      return;
    }

    try {
      setSubmittingCampaign(true);
      const starterVal = Number(formStarterRewardValue) || (formStarterRewardType === 'pro_pass' ? 120 : 30);
      const starterDays = formStarterRewardType === 'pro_pass' ? Number(formStarterTrialDays) || 3 : undefined;
      const paidVal = Number(formPaidRewardValue) || 100;
      const validDaysNum = Number(formValidDays) || 7;

      if (editingCampaign) {
        await promotionsApi.updateCampaign(editingCampaign.id, {
          title: formTitle.trim(),
          description: formDesc.trim(),
          promoType: formPromoType,
          starterRewardType: formStarterRewardType,
          starterRewardValue: starterVal,
          starterTrialDays: starterDays,
          paidRewardType: 'bonus_minutes',
          paidRewardValue: paidVal,
          targetAudience: formAudience,
          targetTiers: ['starter', 'basic', 'pro', 'premium'],
          validDays: validDaysNum,
        });

        await mayaAlert.success(`Campaign "${formTitle.trim()}" has been updated successfully!`, 'Campaign Updated');
      } else {
        await promotionsApi.createCampaign({
          id: formCode.trim().toLowerCase(),
          title: formTitle.trim(),
          description: formDesc.trim(),
          promoType: formPromoType,
          rewardType: formStarterRewardType,
          rewardValue: starterVal,
          trialDays: starterDays,
          starterRewardType: formStarterRewardType,
          starterRewardValue: starterVal,
          starterTrialDays: starterDays,
          paidRewardType: 'bonus_minutes',
          paidRewardValue: paidVal,
          targetAudience: formAudience,
          targetTiers: ['starter', 'basic', 'pro', 'premium'],
          userCreatedBefore: formAudience === 'old_only' ? `${formCutoffDate}T23:59:59Z` : undefined,
          validDays: validDaysNum,
        });

        await mayaAlert.success('Campaign launched and ready for student claims!', '🎉 Campaign Created');
      }

      setCampaignModalOpen(false);
      fetchData();
    } catch (err: any) {
      await mayaAlert.error(err?.message || 'Failed to save campaign', 'Error');
    } finally {
      setSubmittingCampaign(false);
    }
  };

  // Toggle Campaign Active / Ended
  const handleToggleCampaignStatus = async (camp: PromotionCampaign) => {
    const nextStatus = camp.status === 'active' ? 'ended' : 'active';
    try {
      await promotionsApi.updateCampaignStatus(camp.id, nextStatus);
      setCampaignsList((list) =>
        list.map((c) => (c.id === camp.id ? { ...c, status: nextStatus } : c))
      );
    } catch (err: any) {
      await mayaAlert.error(err?.message || 'Could not update status', 'Error');
    }
  };

  // Filtered claims based on search query
  const filteredClaims = useMemo(() => {
    if (!searchQuery.trim()) return claims;
    const q = searchQuery.toLowerCase().trim();
    return claims.filter((c) => {
      const phone = c.user?.phoneNumber?.toLowerCase() || '';
      const name = c.user?.displayName?.toLowerCase() || '';
      const promo = c.promo_code?.toLowerCase() || '';
      const tier = c.original_tier?.toLowerCase() || '';
      return phone.includes(q) || name.includes(q) || promo.includes(q) || tier.includes(q);
    });
  }, [claims, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalClaims / PAGE_SIZE));

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Sidebar */}
        <AdminSidebar
          activeRoute="/admin/promotions"
          isOpen={!isPhone || sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <View style={styles.contentCol}>
          <AdminTopBar
            title="Promotions & Comebacks"
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header info */}
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.pageTitle}>Promotions & Comebacks</Text>
                <Text style={styles.pageSubtitle}>
                  Monitor students returning after downtime, create custom campaigns, and manage promotional rewards.
                </Text>
              </View>

              <View style={styles.headerActions}>
                <Pressable
                  style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleOpenCreateModal}
                >
                  <Feather name="plus-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createBtnText}>+ Create Promotion</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => fetchData()}
                >
                  <Feather name="refresh-cw" size={15} color="#0284c7" />
                </Pressable>
              </View>
            </View>

            {/* KPI Metric Cards */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { borderColor: '#e2e8f0' }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#e0f2fe' }]}>
                  <Feather name="log-in" size={20} color="#0284c7" />
                </View>
                <Text style={styles.kpiValue}>{overview.totalComebacks}</Text>
                <Text style={styles.kpiLabel}>Returning Students</Text>
                <Text style={styles.kpiHint}>Logged in post-downtime</Text>
              </View>

              <View style={[styles.kpiCard, { borderColor: '#ddd6fe' }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#f3e8ff' }]}>
                  <Feather name="gift" size={20} color="#7c3aed" />
                </View>
                <Text style={styles.kpiValue}>{overview.totalClaims}</Text>
                <Text style={styles.kpiLabel}>Total Claims</Text>
                <Text style={styles.kpiHint}>Across all campaigns</Text>
              </View>

              <View style={[styles.kpiCard, { borderColor: '#ddd6fe' }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#f5f3ff' }]}>
                  <Ionicons name="ribbon" size={20} color="#7c3aed" />
                </View>
                <Text style={styles.kpiValue}>{overview.starterProPassClaims}</Text>
                <Text style={styles.kpiLabel}>3-Day Pro Passes</Text>
                <Text style={styles.kpiHint}>120m for Free Starters</Text>
              </View>

              <View style={[styles.kpiCard, { borderColor: '#bbf7d0' }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#f0fdf4' }]}>
                  <Feather name="award" size={20} color="#16a34a" />
                </View>
                <Text style={styles.kpiValue}>{overview.paidBonusClaims}</Text>
                <Text style={styles.kpiLabel}>Bonus Minutes Claims</Text>
                <Text style={styles.kpiHint}>+100m for Paid users</Text>
              </View>
            </View>

            {/* Navigation Tabs: Claims vs Campaigns */}
            <View style={styles.tabNavRow}>
              <Pressable
                style={[styles.tabNavBtn, activeTab === 'claims' && styles.tabNavBtnActive]}
                onPress={() => setActiveTab('claims')}
              >
                <Feather
                  name="users"
                  size={15}
                  color={activeTab === 'claims' ? '#0052FF' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabNavText, activeTab === 'claims' && styles.tabNavTextActive]}>
                  Student Claims & Comebacks ({totalClaims})
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tabNavBtn, activeTab === 'campaigns' && styles.tabNavBtnActive]}
                onPress={() => setActiveTab('campaigns')}
              >
                <Feather
                  name="layers"
                  size={15}
                  color={activeTab === 'campaigns' ? '#0052FF' : '#64748B'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabNavText, activeTab === 'campaigns' && styles.tabNavTextActive]}>
                  Campaigns & Promotion Studio ({campaignsList.length})
                </Text>
              </Pressable>
            </View>

            {activeTab === 'claims' ? (
              <>
                {/* Filter & Search Bar */}
                <View style={styles.filterSection}>
                  <View style={styles.searchBox}>
                    <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by phone, student name, or tier..."
                      placeholderTextColor="#94a3b8"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <Pressable onPress={() => setSearchQuery('')}>
                        <Feather name="x" size={16} color="#94a3b8" />
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.campaignPills}>
                    <Pressable
                      style={[styles.pill, selectedCampaign === 'ALL' && styles.pillActive]}
                      onPress={() => setSelectedCampaign('ALL')}
                    >
                      <Text style={[styles.pillText, selectedCampaign === 'ALL' && styles.pillTextActive]}>
                        All Campaigns
                      </Text>
                    </Pressable>

                    {campaignsList.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[styles.pill, selectedCampaign === c.id && styles.pillActive]}
                        onPress={() => setSelectedCampaign(c.id)}
                      >
                        <Text style={[styles.pillText, selectedCampaign === c.id && styles.pillTextActive]}>
                          {c.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Claims Table */}
                <View style={styles.tableCard}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.thCell, { flex: 2 }]}>Student</Text>
                    <Text style={[styles.thCell, { flex: 1.2 }]}>Initial Tier</Text>
                    <Text style={[styles.thCell, { flex: 2 }]}>Reward Granted</Text>
                    <Text style={[styles.thCell, { flex: 1.5 }]}>Claimed At</Text>
                    <Text style={[styles.thCell, { flex: 1 }]}>Status</Text>
                  </View>

                  {loading ? (
                    <AdminTableSkeleton rows={6} />
                  ) : filteredClaims.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Feather name="inbox" size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
                      <Text style={styles.emptyTitle}>No Promotion Claims Found</Text>
                      <Text style={styles.emptySubtitle}>
                        {searchQuery
                          ? 'No students matched your search criteria.'
                          : 'Students will appear here as they claim their 3-Day Pro Pass or bonus minutes.'}
                      </Text>
                    </View>
                  ) : (
                    filteredClaims.map((claim, idx) => {
                      const isProPass = claim.reward_type === 'pro_pass';
                      return (
                        <View
                          key={claim.id || idx}
                          style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#f8fafc' }]}
                        >
                          {/* Student info */}
                          <View style={[styles.tdCell, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                            <View style={styles.avatarCircle}>
                              <Text style={styles.avatarInitials}>
                                {(claim.user?.displayName || 'S').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ marginLeft: 10, flex: 1 }}>
                              <Text style={styles.studentName} numberOfLines={1}>
                                {claim.user?.displayName || 'Student'}
                              </Text>
                              <Text style={styles.studentPhone}>
                                {claim.user?.phoneNumber || claim.metadata?.phone_number || 'N/A'}
                              </Text>
                            </View>
                          </View>

                          {/* Initial Tier */}
                          <View style={[styles.tdCell, { flex: 1.2 }]}>
                            <View style={styles.tierBadge}>
                              <Text style={styles.tierBadgeText}>
                                {(claim.original_tier || 'starter').toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          {/* Reward */}
                          <View style={[styles.tdCell, { flex: 2 }]}>
                            <View
                              style={[
                                styles.rewardBadge,
                                isProPass
                                  ? { backgroundColor: C.purpleLight, borderColor: C.purpleBorder }
                                  : { backgroundColor: C.blueLight, borderColor: C.blueBorder },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.rewardBadgeText,
                                  { color: isProPass ? C.purple : C.blue },
                                ]}
                              >
                                {isProPass ? '👑 3-Day Pro Pass (120m)' : '⭐ +100 Bonus Minutes'}
                              </Text>
                            </View>
                            <Text style={styles.promoCodeText}>{claim.promo_code}</Text>
                          </View>

                          {/* Claimed Date */}
                          <View style={[styles.tdCell, { flex: 1.5 }]}>
                            <Text style={styles.dateText}>{formatDate(claim.claimed_at)}</Text>
                          </View>

                          {/* Status */}
                          <View style={[styles.tdCell, { flex: 1 }]}>
                            <View style={[styles.statusBadge, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
                              <Text style={[styles.statusText, { color: C.green }]}>
                                {claim.status || 'Active'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}

                  {/* Pagination controls */}
                  <View style={styles.paginationRow}>
                    <Text style={styles.paginationInfo}>
                      Showing {filteredClaims.length} of {totalClaims} total claims (Page {page} of {totalPages})
                    </Text>

                    <View style={styles.pageButtons}>
                      <Pressable
                        disabled={page <= 1}
                        style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                        onPress={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <Feather name="chevron-left" size={16} color={page <= 1 ? '#cbd5e1' : '#0f172a'} />
                      </Pressable>

                      <Pressable
                        disabled={page >= totalPages}
                        style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                        onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        <Feather name="chevron-right" size={16} color={page >= totalPages ? '#cbd5e1' : '#0f172a'} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              /* Campaigns Studio View */
              <View style={styles.campaignsContainer}>
                {campaignsList.map((camp) => {
                  const typeCfg = PROMO_TYPE_CONFIG[camp.promoType || 'comeback'] || PROMO_TYPE_CONFIG.comeback;
                  const isStarterProPass =
                    (camp.starterRewardType || camp.rewardType) === 'pro_pass';
                  const starterVal = camp.starterRewardValue || camp.rewardValue || (isStarterProPass ? 120 : 30);
                  const starterDays = camp.starterTrialDays || camp.trialDays || 3;
                  const paidVal = camp.paidRewardValue || 100;

                  return (
                    <View key={camp.id} style={styles.campaignCard}>
                      <View style={styles.campaignHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                            <Text style={styles.campaignTitle}>{camp.title}</Text>
                            <View
                              style={[
                                styles.statusBadge,
                                camp.status === 'active'
                                  ? { backgroundColor: C.greenLight, borderColor: C.greenBorder }
                                  : { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusText,
                                  { color: camp.status === 'active' ? C.green : '#64748b' },
                                ]}
                              >
                                {(camp.status || 'active').toUpperCase()}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.typeBadge,
                                { backgroundColor: typeCfg.bg, borderColor: typeCfg.border },
                              ]}
                            >
                              <Feather name={typeCfg.icon} size={11} color={typeCfg.color} style={{ marginRight: 4 }} />
                              <Text style={[styles.typeBadgeText, { color: typeCfg.color }]}>
                                {typeCfg.label}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.campaignCodePill}>Code: {camp.id}</Text>
                        </View>

                        {/* Action buttons */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Pressable
                            style={styles.editCampBtn}
                            onPress={() => handleOpenEditModal(camp)}
                          >
                            <Feather name="edit-2" size={13} color="#0052FF" style={{ marginRight: 4 }} />
                            <Text style={styles.editCampBtnText}>Edit</Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.toggleCampBtn,
                              camp.status === 'active' ? styles.btnDanger : styles.btnSuccess,
                            ]}
                            onPress={() => handleToggleCampaignStatus(camp)}
                          >
                            <Text
                              style={[
                                styles.toggleCampBtnText,
                                { color: camp.status === 'active' ? '#ef4444' : '#16a34a' },
                              ]}
                            >
                              {camp.status === 'active' ? 'End Campaign' : 'Reactivate'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {camp.description ? (
                        <Text style={styles.campaignDesc}>{camp.description}</Text>
                      ) : null}

                      {/* Campaign Configuration Grid */}
                      <View style={styles.campConfigGrid}>
                        <View style={styles.campConfigItem}>
                          <Text style={styles.campConfigLabel}>Starter Students (Free)</Text>
                          <Text style={styles.campConfigValue}>
                            {isStarterProPass
                              ? `👑 Pro Pass (${starterDays}d, ${starterVal}m)`
                              : `⭐ +${starterVal} Free Mins`}
                          </Text>
                        </View>

                        <View style={styles.campConfigItem}>
                          <Text style={styles.campConfigLabel}>Paid Subscribers</Text>
                          <Text style={styles.campConfigValue}>
                            🎁 +{paidVal} Bonus Mins
                          </Text>
                        </View>

                        <View style={styles.campConfigItem}>
                          <Text style={styles.campConfigLabel}>Target Audience</Text>
                          <Text style={styles.campConfigValue}>
                            {camp.targetAudience === 'old_only'
                              ? '⏳ Existing Only'
                              : camp.targetAudience === 'new_only'
                              ? '✨ New Only'
                              : '👥 All Students'}
                          </Text>
                        </View>

                        <View style={styles.campConfigItem}>
                          <Text style={styles.campConfigLabel}>Validity Window</Text>
                          <Text style={styles.campConfigValue}>
                            {camp.validDays ? `Active for ${camp.validDays} Days` : 'Open'}
                          </Text>
                        </View>

                        <View style={styles.campConfigItem}>
                          <Text style={styles.campConfigLabel}>Claims Breakdown</Text>
                          <Text style={[styles.campConfigValue, { color: '#0052FF' }]}>
                            {camp.totalClaims || 0} claims ({camp.starterProPassClaims || 0} Starter, {camp.paidBonusClaims || 0} Paid)
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* CREATE / EDIT CAMPAIGN MODAL */}
      <Modal visible={campaignModalOpen} transparent animationType="fade" onRequestClose={() => setCampaignModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, isPhone && styles.modalBoxMobile]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingCampaign ? `Edit Campaign: ${editingCampaign.title}` : 'Create Promotion Campaign'}
                </Text>
                <Text style={styles.modalSub}>
                  {editingCampaign
                    ? 'Modify reward tiers, target audience, and duration.'
                    : 'Configure rewards, duration, and audience eligibility.'}
                </Text>
              </View>
              <Pressable onPress={() => setCampaignModalOpen(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 540 }} showsVerticalScrollIndicator={false}>
              {/* Promotion Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Promotion Type *</Text>
                <View style={styles.radioRow}>
                  {[
                    { key: 'comeback', label: '🔄 Comeback / Outage' },
                    { key: 'holiday', label: '🎄 Holiday / Seasonal' },
                    { key: 'referral', label: '🤝 Referral / Milestone' },
                    { key: 'marketing', label: '📣 Marketing' },
                  ].map((t) => (
                    <Pressable
                      key={t.key}
                      style={[styles.radioBtn, formPromoType === t.key && styles.radioBtnActive]}
                      onPress={() => setFormPromoType(t.key as any)}
                    >
                      <Text style={[styles.radioText, formPromoType === t.key && styles.radioTextActive]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Promo Code & Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Unique Promo Code * {editingCampaign ? '(Cannot be changed)' : ''}
                </Text>
                <TextInput
                  style={[styles.textInput, editingCampaign && { backgroundColor: '#f1f5f9', color: '#64748b' }]}
                  placeholder="e.g. easter-2026, outage-comeback-nov26"
                  value={formCode}
                  onChangeText={setFormCode}
                  autoCapitalize="none"
                  editable={!editingCampaign}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Campaign Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 3-Day Pro Pass Comeback Bonus"
                  value={formTitle}
                  onChangeText={setFormTitle}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description / Notes</Text>
                <TextInput
                  style={[styles.textInput, { height: 56 }]}
                  placeholder="Explain why this promo is offered..."
                  multiline
                  value={formDesc}
                  onChangeText={setFormDesc}
                />
              </View>

              {/* Section: Starter Users Reward */}
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerTitle}>1. Starter Users (Free Students) Reward</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reward for Starter Students</Text>
                <View style={styles.radioRow}>
                  <Pressable
                    style={[styles.radioBtn, formStarterRewardType === 'pro_pass' && styles.radioBtnActive]}
                    onPress={() => {
                      setFormStarterRewardType('pro_pass');
                      if (formStarterRewardValue === '30') setFormStarterRewardValue('120');
                    }}
                  >
                    <Text style={[styles.radioText, formStarterRewardType === 'pro_pass' && styles.radioTextActive]}>
                      👑 Pro Trial Pass
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.radioBtn, formStarterRewardType === 'bonus_minutes' && styles.radioBtnActive]}
                    onPress={() => {
                      setFormStarterRewardType('bonus_minutes');
                      if (formStarterRewardValue === '120') setFormStarterRewardValue('30');
                    }}
                  >
                    <Text style={[styles.radioText, formStarterRewardType === 'bonus_minutes' && styles.radioTextActive]}>
                      ⭐ Free Bonus Minutes
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputRow}>
                {formStarterRewardType === 'pro_pass' ? (
                  <>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Trial Duration (Days)</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={formStarterTrialDays}
                        onChangeText={setFormStarterTrialDays}
                      />
                    </View>

                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                      <Text style={styles.inputLabel}>Starter Minutes Allowance</Text>
                      <TextInput
                        style={styles.textInput}
                        keyboardType="numeric"
                        value={formStarterRewardValue}
                        onChangeText={setFormStarterRewardValue}
                      />
                    </View>
                  </>
                ) : (
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Free Minutes to Add</Text>
                    <TextInput
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={formStarterRewardValue}
                      onChangeText={setFormStarterRewardValue}
                    />
                  </View>
                )}
              </View>

              {/* Section: Paid Subscribers Reward */}
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerTitle}>2. Paid Subscribers Reward (Basic / Pro / Premium)</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Non-Expiring Bonus Minutes to Credit</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="e.g. 100"
                  value={formPaidRewardValue}
                  onChangeText={setFormPaidRewardValue}
                />
              </View>

              {/* Section: Target Audience & Validity */}
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerTitle}>3. Audience Eligibility & Validity</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Target Audience</Text>
                <View style={styles.radioRow}>
                  <Pressable
                    style={[styles.radioBtn, formAudience === 'old_only' && styles.radioBtnActive]}
                    onPress={() => setFormAudience('old_only')}
                  >
                    <Text style={[styles.radioText, formAudience === 'old_only' && styles.radioTextActive]}>
                      ⏳ Existing Only
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.radioBtn, formAudience === 'all' && styles.radioBtnActive]}
                    onPress={() => setFormAudience('all')}
                  >
                    <Text style={[styles.radioText, formAudience === 'all' && styles.radioTextActive]}>
                      👥 All Users
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.radioBtn, formAudience === 'new_only' && styles.radioBtnActive]}
                    onPress={() => setFormAudience('new_only')}
                  >
                    <Text style={[styles.radioText, formAudience === 'new_only' && styles.radioTextActive]}>
                      ✨ New Only
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Valid For (Days)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={formValidDays}
                    onChangeText={setFormValidDays}
                  />
                </View>

                {formAudience === 'old_only' && (
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                    <Text style={styles.inputLabel}>Old User Cutoff Date</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="YYYY-MM-DD"
                      value={formCutoffDate}
                      onChangeText={setFormCutoffDate}
                    />
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelBtn} onPress={() => setCampaignModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.submitBtn, submittingCampaign && { opacity: 0.7 }]}
                onPress={handleSaveCampaign}
                disabled={submittingCampaign}
              >
                {submittingCampaign ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingCampaign ? 'Save Changes →' : 'Launch Campaign →'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  contentCol: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: C.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  pageTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    color: C.text,
    marginBottom: 4,
  },
  pageSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: C.muted,
    maxWidth: 680,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  maintenancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  maintenancePillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  maintenancePillInactive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  maintenancePillIcon: {
    fontSize: 18,
  },
  maintenancePillTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12,
  },
  maintenancePillHint: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10,
    color: '#64748B',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0052FF',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  createBtnText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#FFFFFF',
  },
  refreshBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  kpiIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kpiValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 26,
    color: C.text,
    marginBottom: 2,
  },
  kpiLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: C.text,
    marginBottom: 2,
  },
  kpiHint: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: C.faint,
  },
  tabNavRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
    gap: 8,
  },
  tabNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  tabNavBtnActive: {
    borderBottomColor: '#0052FF',
  },
  tabNavText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#64748B',
  },
  tabNavTextActive: {
    color: '#0052FF',
  },
  filterSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: C.text,
  },
  campaignPills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  pillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  pillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: C.muted,
  },
  pillTextActive: {
    color: '#ffffff',
  },
  tableCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  thCell: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 12,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tdCell: {
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#475569',
  },
  studentName: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: C.text,
  },
  studentPhone: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: C.muted,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  tierBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#475569',
  },
  rewardBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 2,
  },
  rewardBadgeText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 12,
  },
  promoCodeText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: C.faint,
  },
  dateText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: C.muted,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: C.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    maxWidth: 420,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  paginationInfo: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: C.muted,
  },
  pageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  pageBtnDisabled: {
    opacity: 0.5,
    borderColor: '#f1f5f9',
  },
  campaignsContainer: {
    gap: 16,
  },
  campaignCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
  },
  campaignHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 10,
  },
  campaignTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0F172A',
  },
  campaignCodePill: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#0052FF',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
  },
  editCampBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0052FF',
    backgroundColor: '#EFF6FF',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  editCampBtnText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 12,
    color: '#0052FF',
  },
  sectionDivider: {
    marginTop: 10,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionDividerTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#1E293B',
  },
  toggleCampBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  btnDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  btnSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  toggleCampBtnText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 12,
  },
  campaignDesc: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#475569',
    marginBottom: 16,
    lineHeight: 19,
  },
  campConfigGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    gap: 16,
  },
  campConfigItem: {
    flex: 1,
    minWidth: 150,
  },
  campConfigLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  campConfigValue: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#0F172A',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: { backdropFilter: 'blur(4px)' },
    }),
  },
  modalBox: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
  },
  modalBoxMobile: {
    padding: 18,
    borderRadius: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0F172A',
  },
  modalSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 12,
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0F172A',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  radioBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  radioBtnActive: {
    borderColor: '#0052FF',
    backgroundColor: '#EFF6FF',
  },
  radioText: {
    ...fontStyle('outfit', 'medium'),
    fontSize: 12,
    color: '#475569',
  },
  radioTextActive: {
    color: '#0052FF',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748B',
  },
  submitBtn: {
    backgroundColor: '#0052FF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  submitBtnText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#FFFFFF',
  },
});
