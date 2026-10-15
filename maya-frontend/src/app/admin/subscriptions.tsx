import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { paymentApi } from '@/services/payment/payment-api';
import { SubscriptionRecord } from '@/services/payment/payhere-types';
import { AdminTableSkeleton } from '@/components/ui/skeleton';

export default function AdminSubscriptionsScreen() {
  const { isPhone } = useBreakpoint();
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isPhone);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    activeCount: 0,
    pastDueCount: 0,
    cancelledCount: 0,
    mrrLkr: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED'>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');

  // Payments History Modal
  const [activeSubForPayments, setActiveSubForPayments] = useState<SubscriptionRecord | null>(null);
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  // Action Loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await paymentApi.getAdminSubscriptions();
      setSubscriptions(res.subscriptions || []);
      setStats(res.stats || {
        totalSubscribers: 0,
        activeCount: 0,
        pastDueCount: 0,
        cancelledCount: 0,
        mrrLkr: 0,
      });
    } catch (err: any) {
      console.warn('Failed to fetch admin subscriptions:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      if (selectedStatus !== 'ALL' && sub.status !== selectedStatus) {
        return false;
      }
      if (selectedTier !== 'ALL' && sub.plan_tier !== selectedTier) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = sub.profile?.display_name?.toLowerCase() || '';
        const phone = sub.profile?.phone_number?.toLowerCase() || '';
        const payhereId = sub.payhere_subscription_id?.toLowerCase() || '';
        if (!name.includes(q) && !phone.includes(q) && !payhereId.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [subscriptions, selectedStatus, selectedTier, searchQuery]);

  const handleOpenPaymentsModal = async (sub: SubscriptionRecord) => {
    setActiveSubForPayments(sub);
    setIsLoadingPayments(true);
    try {
      const history = await paymentApi.getSubscriptionPayments(sub.payhere_subscription_id);
      setPaymentsHistory(history);
    } catch (err: any) {
      setPaymentsHistory([]);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleRetryPayment = async (sub: SubscriptionRecord) => {
    setActionLoadingId(sub.id);
    try {
      const res = await paymentApi.retrySubscription(sub.payhere_subscription_id);
      Alert.alert('Success', res.msg || 'Payment retry scheduled successfully.');
      await loadData();
    } catch (err: any) {
      Alert.alert('Retry Failed', err.message || 'Could not retry subscription.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelSubscription = async (sub: SubscriptionRecord) => {
    const confirmMsg = `Are you sure you want to cancel ${sub.profile?.display_name || 'this user'}'s ${sub.plan_tier.toUpperCase()} subscription? Future recurring payments will be stopped.`;
    
    const proceed = Platform.OS === 'web' 
      ? window.confirm(confirmMsg)
      : true;

    if (!proceed) return;

    setActionLoadingId(sub.id);
    try {
      const res = await paymentApi.adminCancelSubscription(sub.payhere_subscription_id);
      Alert.alert('Subscription Cancelled', res.msg || 'Subscription cancelled successfully.');
      await loadData();
    } catch (err: any) {
      Alert.alert('Cancellation Error', err.message || 'Failed to cancel subscription.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const [isReconciling, setIsReconciling] = useState(false);

  const handleReconcileNow = async () => {
    setIsReconciling(true);
    try {
      const res = await paymentApi.reconcileSubscriptions();
      const summaryMsg = `Reconciliation completed!\n• Checked Past Due: ${res.totalPastDueChecked}\n• Reinstated: ${res.pastDueReinstated}\n• Downgraded (>7d): ${res.pastDueDowngraded}\n• Quotas Refreshed: ${res.quotasReset}`;
      if (Platform.OS === 'web') {
        window.alert(summaryMsg);
      } else {
        Alert.alert('Reconciliation Done', summaryMsg);
      }
      await loadData();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to run reconciliation.';
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Error', errMsg);
      }
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.layoutRoot}>
        {/* SIDEBAR */}
        <AdminSidebar
          activeRoute="/admin/subscriptions"
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* MAIN CONTAINER */}
        <View style={styles.mainContainer}>
          <AdminTopBar
            title="Subscriptions & Recurring Revenue"
            subtitle="Manage PayHere recurring billing, track MRR, inspect payment logs, and resolve past-due accounts."
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            sidebarOpen={isSidebarOpen}
          />

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* STATS OVERVIEW CARDS */}
            <View style={styles.statsGrid}>
              {/* MRR */}
              <View style={[styles.statCard, { borderLeftColor: '#0d9488' }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>MONTHLY RECURRING REVENUE</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#f0fdfa' }]}>
                    <Feather name="dollar-sign" size={16} color="#0d9488" />
                  </View>
                </View>
                <Text style={styles.statValue}>LKR {stats.mrrLkr.toLocaleString()}</Text>
                <Text style={styles.statSubtext}>Across all active subscriptions</Text>
              </View>

              {/* ACTIVE SUBSCRIBERS */}
              <View style={[styles.statCard, { borderLeftColor: '#16a34a' }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>ACTIVE SUBSCRIBERS</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#f0fdf4' }]}>
                    <Feather name="users" size={16} color="#16a34a" />
                  </View>
                </View>
                <Text style={styles.statValue}>{stats.activeCount}</Text>
                <Text style={styles.statSubtext}>Paying recurring learners</Text>
              </View>

              {/* PAST DUE / FAILED */}
              <View style={[styles.statCard, { borderLeftColor: '#ea580c' }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>PAST DUE / RETRYING</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#fff7ed' }]}>
                    <Feather name="alert-triangle" size={16} color="#ea580c" />
                  </View>
                </View>
                <Text style={styles.statValue}>{stats.pastDueCount}</Text>
                <Text style={styles.statSubtext}>Card charged failed, retry queued</Text>
              </View>

              {/* CANCELLED */}
              <View style={[styles.statCard, { borderLeftColor: '#64748b' }]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>CANCELLED / CHURNED</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#f8fafc' }]}>
                    <Feather name="user-x" size={16} color="#64748b" />
                  </View>
                </View>
                <Text style={styles.statValue}>{stats.cancelledCount}</Text>
                <Text style={styles.statSubtext}>Inactive subscriptions</Text>
              </View>
            </View>

            {/* FILTER & SEARCH BAR */}
            <View style={styles.filterBar}>
              {/* Search Box */}
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by learner name, phone, or PayHere ID..."
                  placeholderTextColor="#94a3b8"
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                    <Feather name="x" size={14} color="#94a3b8" />
                  </Pressable>
                ) : null}
              </View>

              {/* Status Chips */}
              <View style={styles.chipGroup}>
                {(['ALL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'] as const).map((st) => (
                  <Pressable
                    key={st}
                    style={[styles.filterChip, selectedStatus === st && styles.filterChipActive]}
                    onPress={() => setSelectedStatus(st)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedStatus === st && styles.filterChipTextActive,
                      ]}
                    >
                      {st === 'ALL' ? 'All Status' : st.replace('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Actions Group */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* Reconcile Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.refreshButton,
                    { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={handleReconcileNow}
                  disabled={isReconciling}
                >
                  {isReconciling ? (
                    <ActivityIndicator size="small" color="#0284c7" style={{ marginRight: 6 }} />
                  ) : (
                    <Feather name="check-circle" size={14} color="#0284c7" style={{ marginRight: 6 }} />
                  )}
                  <Text style={[styles.refreshButtonText, { color: '#0284c7' }]}>
                    {isReconciling ? 'Reconciling...' : 'Run Reconciliation'}
                  </Text>
                </Pressable>

                {/* Refresh Button */}
                <Pressable
                  style={({ pressed }) => [styles.refreshButton, pressed && { opacity: 0.7 }]}
                  onPress={loadData}
                >
                  <Feather name="rotate-cw" size={14} color="#0d9488" style={{ marginRight: 6 }} />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </Pressable>
              </View>
            </View>

            {/* SUBSCRIBERS TABLE */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>LEARNER</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>PLAN & CYCLE</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>PAYHERE ID</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>AMOUNT</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>STATUS</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>NEXT BILLING</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'right' }]}>ACTIONS</Text>
              </View>

              {isLoading ? (
                <AdminTableSkeleton rows={6} />
              ) : filteredSubscriptions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="inbox" size={36} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>No Subscriptions Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {subscriptions.length === 0
                      ? 'No PayHere recurring subscriptions recorded yet.'
                      : 'No subscriptions match your current filter settings.'}
                  </Text>
                </View>
              ) : (
                filteredSubscriptions.map((sub, index) => {
                  const isPastDue = sub.status === 'PAST_DUE';
                  const isActive = sub.status === 'ACTIVE';
                  const isCancelled = sub.status === 'CANCELLED';
                  const isActionLoading = actionLoadingId === sub.id;

                  return (
                    <View
                      key={sub.id}
                      style={[
                        styles.tableRow,
                        index % 2 === 1 && styles.tableRowAlt,
                        index === filteredSubscriptions.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      {/* Learner Info */}
                      <View style={[styles.tableCell, { flex: 2.2 }]}>
                        <View style={styles.learnerAvatar}>
                          <Text style={styles.learnerAvatarText}>
                            {(sub.profile?.display_name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.learnerName} numberOfLines={1}>
                            {sub.profile?.display_name || 'Anonymous Learner'}
                          </Text>
                          <Text style={styles.learnerPhone} numberOfLines={1}>
                            {sub.profile?.phone_number || 'No phone'}
                          </Text>
                        </View>
                      </View>

                      {/* Plan & Cycle */}
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        <View>
                          <View
                            style={[
                              styles.tierBadge,
                              sub.plan_tier === 'premium'
                                ? { backgroundColor: '#fdf4ff' }
                                : sub.plan_tier === 'pro'
                                ? { backgroundColor: '#eff6ff' }
                                : { backgroundColor: '#f1f5f9' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.tierBadgeText,
                                sub.plan_tier === 'premium'
                                  ? { color: '#9333ea' }
                                  : sub.plan_tier === 'pro'
                                  ? { color: '#2563eb' }
                                  : { color: '#475569' },
                              ]}
                            >
                              {sub.plan_tier.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.cycleText}>{sub.billing_cycle}</Text>
                        </View>
                      </View>

                      {/* PayHere Subscription ID */}
                      <View style={[styles.tableCell, { flex: 1.3 }]}>
                        <Text style={styles.payhereIdText} numberOfLines={1}>
                          {sub.payhere_subscription_id || '—'}
                        </Text>
                        {sub.card_masked && (
                          <Text style={styles.cardMaskedText}>
                            {sub.payment_method || 'CARD'} {sub.card_masked.slice(-4)}
                          </Text>
                        )}
                      </View>

                      {/* Amount */}
                      <View style={[styles.tableCell, { flex: 1.1 }]}>
                        <Text style={styles.amountText}>
                          LKR {Number(sub.amount_lkr).toLocaleString()}
                        </Text>
                        <Text style={styles.installmentsCountText}>
                          {sub.installments_paid} paid
                        </Text>
                      </View>

                      {/* Status */}
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        <View
                          style={[
                            styles.statusPill,
                            isActive
                              ? styles.statusPillActive
                              : isPastDue
                              ? styles.statusPillPastDue
                              : styles.statusPillCancelled,
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              isActive
                                ? { backgroundColor: '#16a34a' }
                                : isPastDue
                                ? { backgroundColor: '#ea580c' }
                                : { backgroundColor: '#64748b' },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusPillText,
                              isActive
                                ? { color: '#16a34a' }
                                : isPastDue
                                ? { color: '#ea580c' }
                                : { color: '#64748b' },
                            ]}
                          >
                            {sub.status}
                          </Text>
                        </View>
                      </View>

                      {/* Next Billing Date */}
                      <View style={[styles.tableCell, { flex: 1.3 }]}>
                        <Text style={styles.nextBillingText}>
                          {sub.next_billing_date || (isCancelled ? 'Cancelled' : '—')}
                        </Text>
                      </View>

                      {/* Action Buttons */}
                      <View style={[styles.tableCell, { flex: 1.8, justifyContent: 'flex-end', gap: 6 }]}>
                        {isActionLoading ? (
                          <ActivityIndicator size="small" color="#0d9488" />
                        ) : (
                          <>
                            {/* View History Button */}
                            <Pressable
                              style={styles.actionBtnSecondary}
                              onPress={() => handleOpenPaymentsModal(sub)}
                              hitSlop={4}
                            >
                              <Feather name="file-text" size={13} color="#0284c7" />
                              <Text style={styles.actionBtnSecondaryText}>Logs</Text>
                            </Pressable>

                            {/* Retry Payment (Only if Past Due) */}
                            {isPastDue && (
                              <Pressable
                                style={styles.actionBtnRetry}
                                onPress={() => handleRetryPayment(sub)}
                                hitSlop={4}
                              >
                                <Feather name="refresh-cw" size={12} color="#ffffff" />
                                <Text style={styles.actionBtnRetryText}>Retry</Text>
                              </Pressable>
                            )}

                            {/* Cancel Button (Only if Active) */}
                            {isActive && (
                              <Pressable
                                style={styles.actionBtnDanger}
                                onPress={() => handleCancelSubscription(sub)}
                                hitSlop={4}
                              >
                                <Feather name="slash" size={12} color="#dc2626" />
                                <Text style={styles.actionBtnDangerText}>Stop</Text>
                              </Pressable>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>

        {/* PAYMENTS HISTORY MODAL */}
        <Modal
          visible={activeSubForPayments !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveSubForPayments(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Subscription Payment Receipts</Text>
                  <Text style={styles.modalSubtitle}>
                    PayHere ID: {activeSubForPayments?.payhere_subscription_id} · Learner:{' '}
                    {activeSubForPayments?.profile?.display_name}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setActiveSubForPayments(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={8}
                >
                  <Feather name="x" size={20} color="#64748b" />
                </Pressable>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {isLoadingPayments ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#0d9488" />
                    <Text style={{ marginTop: 10, color: '#64748b' }}>
                      Querying PayHere Subscription Manager API...
                    </Text>
                  </View>
                ) : paymentsHistory.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Feather name="check-circle" size={32} color="#16a34a" />
                    <Text style={[styles.emptyTitle, { marginTop: 10 }]}>No charges recorded yet</Text>
                    <Text style={styles.emptySubtitle}>
                      Initial authorization was approved. Future recurring charges will appear here.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.paymentsList}>
                    {paymentsHistory.map((pmt, idx) => (
                      <View key={idx} style={styles.paymentItemCard}>
                        <View style={styles.paymentItemTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="card" size={16} color="#0d9488" />
                            <Text style={styles.paymentId}>Payment #{pmt.payment_id}</Text>
                          </View>
                          <View style={styles.statusPillActive}>
                            <Text style={[styles.statusPillText, { color: '#16a34a' }]}>
                              {pmt.status || 'RECEIVED'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.paymentItemBottom}>
                          <Text style={styles.paymentDate}>{pmt.date}</Text>
                          <Text style={styles.paymentAmount}>
                            {pmt.currency} {Number(pmt.amount).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.modalDoneBtn}
                  onPress={() => setActiveSubForPayments(null)}
                >
                  <Text style={styles.modalDoneBtnText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  layoutRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#f8fafc',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } as any,
      default: { elevation: 1 },
    }),
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 0.5,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...fontStyle('inter', 'bold'),
    fontSize: 22,
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statSubtext: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#94a3b8',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    minWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0f172a',
  },
  chipGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  filterChipText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0d9488',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0d9488',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } as any,
      default: { elevation: 1 },
    }),
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderCell: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  learnerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  learnerAvatarText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#ffffff',
  },
  learnerName: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  learnerPhone: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tierBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10.5,
  },
  cycleText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  payhereIdText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  cardMaskedText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  amountText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12.5,
    color: '#0f172a',
  },
  installmentsCountText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillActive: {
    backgroundColor: '#f0fdf4',
  },
  statusPillPastDue: {
    backgroundColor: '#fff7ed',
  },
  statusPillCancelled: {
    backgroundColor: '#f1f5f9',
  },
  statusPillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
  },
  nextBillingText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#475569',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 4,
  },
  actionBtnSecondaryText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#0284c7',
  },
  actionBtnRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#ea580c',
    gap: 4,
  },
  actionBtnRetryText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#ffffff',
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 4,
  },
  actionBtnDangerText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#dc2626',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  loadingText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15,
    color: '#334155',
    marginTop: 10,
  },
  emptySubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' } as any,
      default: { elevation: 10 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 16,
    color: '#0f172a',
  },
  modalSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  paymentsList: {
    gap: 12,
  },
  paymentItemCard: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paymentItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentId: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  paymentItemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDate: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
  },
  paymentAmount: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#0d9488',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'flex-end',
  },
  modalDoneBtn: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 7,
  },
  modalDoneBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#ffffff',
  },
});
