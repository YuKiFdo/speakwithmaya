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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { mayaAlert } from '@/components/ui/alert-modal';
import {
  promotionsApi,
  PromotionClaim,
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
};

const PAGE_SIZE = 15;

export default function AdminPromotionsScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<PromotionsOverviewData>({
    totalComebacks: 0,
    totalClaims: 0,
    starterProPassClaims: 0,
    paidBonusClaims: 0,
    campaigns: [],
  });

  const [claims, setClaims] = useState<PromotionClaim[]>([]);
  const [totalClaims, setTotalClaims] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('ALL');

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [ovData, claimsData] = await Promise.all([
        promotionsApi.getAdminPromotionsOverview(),
        promotionsApi.getAdminPromotionClaims({
          promoCode: selectedCampaign === 'ALL' ? undefined : selectedCampaign,
          page,
          limit: PAGE_SIZE,
        }),
      ]);

      setOverview(ovData);
      setClaims(claimsData.data || []);
      setTotalClaims(claimsData.total || 0);
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
            onMenuPress={() => setSidebarOpen(true)}
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header info */}
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.pageTitle}>Promotions & Comebacks Tracker</Text>
                <Text style={styles.pageSubtitle}>
                  Monitor students returning after downtime, track 3-Day Pro Pass claims, 100 bonus minutes, and future promotional campaigns.
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
                onPress={() => fetchData()}
              >
                <Feather name="refresh-cw" size={15} color="#0284c7" style={{ marginRight: 6 }} />
                <Text style={styles.refreshBtnText}>Refresh Data</Text>
              </Pressable>
            </View>

            {/* KPI Metric Cards */}
            <View style={styles.kpiRow}>
              {/* Total Comebacks */}
              <View style={[styles.kpiCard, { borderColor: '#e2e8f0' }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#e0f2fe' }]}>
                  <Feather name="log-in" size={20} color="#0284c7" />
                </View>
                <Text style={styles.kpiValue}>{overview.totalComebacks}</Text>
                <Text style={styles.kpiLabel}>Returning Students</Text>
                <Text style={styles.kpiHint}>Logged in post-downtime</Text>
              </View>

              {/* Total Claims */}
              <View style={[styles.kpiCard, { borderColor: '#ddd6fe' }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#f3e8ff' }]}>
                  <Feather name="gift" size={20} color="#7c3aed" />
                </View>
                <Text style={styles.kpiValue}>{overview.totalClaims}</Text>
                <Text style={styles.kpiLabel}>Total Promo Claims</Text>
                <Text style={styles.kpiHint}>Across all campaigns</Text>
              </View>

              {/* Starter Pro Passes */}
              <View style={[styles.kpiCard, { borderColor: '#ddd6fe' }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#f5f3ff' }]}>
                  <Ionicons name="ribbon" size={20} color="#7c3aed" />
                </View>
                <Text style={styles.kpiValue}>{overview.starterProPassClaims}</Text>
                <Text style={styles.kpiLabel}>3-Day Pro Passes</Text>
                <Text style={styles.kpiHint}>120 mins for Free Starters</Text>
              </View>

              {/* Paid Bonus Minutes */}
              <View style={[styles.kpiCard, { borderColor: '#bbf7d0' }]}>
                <View style={[styles.kpiIconBox, { backgroundColor: '#f0fdf4' }]}>
                  <Feather name="award" size={20} color="#16a34a" />
                </View>
                <Text style={styles.kpiValue}>{overview.paidBonusClaims}</Text>
                <Text style={styles.kpiLabel}>Bonus Minutes Claims</Text>
                <Text style={styles.kpiHint}>+100 mins for Paid users</Text>
              </View>
            </View>

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

                <Pressable
                  style={[styles.pill, selectedCampaign === 'outage-comeback-nov26' && styles.pillActive]}
                  onPress={() => setSelectedCampaign('outage-comeback-nov26')}
                >
                  <Text style={[styles.pillText, selectedCampaign === 'outage-comeback-nov26' && styles.pillTextActive]}>
                    Outage Recovery (Nov 2026)
                  </Text>
                </Pressable>
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
          </ScrollView>
        </View>
      </View>
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
    gap: 12,
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
    maxWidth: 700,
    lineHeight: 20,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  refreshBtnText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#0284c7',
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
});

