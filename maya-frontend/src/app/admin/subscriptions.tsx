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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { paymentApi } from '@/services/payment/payment-api';
import { SubscriptionRecord, AdminOrderRecord, TopUpPackageStats } from '@/services/payment/payhere-types';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { mayaAlert } from '@/components/ui/alert-modal';

type AdminViewTab = 'subscriptions' | 'renewals' | 'topups';

export default function AdminSubscriptionsScreen() {
  const { isPhone } = useBreakpoint();
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isPhone);
  const [activeTab, setActiveTab] = useState<AdminViewTab>('subscriptions');
  const [isLoading, setIsLoading] = useState(true);

  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [stats, setStats] = useState({
    totalSubscribers: 0,
    activeCount: 0,
    pastDueCount: 0,
    cancelledCount: 0,
    mrrLkr: 0,
    topUpRevenueLkr: 0,
    topUpMinutesSold: 0,
    topUpOrdersCount: 0,
    topUpPackages: {
      '30-min': { count: 0, revenue: 0, minutes: 0 },
      '120-min': { count: 0, revenue: 0, minutes: 0 },
      '300-min': { count: 0, revenue: 0, minutes: 0 },
    } as Record<string, TopUpPackageStats>,
    renewalsCount: 0,
    renewalsSucceeded: 0,
    renewalsFailed: 0,
    renewalsRevenueLkr: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED'>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');

  // Payments History Modal
  const [activeSubForPayments, setActiveSubForPayments] = useState<{
    id: string;
    userId: string;
    name?: string;
    phone?: string;
    plan?: string;
  } | null>(null);
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  // Action Loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await paymentApi.getAdminSubscriptions();
      setSubscriptions(res.subscriptions || []);
      setOrders(res.orders || []);
      if (res.stats) {
        setStats({
          totalSubscribers: res.stats.totalSubscribers || 0,
          activeCount: res.stats.activeCount || 0,
          pastDueCount: res.stats.pastDueCount || 0,
          cancelledCount: res.stats.cancelledCount || 0,
          mrrLkr: res.stats.mrrLkr || 0,
          topUpRevenueLkr: res.stats.topUpRevenueLkr || 0,
          topUpMinutesSold: res.stats.topUpMinutesSold || 0,
          topUpOrdersCount: res.stats.topUpOrdersCount || 0,
          topUpPackages: res.stats.topUpPackages || {
            '30-min': { count: 0, revenue: 0, minutes: 0 },
            '120-min': { count: 0, revenue: 0, minutes: 0 },
            '300-min': { count: 0, revenue: 0, minutes: 0 },
          },
          renewalsCount: res.stats.renewalsCount || 0,
          renewalsSucceeded: res.stats.renewalsSucceeded || 0,
          renewalsFailed: res.stats.renewalsFailed || 0,
          renewalsRevenueLkr: res.stats.renewalsRevenueLkr || 0,
        });
      }
    } catch (err: any) {
      console.warn('Failed to fetch admin subscriptions:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Subscriptions
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
        const card = sub.card_masked?.toLowerCase() || '';
        if (!name.includes(q) && !phone.includes(q) && !card.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [subscriptions, selectedStatus, selectedTier, searchQuery]);

  // Renewal Orders (Backend Recurring Charges)
  const renewalOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.order_type !== 'subscription_renewal') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = o.profile?.display_name?.toLowerCase() || '';
        const phone = o.profile?.phone_number?.toLowerCase() || '';
        const orderId = o.gateway_payment_id?.toLowerCase() || '';
        if (!name.includes(q) && !phone.includes(q) && !orderId.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, searchQuery]);

  // Talk Time Top-Up Orders
  const topUpOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.order_type !== 'add_on_topup') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = o.profile?.display_name?.toLowerCase() || '';
        const phone = o.profile?.phone_number?.toLowerCase() || '';
        const pkg = o.add_on_package_id?.toLowerCase() || '';
        if (!name.includes(q) && !phone.includes(q) && !pkg.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, searchQuery]);

  const handleOpenPaymentsModal = async (target: {
    id: string;
    userId: string;
    name?: string;
    phone?: string;
    plan?: string;
  }) => {
    setActiveSubForPayments(target);
    setIsLoadingPayments(true);
    try {
      const history = await paymentApi.getSubscriptionPayments(target.id || target.userId);
      setPaymentsHistory(history);
    } catch {
      setPaymentsHistory([]);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleRetryPayment = async (sub: SubscriptionRecord) => {
    setActionLoadingId(sub.id);
    try {
      const res = await paymentApi.retrySubscription(sub.id || sub.user_id);
      await mayaAlert.success(res.msg || 'Payment retry successfully charged and completed!', 'Retry Success');
      await loadData();
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Could not retry subscription.', 'Retry Failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

  const handleVerifyOrder = async (orderId: string) => {
    setVerifyingOrderId(orderId);
    try {
      const res = await paymentApi.verifyOrder(orderId);
      if (res.success) {
        await mayaAlert.success(
          res.message || 'Order successfully verified and activated with PayHere gateway!',
          'Gateway Reconciled'
        );
        await loadData();
      } else {
        await mayaAlert.alert(
          res.message || 'Payment has not been completed or received at gateway yet.',
          'Gateway Status',
          'info'
        );
        await loadData();
      }
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Failed to verify order with gateway.', 'Verification Error');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  const handleCancelSubscription = async (sub: SubscriptionRecord) => {
    const confirmed = await mayaAlert.confirm({
      title: 'Cancel Subscription',
      message: `Are you sure you want to cancel ${sub.profile?.display_name || 'this user'}'s ${sub.plan_tier.toUpperCase()} subscription? Automated recurring renewals will be stopped.`,
      confirmText: 'Cancel Subscription',
      cancelText: 'Keep Plan',
      type: 'warning',
      isDestructive: true,
    });

    if (!confirmed) return;

    setActionLoadingId(sub.id);
    try {
      const res = await paymentApi.adminCancelSubscription(sub.id || sub.user_id);
      await mayaAlert.success(res.msg || 'Subscription cancelled successfully.', 'Subscription Cancelled');
      await loadData();
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Failed to cancel subscription.', 'Cancellation Error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReconcileNow = async () => {
    setIsReconciling(true);
    try {
      const res = await paymentApi.reconcileSubscriptions();
      const renewalInfo = res.renewalsAttempted
        ? `\n• Renewals Billed Today: ${res.renewalsSucceeded || 0} succeeded, ${res.renewalsFailed || 0} failed`
        : '\n• Renewals Billed Today: 0 (No active cards due)';
      const recoveryInfo = res.pendingOrdersSwept
        ? `\n• Gateway Sweeper: Checked ${res.pendingOrdersSwept} pending orders (${res.pendingOrdersRecovered || 0} recovered)`
        : '';
      const summaryMsg = `Reconciliation completed!\n• Checked Past Due: ${res.totalPastDueChecked}\n• Reinstated: ${res.pastDueReinstated}\n• Downgraded (>7d): ${res.pastDueDowngraded}\n• Quotas Refreshed: ${res.quotasReset}${renewalInfo}${recoveryInfo}`;
      await mayaAlert.success(summaryMsg, 'Backend Reconciliation Done');
      await loadData();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to run reconciliation.';
      await mayaAlert.error(errMsg, 'Reconciliation Error');
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
            subtitle="Backend-driven recurring billing engine using PayHere preapproved tokens, auto-renewals, and talk-time telemetry."
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            sidebarOpen={isSidebarOpen}
          />

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* STATS OVERVIEW CARDS */}
            <View style={styles.statsGrid}>
              {/* MRR */}
              <View style={[styles.statCard]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>MONTHLY RECURRING REVENUE</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#f0fdfa' }]}>
                    <Feather name="dollar-sign" size={16} color="#0d9488" />
                  </View>
                </View>
                <Text style={styles.statValue}>LKR {stats.mrrLkr.toLocaleString()}</Text>
                <Text style={styles.statSubtext}>Across active recurring plans</Text>
              </View>

              {/* ACTIVE PRE-APPROVED ACCOUNTS */}
              <View style={[styles.statCard]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>TOKENIZED CARDS (AUTO-RENEW)</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#f0fdf4' }]}>
                    <Feather name="credit-card" size={16} color="#16a34a" />
                  </View>
                </View>
                <Text style={styles.statValue}>{stats.activeCount}</Text>
                <Text style={styles.statSubtext}>Pre-approved cards on file</Text>
              </View>

              {/* BACKEND RENEWALS */}
              <View style={[styles.statCard]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>BACKEND AUTO-RENEWALS</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#eff6ff' }]}>
                    <Feather name="repeat" size={16} color="#2563eb" />
                  </View>
                </View>
                <Text style={styles.statValue}>{stats.renewalsCount}</Text>
                <Text style={styles.statSubtext}>
                  {stats.renewalsSucceeded} successful · {stats.renewalsFailed} failed
                </Text>
              </View>

              {/* TALK TIME TOP-UPS */}
              <View style={[styles.statCard]}>
                <View style={styles.statCardHeader}>
                  <Text style={styles.statLabel}>TALK TIME TOP-UP REVENUE</Text>
                  <View style={[styles.statIconBadge, { backgroundColor: '#fffbeb' }]}>
                    <Feather name="clock" size={16} color="#d97706" />
                  </View>
                </View>
                <Text style={styles.statValue}>LKR {stats.topUpRevenueLkr.toLocaleString()}</Text>
                <Text style={styles.statSubtext}>
                  +{stats.topUpMinutesSold} mins sold ({stats.topUpOrdersCount} orders)
                </Text>
              </View>
            </View>

            {/* TAB SELECTOR: Subscriptions vs Renewal History vs Talk-Time Top-Ups */}
            <View style={styles.tabSelectorBar}>
              <Pressable
                style={[styles.tabSelectorItem, activeTab === 'subscriptions' && styles.tabSelectorItemActive]}
                onPress={() => setActiveTab('subscriptions')}
              >
                <Feather
                  name="shield"
                  size={15}
                  color={activeTab === 'subscriptions' ? '#0d9488' : '#64748b'}
                />
                <Text
                  style={[
                    styles.tabSelectorItemText,
                    activeTab === 'subscriptions' && styles.tabSelectorItemTextActive,
                  ]}
                >
                  Recurring Subscriptions ({subscriptions.length})
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tabSelectorItem, activeTab === 'renewals' && styles.tabSelectorItemActive]}
                onPress={() => setActiveTab('renewals')}
              >
                <Feather
                  name="rotate-cw"
                  size={15}
                  color={activeTab === 'renewals' ? '#0d9488' : '#64748b'}
                />
                <Text
                  style={[
                    styles.tabSelectorItemText,
                    activeTab === 'renewals' && styles.tabSelectorItemTextActive,
                  ]}
                >
                  Renewal Run History ({renewalOrders.length})
                </Text>
              </Pressable>

              <Pressable
                style={[styles.tabSelectorItem, activeTab === 'topups' && styles.tabSelectorItemActive]}
                onPress={() => setActiveTab('topups')}
              >
                <Feather
                  name="zap"
                  size={15}
                  color={activeTab === 'topups' ? '#0d9488' : '#64748b'}
                />
                <Text
                  style={[
                    styles.tabSelectorItemText,
                    activeTab === 'topups' && styles.tabSelectorItemTextActive,
                  ]}
                >
                  Extra Minutes Top-Ups ({topUpOrders.length})
                </Text>
              </Pressable>
            </View>

            {/* MINUTES BUYING THINGS: Top-Up Package Highlights (Rendered when in 'topups' tab) */}
            {activeTab === 'topups' && (
              <View style={styles.packageCardsGrid}>
                {/* 30-min Pack */}
                <View style={styles.packageCard}>
                  <View style={styles.packageCardTop}>
                    <View style={[styles.packageBadge, { backgroundColor: '#eff6ff' }]}>
                      <Text style={[styles.packageBadgeText, { color: '#2563eb' }]}>+30 MIN PACK</Text>
                    </View>
                    <Text style={styles.packagePrice}>LKR 300</Text>
                  </View>
                  <Text style={styles.packageTitle}>Quick Practice Booster</Text>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Total Sold:</Text>
                    <Text style={styles.packageMetricValue}>
                      {stats.topUpPackages['30-min']?.count || 0} orders
                    </Text>
                  </View>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Minutes Delivered:</Text>
                    <Text style={styles.packageMetricValue}>
                      +{stats.topUpPackages['30-min']?.minutes || 0} mins
                    </Text>
                  </View>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Revenue Generated:</Text>
                    <Text style={[styles.packageMetricValue, { color: '#0d9488' }]}>
                      LKR {(stats.topUpPackages['30-min']?.revenue || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* 120-min Pack */}
                <View style={[styles.packageCard, { borderColor: '#93c5fd' }]}>
                  <View style={styles.packageCardTop}>
                    <View style={[styles.packageBadge, { backgroundColor: '#f0fdf4' }]}>
                      <Text style={[styles.packageBadgeText, { color: '#16a34a' }]}>+120 MIN PACK</Text>
                    </View>
                    <Text style={styles.packagePrice}>LKR 900</Text>
                  </View>
                  <Text style={styles.packageTitle}>Weekly Talk Booster</Text>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Total Sold:</Text>
                    <Text style={styles.packageMetricValue}>
                      {stats.topUpPackages['120-min']?.count || 0} orders
                    </Text>
                  </View>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Minutes Delivered:</Text>
                    <Text style={styles.packageMetricValue}>
                      +{stats.topUpPackages['120-min']?.minutes || 0} mins
                    </Text>
                  </View>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Revenue Generated:</Text>
                    <Text style={[styles.packageMetricValue, { color: '#0d9488' }]}>
                      LKR {(stats.topUpPackages['120-min']?.revenue || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* 300-min Pack */}
                <View style={[styles.packageCard, { borderColor: '#d8b4fe' }]}>
                  <View style={styles.packageCardTop}>
                    <View style={[styles.packageBadge, { backgroundColor: '#fdf4ff' }]}>
                      <Text style={[styles.packageBadgeText, { color: '#9333ea' }]}>+300 MIN PACK</Text>
                    </View>
                    <Text style={styles.packagePrice}>LKR 2,000</Text>
                  </View>
                  <Text style={styles.packageTitle}>Intensive Fluency Pack</Text>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Total Sold:</Text>
                    <Text style={styles.packageMetricValue}>
                      {stats.topUpPackages['300-min']?.count || 0} orders
                    </Text>
                  </View>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Minutes Delivered:</Text>
                    <Text style={styles.packageMetricValue}>
                      +{stats.topUpPackages['300-min']?.minutes || 0} mins
                    </Text>
                  </View>
                  <View style={styles.packageMetricsRow}>
                    <Text style={styles.packageMetricLabel}>Revenue Generated:</Text>
                    <Text style={[styles.packageMetricValue, { color: '#0d9488' }]}>
                      LKR {(stats.topUpPackages['300-min']?.revenue || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* FILTER & SEARCH BAR */}
            <View style={styles.filterBar}>
              {/* Search Box */}
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={
                    activeTab === 'subscriptions'
                      ? 'Search by learner name, phone, or masked card...'
                      : activeTab === 'renewals'
                      ? 'Search renewal by learner, phone, or order ID...'
                      : 'Search top-up by learner, phone, or package...'
                  }
                  placeholderTextColor="#94a3b8"
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                    <Feather name="x" size={14} color="#94a3b8" />
                  </Pressable>
                ) : null}
              </View>

              {/* Status Chips (only on subscriptions tab) */}
              {activeTab === 'subscriptions' && (
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
              )}

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
                    {isReconciling ? 'Running Renewal Engine...' : 'Run Auto-Billing Now'}
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

            {/* ==================================================================== */}
            {/* VIEW 1: RECURRING SUBSCRIPTIONS TABLE (PREAPPROVAL TOKENIZED CARDS)  */}
            {/* ==================================================================== */}
            {activeTab === 'subscriptions' && (
              <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
                  <View style={{ minWidth: 1040, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>LEARNER</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>PLAN & CYCLE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>PRE-APPROVED CARD</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>AMOUNT</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>STATUS</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>NEXT RENEWAL</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.7, textAlign: 'right' }]}>ACTIONS</Text>
                </View>

                {isLoading ? (
                  <AdminTableSkeleton rows={6} />
                ) : filteredSubscriptions.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Feather name="inbox" size={36} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>No Subscriptions Found</Text>
                    <Text style={styles.emptySubtitle}>
                      {subscriptions.length === 0
                        ? 'No pre-approved recurring subscriptions recorded yet.'
                        : 'No subscriptions match your current filter settings.'}
                    </Text>
                  </View>
                ) : (
                  filteredSubscriptions.map((sub, index) => {
                    const isPastDue = sub.status === 'PAST_DUE';
                    const isActive = sub.status === 'ACTIVE';
                    const isCancelled = sub.status === 'CANCELLED';
                    const isActionLoading = actionLoadingId === sub.id;
                    const hasToken = Boolean(sub.customer_token);

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

                        {/* Card on file / Preapproved Token */}
                        <View style={[styles.tableCell, { flex: 1.6 }]}>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="card" size={15} color="#0d9488" />
                              <Text style={styles.cardMaskedText}>
                                {sub.payment_method || 'CARD'} ···· {(sub.card_masked || '4582').slice(-4)}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                              <View
                                style={[
                                  styles.tokenPill,
                                  hasToken ? { backgroundColor: '#ecfdf5' } : { backgroundColor: '#f1f5f9' },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.tokenPillText,
                                    hasToken ? { color: '#059669' } : { color: '#64748b' },
                                  ]}
                                >
                                  {hasToken ? 'Tokenized (1-Click)' : 'Standard'}
                                </Text>
                              </View>
                              {sub.card_holder_name && (
                                <Text style={styles.cardHolderText} numberOfLines={1}>
                                  · {sub.card_holder_name}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>

                        {/* Amount */}
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.3 }]}>
                          <Text style={styles.amountText}>
                            LKR {Number(sub.amount_lkr).toLocaleString()}
                          </Text>
                          <Text style={styles.installmentsCountText}>
                            {sub.installments_paid || 1} cycle{(sub.installments_paid || 1) > 1 ? 's' : ''} paid
                          </Text>
                        </View>

                        {/* Status */}
                        <View style={[styles.tableCell, { flex: 1.1 }]}>
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
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.3 }]}>
                          <Text style={styles.nextBillingText}>
                            {sub.next_billing_date || (isCancelled ? 'Cancelled' : '-')}
                          </Text>
                          {isActive && sub.next_billing_date && (
                            <Text style={styles.nextBillingSubtext}>
                              Auto-charged by server
                            </Text>
                          )}
                        </View>

                        {/* Action Buttons */}
                        <View style={[styles.tableCell, { flex: 1.7, justifyContent: 'flex-end', gap: 6 }]}>
                          {isActionLoading ? (
                            <ActivityIndicator size="small" color="#0d9488" />
                          ) : (
                            <>
                              {/* View History Button */}
                              <Pressable
                                style={styles.actionBtnSecondary}
                                onPress={() =>
                                  handleOpenPaymentsModal({
                                    id: sub.id,
                                    userId: sub.user_id,
                                    name: sub.profile?.display_name,
                                    phone: sub.profile?.phone_number,
                                    plan: sub.plan_tier,
                                  })
                                }
                                hitSlop={4}
                              >
                                <Feather name="file-text" size={13} color="#0284c7" />
                                <Text style={styles.actionBtnSecondaryText}>History</Text>
                              </Pressable>

                              {/* Retry Payment (If Past Due) */}
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

                              {/* Cancel Button (If Active) */}
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
            )}

            {/* ==================================================================== */}
            {/* VIEW 2: RENEWAL RUN HISTORY (WHEN RENEWALS HAPPEN HISTORY)           */}
            {/* ==================================================================== */}
            {activeTab === 'renewals' && (
              <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
                  <View style={{ minWidth: 1040, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>LEARNER</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>PLAN</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>AMOUNT</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>CARD CHARGED</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>RENEWAL TIMESTAMP</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>STATUS</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'right' }]}>ACTIONS</Text>
                </View>

                {isLoading ? (
                  <AdminTableSkeleton rows={6} />
                ) : renewalOrders.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Feather name="clock" size={36} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>No Renewal Runs Recorded</Text>
                    <Text style={styles.emptySubtitle}>
                      Automated recurring charges executed by our backend reconciliation engine will appear here.
                    </Text>
                  </View>
                ) : (
                  renewalOrders.map((ord, index) => {
                    const isSuccess = ord.status === 'completed';
                    const isFailed = ord.status === 'failed';
                    const cardNum = ord.raw_payload?.card_no || ord.raw_payload?.card_masked || '';
                    const cardMethod = ord.raw_payload?.method || 'CARD';

                    return (
                      <View
                        key={ord.id}
                        style={[
                          styles.tableRow,
                          index % 2 === 1 && styles.tableRowAlt,
                          index === renewalOrders.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        {/* Learner Info */}
                        <View style={[styles.tableCell, { flex: 2.2 }]}>
                          <View style={styles.learnerAvatar}>
                            <Text style={styles.learnerAvatarText}>
                              {(ord.profile?.display_name || 'U').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.learnerName} numberOfLines={1}>
                              {ord.profile?.display_name || 'Anonymous Learner'}
                            </Text>
                            <Text style={styles.learnerPhone} numberOfLines={1}>
                              {ord.profile?.phone_number || 'No phone'}
                            </Text>
                          </View>
                        </View>

                        {/* Plan */}
                        <View style={[styles.tableCell, { flex: 1.2 }]}>
                          <View
                            style={[
                              styles.tierBadge,
                              ord.plan_tier === 'premium'
                                ? { backgroundColor: '#fdf4ff' }
                                : ord.plan_tier === 'pro'
                                ? { backgroundColor: '#eff6ff' }
                                : { backgroundColor: '#f1f5f9' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.tierBadgeText,
                                ord.plan_tier === 'premium'
                                  ? { color: '#9333ea' }
                                  : ord.plan_tier === 'pro'
                                  ? { color: '#2563eb' }
                                  : { color: '#475569' },
                              ]}
                            >
                              {(ord.plan_tier || 'PRO').toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Amount */}
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.3 }]}>
                          <Text style={styles.amountText}>
                            LKR {Number(ord.amount_lkr).toLocaleString()}
                          </Text>
                          <Text style={styles.installmentsCountText}>
                            {ord.plan_tier === 'card-update' || ord.amount_lkr === 0
                              ? 'Card verification'
                              : 'Recurring cycle'}
                          </Text>
                        </View>

                        {/* Card Charged */}
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.6 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="card-outline" size={15} color="#0d9488" />
                            <Text style={styles.cardMaskedText}>
                              {cardNum && cardNum.replace(/[^0-9]/g, '').length >= 4
                                ? `${cardMethod} ${cardNum.slice(-4)}`
                                : cardMethod && cardMethod !== 'CARD'
                                ? `${cardMethod} Card`
                                : 'Card on File'}
                            </Text>
                          </View>
                          {ord.payment_gateway === 'payhere_token' && (
                            <Text style={styles.tokenTagText}>1-Click Automated Token</Text>
                          )}
                        </View>

                        {/* Renewal Timestamp */}
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.6 }]}>
                          <Text style={styles.nextBillingText}>
                            {new Date(ord.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Text>
                          <Text style={styles.nextBillingSubtext}>
                            {new Date(ord.created_at).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </Text>
                        </View>

                        {/* Status */}
                        <View style={[styles.tableCell, { flex: 1.1 }]}>
                          <View
                            style={[
                              styles.statusPill,
                              isSuccess
                                ? styles.statusPillActive
                                : isFailed
                                ? styles.statusPillPastDue
                                : styles.statusPillCancelled,
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                isSuccess
                                  ? { backgroundColor: '#16a34a' }
                                  : isFailed
                                  ? { backgroundColor: '#ea580c' }
                                  : { backgroundColor: '#64748b' },
                              ]}
                            />
                            <Text
                              style={[
                                styles.statusPillText,
                                isSuccess
                                  ? { color: '#16a34a' }
                                  : isFailed
                                  ? { color: '#ea580c' }
                                  : { color: '#64748b' },
                              ]}
                            >
                              {ord.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Order ID & Actions */}
                        <View style={[styles.tableCell, { flex: 1.8, justifyContent: 'flex-end', gap: 6 }]}>
                          {!isSuccess && (
                            <Pressable
                              style={styles.actionBtnSync}
                              onPress={() => handleVerifyOrder(ord.gateway_payment_id || ord.id)}
                              disabled={verifyingOrderId === (ord.gateway_payment_id || ord.id)}
                              hitSlop={4}
                            >
                              {verifyingOrderId === (ord.gateway_payment_id || ord.id) ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                              ) : (
                                <>
                                  <Feather name="refresh-cw" size={11} color="#ffffff" />
                                  <Text style={styles.actionBtnSyncText}>Sync Gateway</Text>
                                </>
                              )}
                            </Pressable>
                          )}
                          <Pressable
                            style={styles.actionBtnSecondary}
                            onPress={() =>
                              handleOpenPaymentsModal({
                                id: ord.id,
                                userId: ord.user_id,
                                name: ord.profile?.display_name,
                                phone: ord.profile?.phone_number,
                                plan: ord.plan_tier || 'Renewal',
                              })
                            }
                            hitSlop={4}
                          >
                            <Feather name="file-text" size={13} color="#0284c7" />
                            <Text style={styles.actionBtnSecondaryText}>Receipt</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* ==================================================================== */}
            {/* VIEW 3: EXTRA TALK TIME TOP-UPS ("MINUTES BUYING THINGS")            */}
            {/* ==================================================================== */}
            {activeTab === 'topups' && (
              <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%' }}>
                  <View style={{ minWidth: 1040, flex: 1 }}>
                    <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>LEARNER</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>PACKAGE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>MINUTES CREDITED</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>PRICE PAID</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>PAYMENT METHOD</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>PURCHASE DATE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>STATUS</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'right' }]}>ACTIONS</Text>
                </View>

                {isLoading ? (
                  <AdminTableSkeleton rows={6} />
                ) : topUpOrders.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Feather name="zap" size={36} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>No Talk Time Top-Ups Yet</Text>
                    <Text style={styles.emptySubtitle}>
                      When learners buy +30 min, +120 min, or +300 min extra talk time packs, transactions appear here.
                    </Text>
                  </View>
                ) : (
                  topUpOrders.map((ord, index) => {
                    const isSuccess = ord.status === 'completed';
                    const pkgId = ord.add_on_package_id || 'Top-Up';
                    const pkgBadgeColor =
                      pkgId === '300-min'
                        ? { bg: '#fdf4ff', text: '#9333ea' }
                        : pkgId === '120-min'
                        ? { bg: '#f0fdf4', text: '#16a34a' }
                        : { bg: '#eff6ff', text: '#2563eb' };

                    return (
                      <View
                        key={ord.id}
                        style={[
                          styles.tableRow,
                          index % 2 === 1 && styles.tableRowAlt,
                          index === topUpOrders.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        {/* Learner Info */}
                        <View style={[styles.tableCell, { flex: 2.2 }]}>
                          <View style={styles.learnerAvatar}>
                            <Text style={styles.learnerAvatarText}>
                              {(ord.profile?.display_name || 'U').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.learnerName} numberOfLines={1}>
                              {ord.profile?.display_name || 'Anonymous Learner'}
                            </Text>
                            <Text style={styles.learnerPhone} numberOfLines={1}>
                              {ord.profile?.phone_number || 'No phone'}
                            </Text>
                          </View>
                        </View>

                        {/* Package Tag */}
                        <View style={[styles.tableCell, { flex: 1.4 }]}>
                          <View style={[styles.tierBadge, { backgroundColor: pkgBadgeColor.bg }]}>
                            <Text style={[styles.tierBadgeText, { color: pkgBadgeColor.text }]}>
                              +{ord.minutes_credited || (pkgId === '300-min' ? 300 : pkgId === '120-min' ? 120 : 30)} MIN PACK
                            </Text>
                          </View>
                        </View>

                        {/* Minutes Credited */}
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.2 }]}>
                          <Text style={[styles.amountText, { color: '#0d9488' }]}>
                            +{ord.minutes_credited || 30} mins
                          </Text>
                          <Text style={styles.installmentsCountText}>Added to talk time</Text>
                        </View>

                        {/* Price Paid */}
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.2 }]}>
                          <Text style={styles.amountText}>
                            LKR {Number(ord.amount_lkr).toLocaleString()}
                          </Text>
                        </View>

                        {/* Payment Method */}
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.5 }]}>
                          <Text style={styles.cardMaskedText}>
                            {ord.payment_gateway === 'payhere_token' ? '⚡ 1-Click Saved Card' : '💳 PayHere Gateway'}
                          </Text>
                          {ord.gateway_payment_id && (
                            <Text style={styles.tokenTagText} numberOfLines={1}>
                              {ord.gateway_payment_id}
                            </Text>
                          )}
                        </View>

                        {/* Purchase Date */}
                        <View style={[styles.tableCell, styles.tableCellStack, { flex: 1.5 }]}>
                          <Text style={styles.nextBillingText}>
                            {new Date(ord.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Text>
                          <Text style={styles.nextBillingSubtext}>
                            {new Date(ord.created_at).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </Text>
                        </View>

                        {/* Status */}
                        <View style={[styles.tableCell, { flex: 1.1 }]}>
                          <View
                            style={[
                              styles.statusPill,
                              isSuccess ? styles.statusPillActive : styles.statusPillPastDue,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                isSuccess ? { color: '#16a34a' } : { color: '#ea580c' },
                              ]}
                            >
                              {ord.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Actions */}
                        <View style={[styles.tableCell, { flex: 1.8, justifyContent: 'flex-end', gap: 6 }]}>
                          {!isSuccess && (
                            <Pressable
                              style={styles.actionBtnSync}
                              onPress={() => handleVerifyOrder(ord.gateway_payment_id || ord.id)}
                              disabled={verifyingOrderId === (ord.gateway_payment_id || ord.id)}
                              hitSlop={4}
                            >
                              {verifyingOrderId === (ord.gateway_payment_id || ord.id) ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                              ) : (
                                <>
                                  <Feather name="refresh-cw" size={11} color="#ffffff" />
                                  <Text style={styles.actionBtnSyncText}>Sync Gateway</Text>
                                </>
                              )}
                            </Pressable>
                          )}
                          <Pressable
                            style={styles.actionBtnSecondary}
                            onPress={() =>
                              handleOpenPaymentsModal({
                                id: ord.id,
                                userId: ord.user_id,
                                name: ord.profile?.display_name,
                                phone: ord.profile?.phone_number,
                                plan: `Top-up +${ord.minutes_credited}m`,
                              })
                            }
                            hitSlop={4}
                          >
                            <Feather name="file-text" size={13} color="#0284c7" />
                            <Text style={styles.actionBtnSecondaryText}>Receipt</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
                  </View>
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </View>

        {/* ==================================================================== */}
        {/* PAYMENTS & RENEWAL RECEIPT TIMELINE MODAL                            */}
        {/* ==================================================================== */}
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
                  <Text style={styles.modalTitle}>Payment & Renewal Receipts</Text>
                  <Text style={styles.modalSubtitle}>
                    Learner: {activeSubForPayments?.name || 'Learner'} ({activeSubForPayments?.phone || 'No phone'}) ·{' '}
                    {activeSubForPayments?.plan?.toUpperCase()}
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
                      Retrieving transaction ledger from database...
                    </Text>
                  </View>
                ) : paymentsHistory.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Feather name="check-circle" size={32} color="#16a34a" />
                    <Text style={[styles.emptyTitle, { marginTop: 10 }]}>No charges recorded yet</Text>
                    <Text style={styles.emptySubtitle}>
                      Preapproval card authorization was established. Automated monthly charges and extra minutes top-ups will appear here.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.paymentsList}>
                    {paymentsHistory.map((pmt, idx) => (
                      <View key={idx} style={styles.paymentItemCard}>
                        <View style={styles.paymentItemTop}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons
                              name={pmt.order_type === 'add_on_topup' ? 'time' : 'card'}
                              size={16}
                              color="#0d9488"
                            />
                            <Text style={styles.paymentId}>
                              {pmt.order_type === 'add_on_topup'
                                ? `Top-Up (+${pmt.minutes_credited || 30} mins)`
                                : pmt.order_type === 'subscription_renewal'
                                ? 'Automated Monthly Renewal'
                                : 'Initial Subscription Activation'}
                            </Text>
                          </View>
                          <View
                            style={
                              pmt.status === 'RECEIVED' || pmt.status === 'completed'
                                ? styles.statusPillActive
                                : styles.statusPillPastDue
                            }
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                pmt.status === 'RECEIVED' || pmt.status === 'completed'
                                  ? { color: '#16a34a' }
                                  : { color: '#ea580c' },
                              ]}
                            >
                              {pmt.status}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.paymentItemBottom}>
                          <View>
                            <Text style={styles.paymentDate}>
                              {new Date(pmt.date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                            <Text style={styles.tokenTagText}>
                              ID: {pmt.payment_id || pmt.order_id || '-'} · {pmt.card_no ? `Card ···· ${pmt.card_no.slice(-4)}` : pmt.payment_method}
                            </Text>
                          </View>
                          <Text style={styles.paymentAmount}>
                            {pmt.currency || 'LKR'} {Number(pmt.amount).toLocaleString()}
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
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    // borderWidth: 1,
    // borderColor: '#e2e8f0',
    // borderLeftWidth: 4,
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
  tabSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    gap: 4,
  },
  tabSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabSelectorItemActive: {
    backgroundColor: '#f0fdfa',
  },
  tabSelectorItemText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748b',
  },
  tabSelectorItemTextActive: {
    ...fontStyle('inter', 'semiBold'),
    color: '#0d9488',
  },
  packageCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  packageCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } as any,
      default: { elevation: 1 },
    }),
  },
  packageCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  packageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  packageBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    letterSpacing: 0.5,
  },
  packagePrice: {
    ...fontStyle('inter', 'bold'),
    fontSize: 16,
    color: '#0f172a',
  },
  packageTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
  },
  packageMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  packageMetricLabel: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
  },
  packageMetricValue: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0f172a',
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
    letterSpacing: 0.5,
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
  tableCellStack: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  learnerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  tierBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    letterSpacing: 0.5,
  },
  cycleText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
  cardMaskedText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#1e293b',
  },
  tokenPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tokenPillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10,
  },
  tokenTagText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
  },
  cardHolderText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },
  amountText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  installmentsCountText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 5,
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
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10.5,
    letterSpacing: 0.5,
  },
  nextBillingText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#0f172a',
    lineHeight: 18,
  },
  nextBillingSubtext: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  actionBtnSecondaryText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#0284c7',
  },
  actionBtnSync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: '#0d9488',
  },
  actionBtnSyncText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11.5,
    color: '#ffffff',
  },
  actionBtnRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: '#ea580c',
  },
  actionBtnRetryText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11.5,
    color: '#ffffff',
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  actionBtnDangerText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#dc2626',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 15,
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12.5,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 400,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
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
