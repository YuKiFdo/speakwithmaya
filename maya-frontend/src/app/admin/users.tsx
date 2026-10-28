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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { AdminSessionTranscriptAndPlayer } from '@/components/admin/AdminSessionTranscriptAndPlayer';
import { mayaAlert } from '@/components/ui/alert-modal';

export interface TestAccountItem {
  id: string;
  name: string;
  phoneNumber: string;
  plan: 'starter' | 'basic' | 'pro' | 'premium' | 'unlimited';
  minutesBalance: number;
  createdAt?: string;
}

export interface AdminComplaintItem {
  id: string;
  userId?: string;
  displayName: string;
  phoneNumber: string;
  email?: string | null;
  avatarUrl?: string | null;
  planTier: string;
  level?: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt?: string;
}

export interface UserSummaryItem {
  id: string;
  phoneNumber: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  level: string;
  goal: string;
  challenge: string;
  planTier: 'starter' | 'basic' | 'pro' | 'premium';
  planStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  billingCycle: string;
  minutesBalance: number;
  monthlyMinutesAllowance: number;
  addOnMinutesBalance: number;
  minutesResetAt?: string;
  nativeLanguage: string;
  employmentStatus?: string;
  dailyGoalMinutes: number;
  isTestAccount?: boolean;
  hasActiveTelcoSub?: boolean;
  telcoProvider?: 'ideamart' | 'mspace' | null;
  telcoOperatorName?: string | null;
  hasActivePayhereSub?: boolean;
  payherePlanTier?: string | null;
  payhereSubscriptionId?: string | null;
  activeSubscriptionType?: 'telco' | 'payhere' | 'none';
  baselineScores: {
    overall: number;
    fluency: number;
    grammar: number;
    pronunciation: number;
  };
  lastActiveStep?: string;
  onboardingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalSessions: number;
    totalPracticedMinutes: number;
    totalTokens: number;
    totalCostLkr: number;
    totalCostUsd: number;
    avgScore: number;
    completedLevelsCount: number;
    lastSessionDate: string | null;
    subscriptionStatus: string;
  };
}

export interface UserPersonalizedDetail {
  profile: any;
  stats: {
    totalSessions: number;
    totalPracticeMinutes: number;
    totalTokens: number;
    totalCostLkr: number;
    totalCostUsd: number;
  };
  sessions: Array<{
    id: string;
    topic: string;
    duration_seconds: number;
    overall_score: number;
    fluency_score: number;
    grammar_score: number;
    pronunciation_score: number;
    status: string;
    created_at: string;
    user_rating?: number;
    user_feedback?: string;
    turns?: Array<{
      id?: string;
      role: 'user' | 'model';
      text: string;
      audioUrl?: string | null;
      timestamp?: string;
    }>;
    corrections?: Array<{
      id?: string;
      student_said?: string;
      more_natural?: string;
      explanation?: string;
    }>;
  }>;
  corrections: Array<{
    id: string;
    session_id: string;
    student_said: string;
    more_natural: string;
    explanation: string;
    highlight_words?: string[];
    created_at: string;
  }>;
  orders: Array<{
    id: string;
    order_type: string;
    plan_tier?: string;
    add_on_package_id?: string;
    amount_lkr: number;
    minutes_credited: number;
    status: string;
    created_at: string;
  }>;
  subscription: any | null;
  roadmapProgress: Array<{
    id: string;
    roadmap_level_id: string;
    level_number: number;
    status: string;
    score_percent: number;
    is_passed: boolean;
    xp_earned: number;
    completed_at: string;
  }>;
}

export default function AdminUsersScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Active filter count
  const activeFiltersCount = (selectedTier !== 'ALL' ? 1 : 0) + (selectedStatus !== 'ALL' ? 1 : 0);

  // Loading & Data
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserSummaryItem[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activePaidCount: 0,
    starterCount: 0,
    testAccountsCount: 0,
    totalMinutesConsumed: 0,
    filteredCount: 0,
  });

  // Modal: User Detail Inspection
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserPersonalizedDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'sessions' | 'corrections' | 'roadmap' | 'orders'>('overview');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Complaints & Feedback
  const [complaints, setComplaints] = useState<AdminComplaintItem[]>([]);
  const [complaintsStats, setComplaintsStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);

  const fetchComplaints = async () => {
    setIsLoadingComplaints(true);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/complaints`);
      if (res.ok) {
        const data = await res.json();
        setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
        if (data.stats) {
          setComplaintsStats(data.stats);
        }
      }
    } catch (err) {
      console.warn('[AdminUsers] Failed to fetch complaints:', err);
    } finally {
      setIsLoadingComplaints(false);
    }
  };

  const handleToggleComplaintStatus = async (item: AdminComplaintItem) => {
    const nextStatus = item.status === 'resolved' ? 'open' : 'resolved';
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/complaints/${item.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchComplaints();
      }
    } catch {}
  };

  const handleDeleteComplaint = async (item: AdminComplaintItem) => {
    const confirmed = await mayaAlert.confirm({
      title: 'Delete Complaint',
      message: `Remove complaint from ${item.displayName}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'warning',
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/complaints/${item.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchComplaints();
      }
    } catch {}
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modal: Test Accounts (Zero OTP Bypass)
  const [testAccounts, setTestAccounts] = useState<TestAccountItem[]>([]);
  const [isTestAccountsModalOpen, setIsTestAccountsModalOpen] = useState(false);
  const [isLoadingTestAccounts, setIsLoadingTestAccounts] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestPhone, setNewTestPhone] = useState('+94');
  const [newTestPlan, setNewTestPlan] = useState<'starter' | 'basic' | 'pro' | 'premium' | 'unlimited'>('unlimited');
  const [newTestMinutes, setNewTestMinutes] = useState('9999');
  const [isCreatingTestAccount, setIsCreatingTestAccount] = useState(false);
  const [deletingTestAccountId, setDeletingTestAccountId] = useState<string | null>(null);

  const fetchTestAccounts = async () => {
    setIsLoadingTestAccounts(true);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/test-accounts`);
      if (res.ok) {
        const json = await res.json();
        setTestAccounts(Array.isArray(json) ? json : []);
      }
    } catch (err: any) {
      console.warn('Failed to load test accounts:', err);
    } finally {
      setIsLoadingTestAccounts(false);
    }
  };

  const handleSelectTestPlan = (p: 'starter' | 'basic' | 'pro' | 'premium' | 'unlimited') => {
    setNewTestPlan(p);
    if (p === 'starter') setNewTestMinutes('15');
    else if (p === 'basic') setNewTestMinutes('45');
    else if (p === 'pro') setNewTestMinutes('120');
    else if (p === 'premium') setNewTestMinutes('300');
    else if (p === 'unlimited') setNewTestMinutes('9999');
  };

  const handleCreateTestAccount = async () => {
    if (!newTestName.trim()) {
      await mayaAlert.error('Please enter a display name for the test account.', 'Missing Name');
      return;
    }
    const cleanDigits = newTestPhone.replace(/\D/g, '');
    if (!newTestPhone.trim() || cleanDigits.length < 9) {
      await mayaAlert.error('Please enter a valid phone number with country code (e.g. +94771234567).', 'Invalid Phone');
      return;
    }

    const alreadyExists = testAccounts.some(
      (t) => (t.phoneNumber || '').replace(/\D/g, '') === cleanDigits,
    );
    if (alreadyExists) {
      await mayaAlert.error(
        `A test account with phone number ${newTestPhone.trim()} already exists.`,
        'Duplicate Account',
      );
      return;
    }

    setIsCreatingTestAccount(true);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/test-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTestName.trim(),
          phoneNumber: newTestPhone.trim(),
          plan: newTestPlan,
          minutesBalance: parseInt(newTestMinutes, 10) || (newTestPlan === 'unlimited' ? 9999 : 120),
        }),
      });

      if (res.ok) {
        await mayaAlert.success(
          `Test account "${newTestName.trim()}" created! They will now automatically enter the dashboard with 0 OTP prompts.`,
          'Test Account Created',
        );
        setNewTestName('');
        setNewTestPhone('+94');
        setNewTestPlan('unlimited');
        setNewTestMinutes('9999');
        fetchTestAccounts();
        fetchUsers();
      } else {
        const errJson = await res.json().catch(() => ({}));
        await mayaAlert.error(errJson.message || 'Failed to create test account.', 'Error');
      }
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Network error creating test account.', 'Error');
    } finally {
      setIsCreatingTestAccount(false);
    }
  };

  const handleDeleteTestAccount = async (account: TestAccountItem) => {
    const confirmed = await mayaAlert.confirm({
      title: 'Remove Test Account',
      message: `Remove test account "${account.name}" (${account.phoneNumber})? They will revert to normal SMS OTP login.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    setDeletingTestAccountId(account.id);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/test-accounts/${account.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await mayaAlert.success(`Test account "${account.name}" removed.`, 'Removed');
        fetchTestAccounts();
        fetchUsers();
      } else {
        const errJson = await res.json().catch(() => ({}));
        await mayaAlert.error(errJson.message || 'Failed to remove test account.', 'Error');
      }
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Network error deleting test account.', 'Error');
    } finally {
      setDeletingTestAccountId(null);
    }
  };

  const isTestAccount = (phone: string) => {
    if (!phone) return false;
    const cleanDigits = phone.replace(/\D/g, '');
    return testAccounts.some((t) => (t.phoneNumber || '').replace(/\D/g, '') === cleanDigits);
  };

  const handleDeleteUser = async (u: UserSummaryItem) => {
    const isTest = Boolean(u.isTestAccount || isTestAccount(u.phoneNumber));
    const studentName = u.displayName || 'Student';
    const studentRef = u.phoneNumber || u.id;

    let confirmTitle = 'Delete Student Profile';
    let confirmMessage = `Permanently delete student "${studentName}" (${studentRef}) and all their practice data? This cannot be undone.`;
    let confirmButtonText = 'Delete Permanently';

    if (!isTest) {
      const hasPayhere = Boolean(
        u.hasActivePayhereSub || (u.planTier && u.planTier !== 'starter' && u.planStatus === 'active')
      );
      const hasTelco = Boolean(
        u.hasActiveTelcoSub || (!hasPayhere && u.planTier === 'starter' && u.planStatus === 'active')
      );
      const paidTierLabel = (u.payherePlanTier || u.planTier || 'PRO').toUpperCase();
      const telcoLabel = u.telcoOperatorName || 'Mobile Carrier (Dialog / Mobitel / Hutch)';

      if (hasPayhere && hasTelco) {
        confirmTitle = 'Active Paid & Telco Subscriptions Detected';
        confirmMessage =
          `Permanently delete "${studentName}" (${studentRef})?\n\n` +
          `• Subscription Status: Active ${paidTierLabel} (PayHere Paid) + Starter Telco (${telcoLabel})\n` +
          `• Auto-Unsubscribe: Confirming deletion will automatically unsubscribe both their PayHere ${paidTierLabel} subscription and Starter Telco subscription before deleting the account.\n\n` +
          `This action cannot be undone.`;
        confirmButtonText = 'Unsubscribe & Delete';
      } else if (hasPayhere) {
        confirmTitle = `Active ${paidTierLabel} (PayHere) Subscription Detected`;
        confirmMessage =
          `Permanently delete "${studentName}" (${studentRef})?\n\n` +
          `• Subscription Status: Active ${paidTierLabel} Plan (PayHere Paid Subscription)\n` +
          `• Auto-Unsubscribe: Confirming deletion will automatically cancel/unsubscribe their active PayHere ${paidTierLabel} subscription so no future charges occur.\n\n` +
          `This action cannot be undone.`;
        confirmButtonText = 'Unsubscribe & Delete';
      } else if (hasTelco) {
        confirmTitle = 'Active Starter Telco Subscription Detected';
        confirmMessage =
          `Permanently delete "${studentName}" (${studentRef})?\n\n` +
          `• Subscription Status: Active Starter Telco Subscription (${telcoLabel})\n` +
          `• Auto-Unsubscribe: Confirming deletion will automatically unsubscribe their Starter Telco daily subscription so mobile balance deductions stop immediately.\n\n` +
          `This action cannot be undone.`;
        confirmButtonText = 'Unsubscribe & Delete';
      } else {
        confirmMessage =
          `Permanently delete "${studentName}" (${studentRef})?\n\n` +
          `• Subscription Status: No active Starter Telco or Pro (PayHere) subscription available.\n\n` +
          `All practice data and account history will be permanently removed. This cannot be undone.`;
      }
    }

    const confirmed = await mayaAlert.confirm({
      title: confirmTitle,
      message: confirmMessage,
      confirmText: confirmButtonText,
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/users/${u.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const resJson = await res.json().catch(() => ({}));
        await mayaAlert.success(
          resJson.message || 'Student profile deleted successfully.',
          'Deleted'
        );
        if (selectedUserId === u.id) {
          closeUserDetail();
        }
        fetchUsers();
        fetchTestAccounts();
        fetchComplaints();
      } else {
        const errJson = await res.json().catch(() => ({}));
        await mayaAlert.error(errJson.message || 'Failed to delete user profile.', 'Error');
      }
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Network error deleting user.', 'Error');
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const baseUrl = getBackendBaseUrl();
      const params = new URLSearchParams({
        search: searchQuery,
        tier: selectedTier,
        level: selectedLevel,
        status: selectedStatus,
      });

      const res = await fetch(`${baseUrl}/v1/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.warn('[AdminUsers] Error loading users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTestAccounts();
    fetchComplaints();
  }, [selectedTier, selectedLevel, selectedStatus]);

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchUsers();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Detail Modal Fetch
  const openUserDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setDetailTab('overview');
    setIsLoadingDetail(true);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/users/${userId}`);
      if (res.ok) {
        const json = await res.json();
        setUserDetail(json);
      } else {
        await mayaAlert.error('Could not load user personalized profile.', 'Error');
        setSelectedUserId(null);
      }
    } catch (err: any) {
      await mayaAlert.error(err.message || 'Network error fetching user profile.', 'Error');
      setSelectedUserId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeUserDetail = () => {
    setSelectedUserId(null);
    setUserDetail(null);
    setExpandedSessionId(null);
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return users.slice(start, start + pageSize);
  }, [users, currentPage, pageSize]);

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'premium':
        return { bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff' };
      case 'pro':
        return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'basic':
        return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return { bg: '#f0fdf4', text: '#16a34a' };
      case 'past_due':
        return { bg: '#fffbeb', text: '#d97706' };
      case 'canceled':
      case 'cancelled':
        return { bg: '#fef2f2', text: '#dc2626' };
      default:
        return { bg: '#f8fafc', text: '#64748b' };
    }
  };

  const getInitials = (name?: string, phone?: string) => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (phone && phone.length > 2) {
      return phone.slice(-2);
    }
    return 'ST';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.mainLayout}>
        {/* Sidebar */}
        <AdminSidebar
          activeRoute="/admin/users"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content Area */}
        <View style={styles.contentArea}>
          <AdminTopBar
            title="User Management & Personalized Data"
            subtitle="View student profiles, personalized goals, speech diagnostics, and learning progress."
            badgeText={`${stats.totalUsers} registered`}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            rightElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => setIsTestAccountsModalOpen(true)}
                  style={({ pressed }) => [styles.testAccountBtn, pressed && { opacity: 0.8 }]}
                >
                  <Text style={{ fontSize: 13 }}>🧪</Text>
                  <Text style={styles.testAccountBtnText}>Test Accounts ({testAccounts.length})</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    fetchUsers();
                    fetchTestAccounts();
                    fetchComplaints();
                  }}
                  style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
                >
                  <Feather name="refresh-cw" size={14} color="#0d9488" />
                  <Text style={styles.refreshBtnText}>Refresh</Text>
                </Pressable>
              </View>
            }
          />

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollBodyContent}>
            {/* KPI Metric Cards */}
            <View style={styles.metricCardsGrid}>
              <View style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Feather name="users" size={18} color="#0d9488" />
                </View>
                <View>
                  <Text style={styles.metricLabel}>Total Students</Text>
                  <Text style={styles.metricValue}>{stats.totalUsers}</Text>
                  <Text style={styles.metricSub}>{stats.activePaidCount} Paid Subscribers</Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#f0fdf4' }]}>
                  <Feather name="check-circle" size={18} color="#16a34a" />
                </View>
                <View>
                  <Text style={styles.metricLabel}>Paid Active</Text>
                  <Text style={[styles.metricValue, { color: '#16a34a' }]}>{stats.activePaidCount}</Text>
                  <Text style={styles.metricSub}>
                    {stats.starterCount} Starter · {stats.testAccountsCount ?? testAccounts.length} Test
                  </Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#eff6ff' }]}>
                  <Feather name="clock" size={18} color="#2563eb" />
                </View>
                <View>
                  <Text style={styles.metricLabel}>Total Practiced</Text>
                  <Text style={[styles.metricValue, { color: '#2563eb' }]}>{stats.totalMinutesConsumed}m</Text>
                  <Text style={styles.metricSub}>Live Voice Coach Minutes</Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#faf5ff' }]}>
                  <Feather name="target" size={18} color="#9333ea" />
                </View>
                <View>
                  <Text style={styles.metricLabel}>Active Filtered</Text>
                  <Text style={[styles.metricValue, { color: '#9333ea' }]}>{users.length}</Text>
                  <Text style={styles.metricSub}>Matching Criteria</Text>
                </View>
              </View>
            </View>

            {/* Search & Filter Bar */}
            <View style={styles.filterBar}>
              <View style={styles.searchAndActionRow}>
                <View style={styles.searchBox}>
                  <Feather name="search" size={16} color="#94a3b8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search student by name, phone, or goal..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      setCurrentPage(1);
                    }}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                      <Feather name="x" size={16} color="#94a3b8" />
                    </Pressable>
                  )}
                </View>

                {/* Filters Toggle Button */}
                <Pressable
                  onPress={() => setIsFilterMenuOpen((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.filtersToggleBtn,
                    isFilterMenuOpen && styles.filtersToggleBtnOpen,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Feather
                    name="filter"
                    size={15}
                    color={isFilterMenuOpen || activeFiltersCount > 0 ? '#0d9488' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.filtersToggleBtnText,
                      (isFilterMenuOpen || activeFiltersCount > 0) && styles.filtersToggleBtnTextActive,
                    ]}
                  >
                    Filters
                  </Text>
                  {activeFiltersCount > 0 && (
                    <View style={styles.filtersBadge}>
                      <Text style={styles.filtersBadgeText}>{activeFiltersCount}</Text>
                    </View>
                  )}
                  <Feather
                    name={isFilterMenuOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={isFilterMenuOpen || activeFiltersCount > 0 ? '#0d9488' : '#64748b'}
                  />
                </Pressable>
              </View>

              {/* Collapsible Filters Menu Container */}
              {isFilterMenuOpen && (
                <View style={styles.filterMenuDropdown}>
                  {/* Tier Filter */}
                  <View style={styles.filterPillGroup}>
                    <Text style={styles.filterLabel}>Tier:</Text>
                    {(['ALL', 'starter', 'basic', 'pro', 'premium'] as const).map((tier) => (
                      <Pressable
                        key={tier}
                        onPress={() => {
                          setSelectedTier(tier);
                          setCurrentPage(1);
                        }}
                        style={[styles.filterPill, selectedTier === tier && styles.filterPillActive]}
                      >
                        <Text
                          style={[styles.filterPillText, selectedTier === tier && styles.filterPillTextActive]}
                        >
                          {tier === 'ALL' ? 'All Tiers' : tier.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Status Filter */}
                  <View style={styles.filterPillGroup}>
                    <Text style={styles.filterLabel}>Status:</Text>
                    {(['ALL', 'active', 'past_due', 'canceled'] as const).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => {
                          setSelectedStatus(st);
                          setCurrentPage(1);
                        }}
                        style={[styles.filterPill, selectedStatus === st && styles.filterPillActive]}
                      >
                        <Text
                          style={[styles.filterPillText, selectedStatus === st && styles.filterPillTextActive]}
                        >
                          {st === 'ALL' ? 'All' : st === 'past_due' ? 'Past Due' : st.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Reset Filters Link */}
                  {activeFiltersCount > 0 && (
                    <View style={styles.resetFiltersRow}>
                      <Pressable
                        onPress={() => {
                          setSelectedTier('ALL');
                          setSelectedStatus('ALL');
                          setCurrentPage(1);
                        }}
                      >
                        <Text style={styles.resetFiltersText}>Reset filters</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Users Table / Grid Card */}
            <View style={styles.tableCard}>
              <View style={styles.tableCardHeader}>
                <Text style={styles.tableTitle}>Student Directory & Usage Ledger</Text>
                <Text style={styles.tableSubtitle}>
                  Showing {paginatedUsers.length} of {users.length} students
                </Text>
              </View>

              {isLoading ? (
                <AdminTableSkeleton rows={6} />
              ) : paginatedUsers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="user-x" size={36} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No students found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try tweaking your search term or clearing filters.
                  </Text>
                </View>
              ) : (
                <View style={styles.table}>
                  {/* Table Header */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableColHeader, { flex: 2 }]}>STUDENT</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2 }]}>LEVEL & GOAL</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.1 }]}>PLAN & TIER</Text>
                    <Text style={[styles.tableColHeader, { flex: 1 }]}>PRACTICE BAL.</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2 }]}>SESSIONS / MINS</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right' }]}>ACTIONS</Text>
                  </View>

                  {/* Table Rows */}
                  {paginatedUsers.map((u) => {
                    const tierStyle = getTierColor(u.planTier);
                    const statusStyle = getStatusColor(u.planStatus);
                    return (
                      <View key={u.id} style={styles.tableRow}>
                        {/* Student Name & Phone */}
                        <View style={[styles.tableCol, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                          <View style={styles.userAvatar}>
                            {u.avatarUrl ? (
                              <Image
                                source={{ uri: u.avatarUrl }}
                                style={styles.userAvatarImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={styles.avatarText}>{getInitials(u.displayName, u.phoneNumber)}</Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.userName} numberOfLines={1}>
                                {u.displayName || 'Anonymous Student'}
                              </Text>
                              {isTestAccount(u.phoneNumber) && (
                                <View style={styles.testBadgePill}>
                                  <Text style={styles.testBadgeText}>🧪 TEST</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.userPhone} numberOfLines={1}>
                              {u.phoneNumber || 'No phone'}
                              {u.email ? ` • ${u.email}` : ''}
                            </Text>
                          </View>
                        </View>

                        {/* Level & Goal */}
                        <View style={[styles.tableCol, { flex: 1.2 }]}>
                          <Text style={styles.levelBadgeText}>{u.level || 'Intermediate'}</Text>
                          <Text style={styles.goalSubText} numberOfLines={1}>
                            {u.goal || 'General Fluency'}
                          </Text>
                        </View>

                        {/* Plan & Tier */}
                        <View style={[styles.tableCol, { flex: 1.1 }]}>
                          <View
                            style={[
                              styles.planBadge,
                              { backgroundColor: tierStyle.bg, borderColor: tierStyle.border },
                            ]}
                          >
                            <Text style={[styles.planBadgeText, { color: tierStyle.text }]}>
                              {u.planTier?.toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                            <View
                              style={[styles.statusDot, { backgroundColor: statusStyle.text }]}
                            />
                            <Text style={[styles.statusSubText, { color: statusStyle.text }]}>
                              {u.planStatus?.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Practice Balance */}
                        <View style={[styles.tableCol, { flex: 1 }]}>
                          <Text style={styles.balanceMinutes}>{u.minutesBalance} min</Text>
                          <Text style={styles.allowanceSubText}>
                            Alloc: {u.monthlyMinutesAllowance}m | Add-on: {u.addOnMinutesBalance}m
                          </Text>
                        </View>

                        {/* Sessions & Minutes */}
                        <View style={[styles.tableCol, { flex: 1.2 }]}>
                          <Text style={styles.sessionsCountText}>
                            {u.stats.totalSessions} sessions
                          </Text>
                          <Text style={styles.practicedMinutesText}>
                            {u.stats.totalPracticedMinutes} min practiced
                          </Text>
                        </View>

                        {/* Action Buttons */}
                        <View
                          style={[
                            styles.tableCol,
                            { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
                          ]}
                        >
                          <Pressable
                            onPress={() => openUserDetail(u.id)}
                            style={({ pressed }) => [styles.actionBtn, styles.viewBtn, pressed && { opacity: 0.8 }]}
                          >
                            <Feather name="eye" size={13} color="#0d9488" />
                            <Text style={styles.viewBtnText}>View</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => handleDeleteUser(u)}
                            style={({ pressed }) => [
                              styles.actionBtn,
                              styles.deleteUserRowBtn,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Feather name="trash-2" size={13} color="#ef4444" />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <View style={styles.paginationRow}>
                  <Text style={styles.pageIndicatorText}>
                    Page {currentPage} of {totalPages}
                  </Text>
                  <View style={styles.paginationBtns}>
                    <Pressable
                      disabled={currentPage <= 1}
                      onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
                    >
                      <Feather name="chevron-left" size={16} color={currentPage <= 1 ? '#cbd5e1' : '#334155'} />
                    </Pressable>
                    <Pressable
                      disabled={currentPage >= totalPages}
                      onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
                    >
                      <Feather name="chevron-right" size={16} color={currentPage >= totalPages ? '#cbd5e1' : '#334155'} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            {/* Student Complaints & Feedback Table Card */}
            <View style={[styles.tableCard, { marginTop: 22 }]}>
              <View style={[styles.tableCardHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <View>
                  <Text style={styles.tableTitle}>Student Complaints & Feedback</Text>
                  <Text style={styles.tableSubtitle}>
                    {complaintsStats.total} total submissions ({complaintsStats.open} open, {complaintsStats.resolved} resolved)
                  </Text>
                </View>
                <Pressable
                  onPress={fetchComplaints}
                  style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
                >
                  <Feather name="refresh-cw" size={13} color="#0d9488" />
                  <Text style={styles.refreshBtnText}>Refresh</Text>
                </Pressable>
              </View>

              {isLoadingComplaints ? (
                <AdminTableSkeleton rows={3} />
              ) : complaints.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="message-square" size={32} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>No complaints submitted yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Complaints and feedback submitted by students from the Account screen will appear here.
                  </Text>
                </View>
              ) : (
                <View style={styles.table}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableColHeader, { flex: 1.8 }]}>STUDENT</Text>
                    <Text style={[styles.tableColHeader, { flex: 0.9 }]}>PLAN</Text>
                    <Text style={[styles.tableColHeader, { flex: 2.8 }]}>COMPLAINT / FEEDBACK MESSAGE</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.1 }]}>SUBMITTED</Text>
                    <Text style={[styles.tableColHeader, { flex: 0.9 }]}>STATUS</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right' }]}>ACTIONS</Text>
                  </View>

                  {complaints.map((c) => {
                    const tierStyle = getTierColor(c.planTier);
                    const isResolved = c.status === 'resolved';
                    return (
                      <View key={c.id} style={styles.tableRow}>
                        {/* Student */}
                        <View style={[styles.tableCol, { flex: 1.8, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                          <View style={styles.userAvatar}>
                            {c.avatarUrl ? (
                              <Image
                                source={{ uri: c.avatarUrl }}
                                style={styles.userAvatarImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={styles.avatarText}>{getInitials(c.displayName, c.phoneNumber)}</Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.userName} numberOfLines={1}>
                              {c.displayName || 'Anonymous Student'}
                            </Text>
                            <Text style={styles.userPhone} numberOfLines={1}>
                              {c.phoneNumber || 'No phone'}
                              {c.email ? ` • ${c.email}` : ''}
                            </Text>
                          </View>
                        </View>

                        {/* Plan */}
                        <View style={[styles.tableCol, { flex: 0.9 }]}>
                          <View
                            style={[
                              styles.planBadge,
                              { backgroundColor: tierStyle.bg, borderColor: tierStyle.border },
                            ]}
                          >
                            <Text style={[styles.planBadgeText, { color: tierStyle.text }]}>
                              {(c.planTier || 'starter').toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Complaint Message */}
                        <View style={[styles.tableCol, { flex: 2.8, paddingRight: 12 }]}>
                          <Text style={[styles.userName, { fontWeight: '400', lineHeight: 19 }]}>
                            {c.message}
                          </Text>
                        </View>

                        {/* Submitted Date */}
                        <View style={[styles.tableCol, { flex: 1.1 }]}>
                          <Text style={styles.practicedMinutesText}>
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}
                          </Text>
                          <Text style={styles.allowanceSubText}>
                            {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </Text>
                        </View>

                        {/* Status */}
                        <View style={[styles.tableCol, { flex: 0.9 }]}>
                          <View
                            style={[
                              styles.planBadge,
                              {
                                backgroundColor: isResolved ? '#f0fdf4' : '#fef2f2',
                                borderColor: isResolved ? '#bbf7d0' : '#fecaca',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.planBadgeText,
                                { color: isResolved ? '#16a34a' : '#dc2626' },
                              ]}
                            >
                              {isResolved ? 'RESOLVED' : 'OPEN'}
                            </Text>
                          </View>
                        </View>

                        {/* Actions */}
                        <View
                          style={[
                            styles.tableCol,
                            { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
                          ]}
                        >
                          <Pressable
                            onPress={() => handleToggleComplaintStatus(c)}
                            style={({ pressed }) => [
                              styles.actionBtn,
                              isResolved ? styles.editBtn : styles.viewBtn,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Feather
                              name={isResolved ? 'rotate-ccw' : 'check'}
                              size={13}
                              color={isResolved ? '#475569' : '#0d9488'}
                            />
                            <Text style={isResolved ? styles.editBtnText : styles.viewBtnText}>
                              {isResolved ? 'Reopen' : 'Resolve'}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => handleDeleteComplaint(c)}
                            style={({ pressed }) => [
                              styles.actionBtn,
                              styles.deleteUserRowBtn,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Feather name="trash-2" size={13} color="#ef4444" />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* 1. USER PERSONALIZED DETAIL MODAL */}
      <Modal
        visible={Boolean(selectedUserId)}
        animationType="fade"
        transparent
        onRequestClose={closeUserDetail}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.modalAvatar}>
                  {userDetail?.profile?.avatar_url || userDetail?.profile?.avatarUrl ? (
                    <Image
                      source={{ uri: userDetail.profile.avatar_url || userDetail.profile.avatarUrl }}
                      style={styles.modalAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.modalAvatarText}>
                      {getInitials(userDetail?.profile?.display_name, userDetail?.profile?.phone_number)}
                    </Text>
                  )}
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {userDetail?.profile?.display_name || 'Student Profile'}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {userDetail?.profile?.phone_number || ''}
                    {userDetail?.profile?.email ? ` • ${userDetail.profile.email}` : ''} • Joined{' '}
                    {userDetail?.profile?.created_at
                      ? new Date(userDetail.profile.created_at).toLocaleDateString()
                      : ''}
                  </Text>
                </View>
              </View>

              <Pressable onPress={closeUserDetail} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color="#64748b" />
              </Pressable>
            </View>

            {isLoadingDetail || !userDetail ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#0d9488" />
                <Text style={styles.modalLoadingText}>Loading personalized learning metrics...</Text>
              </View>
            ) : (
              <View style={styles.modalBody}>
                {/* Modal Tab Switcher */}
                <View style={styles.detailTabBar}>
                  {[
                    { id: 'overview', label: 'Overview & Goals', icon: 'user' },
                    { id: 'sessions', label: `Sessions (${userDetail.sessions.length})`, icon: 'phone-call' },
                    { id: 'corrections', label: `Corrections (${userDetail.corrections.length})`, icon: 'message-circle' },
                    { id: 'roadmap', label: `Curriculum (${userDetail.roadmapProgress.length})`, icon: 'map' },
                    { id: 'orders', label: `Billing & Orders (${userDetail.orders.length})`, icon: 'credit-card' },
                  ].map((tab) => {
                    const isActive = detailTab === tab.id;
                    return (
                      <Pressable
                        key={tab.id}
                        onPress={() => setDetailTab(tab.id as any)}
                        style={[styles.detailTabItem, isActive && styles.detailTabItemActive]}
                      >
                        <Feather
                          name={tab.icon as any}
                          size={14}
                          color={isActive ? '#0d9488' : '#64748b'}
                        />
                        <Text style={[styles.detailTabText, isActive && styles.detailTabTextActive]}>
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Tab 1: Overview & Goals */}
                {detailTab === 'overview' && (
                  <ScrollView style={styles.modalTabScroll} contentContainerStyle={{ padding: 20 }}>
                    {/* Top KPI Cards in Modal */}
                    <View style={styles.modalKpiGrid}>
                      <View style={styles.modalKpiCard}>
                        <Text style={styles.modalKpiLabel}>Practice Balance</Text>
                        <Text style={[styles.modalKpiValue, { color: '#0d9488' }]}>
                          {userDetail.profile.minutes_balance ?? 0}m
                        </Text>
                        <Text style={styles.modalKpiSub}>
                          Monthly: {userDetail.profile.monthly_minutes_allowance ?? 10}m
                        </Text>
                      </View>

                      <View style={styles.modalKpiCard}>
                        <Text style={styles.modalKpiLabel}>Total Practice Time</Text>
                        <Text style={[styles.modalKpiValue, { color: '#2563eb' }]}>
                          {userDetail.stats.totalPracticeMinutes}m
                        </Text>
                        <Text style={styles.modalKpiSub}>
                          Across {userDetail.stats.totalSessions} sessions
                        </Text>
                      </View>

                      <View style={styles.modalKpiCard}>
                        <Text style={styles.modalKpiLabel}>AI Usage Cost</Text>
                        <Text style={[styles.modalKpiValue, { color: '#7c3aed' }]}>
                          LKR {userDetail.stats.totalCostLkr.toFixed(2)}
                        </Text>
                        <Text style={styles.modalKpiSub}>
                          Tokens: {userDetail.stats.totalTokens.toLocaleString()}
                        </Text>
                      </View>

                      <View style={styles.modalKpiCard}>
                        <Text style={styles.modalKpiLabel}>Subscription</Text>
                        <Text style={[styles.modalKpiValue, { color: '#d97706' }]}>
                          {(userDetail.subscription?.plan_tier || userDetail.profile.plan_tier || 'STARTER').toUpperCase()}
                        </Text>
                        <Text style={styles.modalKpiSub}>
                          Status: {(userDetail.subscription?.status || userDetail.profile.plan_status || 'ACTIVE').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Active Subscription & Recurring Billing Card */}
                    <View style={styles.sectionCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <Text style={styles.sectionTitle}>Active Subscription Details</Text>
                        <View
                          style={[
                            styles.planBadge,
                            {
                              backgroundColor: (userDetail.subscription?.status === 'ACTIVE' || userDetail.profile.plan_status === 'active') ? '#f0fdf4' : '#fffbeb',
                              borderColor: (userDetail.subscription?.status === 'ACTIVE' || userDetail.profile.plan_status === 'active') ? '#bbf7d0' : '#fde68a',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.planBadgeText,
                              {
                                color: (userDetail.subscription?.status === 'ACTIVE' || userDetail.profile.plan_status === 'active') ? '#16a34a' : '#d97706',
                              },
                            ]}
                          >
                            {(userDetail.subscription?.status || userDetail.profile.plan_status || 'FREE').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.attributesGrid}>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Current Plan Tier</Text>
                          <Text style={styles.attrValue}>
                            {(userDetail.subscription?.plan_tier || userDetail.profile.plan_tier || 'STARTER').toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Billing Cycle</Text>
                          <Text style={styles.attrValue}>
                            {userDetail.subscription?.billing_cycle || userDetail.profile.billing_cycle || 'Monthly'}
                          </Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Amount (LKR)</Text>
                          <Text style={styles.attrValue}>
                            {userDetail.subscription?.amount_lkr ? `LKR ${Number(userDetail.subscription.amount_lkr).toFixed(2)}` : 'LKR 0.00 (Free)'}
                          </Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Next Renewal / Reset Date</Text>
                          <Text style={styles.attrValue}>
                            {userDetail.subscription?.next_billing_date
                              ? new Date(userDetail.subscription.next_billing_date).toLocaleDateString()
                              : userDetail.profile.minutes_reset_at
                              ? new Date(userDetail.profile.minutes_reset_at).toLocaleDateString()
                              : 'None'}
                          </Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Pre-approved Payment Method</Text>
                          <Text style={styles.attrValue}>
                            {userDetail.subscription?.card_masked
                              ? `${userDetail.subscription?.card_holder_name || 'Card'} (${userDetail.subscription.card_masked})`
                              : 'No card tokenized'}
                          </Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Installments Paid</Text>
                          <Text style={styles.attrValue}>
                            {userDetail.subscription?.installments_paid ?? 0} cycles
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Personalized Learning Profile Details */}
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Personalized Learning Attributes</Text>
                      <View style={styles.attributesGrid}>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Full Name</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.display_name || 'Anonymous Student'}</Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Mobile Number</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.phone_number || 'Not provided'}</Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Email Address</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.email || 'Not provided'}</Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Current English Level</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.level || 'Intermediate'}</Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Primary Goal</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.goal || 'General Fluency'}</Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Main Challenge</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.challenge || 'Hesitation & Confidence'}</Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Native Language</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.native_language || 'Sinhala'}</Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Daily Practice Target</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.daily_goal_minutes || 10} minutes/day</Text>
                        </View>
                        <View style={styles.attributeItem}>
                          <Text style={styles.attrLabel}>Employment / Profession</Text>
                          <Text style={styles.attrValue}>{userDetail.profile.employment_status || 'Not specified'}</Text>
                        </View>
                      </View>
                    </View>

                  </ScrollView>
                )}

                {/* Tab 2: Sessions */}
                {detailTab === 'sessions' && (
                  <ScrollView style={styles.modalTabScroll} contentContainerStyle={{ padding: 20 }}>
                    {userDetail.sessions.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Feather name="phone-off" size={32} color="#94a3b8" />
                        <Text style={styles.emptyTitle}>No sessions recorded yet</Text>
                        <Text style={styles.emptySubtitle}>Student has not completed any practice calls yet.</Text>
                      </View>
                    ) : (
                      <View style={styles.sessionsList}>
                        {userDetail.sessions.map((sess, idx) => (
                          <View key={sess.id || idx} style={styles.sessionItemCard}>
                            <View style={styles.sessionItemHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={styles.sessionBadgeIcon}>
                                  <Feather name="mic" size={14} color="#0d9488" />
                                </View>
                                <View>
                                  <Text style={styles.sessionTopicText}>{sess.topic || 'General Practice'}</Text>
                                  <Text style={styles.sessionDateText}>
                                    {sess.created_at ? new Date(sess.created_at).toLocaleString() : 'Recent'}
                                  </Text>
                                </View>
                              </View>

                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.sessionDurationText}>
                                  {Math.round((sess.duration_seconds || 0) / 60)} min ({sess.duration_seconds || 0}s)
                                </Text>
                                <Text style={[styles.sessionStatusPill, { color: '#16a34a' }]}>
                                  {sess.status?.toUpperCase() || 'COMPLETED'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.sessionScoresRow}>
                              <View style={styles.miniScoreBox}>
                                <Text style={styles.miniScoreLabel}>Overall</Text>
                                <Text style={styles.miniScoreVal}>{sess.overall_score || 0}%</Text>
                              </View>
                              <View style={styles.miniScoreBox}>
                                <Text style={styles.miniScoreLabel}>Fluency</Text>
                                <Text style={styles.miniScoreVal}>{sess.fluency_score || 0}%</Text>
                              </View>
                              <View style={styles.miniScoreBox}>
                                <Text style={styles.miniScoreLabel}>Grammar</Text>
                                <Text style={styles.miniScoreVal}>{sess.grammar_score || 0}%</Text>
                              </View>
                              <View style={styles.miniScoreBox}>
                                <Text style={styles.miniScoreLabel}>Pronunciation</Text>
                                <Text style={styles.miniScoreVal}>{sess.pronunciation_score || 0}%</Text>
                              </View>
                            </View>

                            {sess.user_feedback && (
                              <View style={styles.feedbackBox}>
                                <Text style={styles.feedbackLabel}>Student Feedback:</Text>
                                <Text style={styles.feedbackText}>{sess.user_feedback}</Text>
                              </View>
                            )}

                            {/* Toggle Transcript & Audio Recording Button */}
                            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 11.5, color: '#64748b' }}>
                                {sess.turns?.length ? `${sess.turns.length} transcript turns` : 'Audio & transcript available'}
                              </Text>
                              <Pressable
                                onPress={() =>
                                  setExpandedSessionId((prev) => (prev === sess.id ? null : sess.id))
                                }
                                style={({ pressed }) => [
                                  styles.actionBtn,
                                  styles.viewBtn,
                                  pressed && { opacity: 0.8 },
                                ]}
                              >
                                <Feather
                                  name={expandedSessionId === sess.id ? 'chevron-up' : 'headphones'}
                                  size={13}
                                  color="#0d9488"
                                />
                                <Text style={styles.viewBtnText}>
                                  {expandedSessionId === sess.id
                                    ? 'Hide Transcript & Audio'
                                    : 'Transcript & Audio Recording'}
                                </Text>
                              </Pressable>
                            </View>

                            {expandedSessionId === sess.id && (
                              <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                                <AdminSessionTranscriptAndPlayer
                                  sessionId={sess.id}
                                  studentName={userDetail.profile.display_name || 'Student'}
                                  durationSeconds={sess.duration_seconds}
                                  initialTurns={sess.turns}
                                  initialCorrections={sess.corrections}
                                />
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* Tab 3: Grammar Corrections */}
                {detailTab === 'corrections' && (
                  <ScrollView style={styles.modalTabScroll} contentContainerStyle={{ padding: 20 }}>
                    {userDetail.corrections.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Feather name="check" size={32} color="#16a34a" />
                        <Text style={styles.emptyTitle}>No corrections recorded</Text>
                        <Text style={styles.emptySubtitle}>No grammar corrections stored for this student.</Text>
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {userDetail.corrections.map((corr, idx) => (
                          <View key={corr.id || idx} style={styles.correctionCard}>
                            <View style={styles.corrRow}>
                              <Text style={styles.corrStudentLabel}>STUDENT SAID:</Text>
                              <Text style={styles.corrStudentSaid}>"{corr.student_said}"</Text>
                            </View>
                            <View style={styles.corrRow}>
                              <Text style={styles.corrNaturalLabel}>NATURAL PHRASING:</Text>
                              <Text style={styles.corrMoreNatural}>"{corr.more_natural}"</Text>
                            </View>
                            {corr.explanation && (
                              <Text style={styles.corrExplanation}>💡 {corr.explanation}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* Tab 4: Curriculum / Roadmap */}
                {detailTab === 'roadmap' && (
                  <ScrollView style={styles.modalTabScroll} contentContainerStyle={{ padding: 20 }}>
                    {userDetail.roadmapProgress.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Feather name="map-pin" size={32} color="#94a3b8" />
                        <Text style={styles.emptyTitle}>Curriculum progress empty</Text>
                        <Text style={styles.emptySubtitle}>Student has not completed any roadmap levels yet.</Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {userDetail.roadmapProgress.map((prog, idx) => (
                          <View key={prog.id || idx} style={styles.progressRowCard}>
                            <View style={styles.progNumberCircle}>
                              <Text style={styles.progNumberText}>L{prog.level_number}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.progTitleText}>Level {prog.level_number}: {prog.roadmap_level_id}</Text>
                              <Text style={styles.progStatusSub}>
                                Status: {prog.status?.toUpperCase()} • {prog.xp_earned || 0} XP
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[styles.progScoreText, { color: prog.is_passed ? '#16a34a' : '#d97706' }]}>
                                {prog.score_percent || 0}%
                              </Text>
                              <Text style={styles.progPassedSub}>{prog.is_passed ? 'PASSED' : 'ATTEMPTED'}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* Tab 5: Billing & Orders */}
                {detailTab === 'orders' && (
                  <ScrollView style={styles.modalTabScroll} contentContainerStyle={{ padding: 20 }}>
                    {/* Active Recurring Subscription Banner */}
                    <View style={[styles.sectionCard, { marginBottom: 16 }]}>
                      <Text style={styles.sectionTitle}>Recurring Subscription</Text>
                      {userDetail.subscription ? (
                        <View style={{ gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.userName}>
                              {userDetail.subscription.plan_tier?.toUpperCase()} Plan ({userDetail.subscription.billing_cycle || 'Monthly'})
                            </Text>
                            <Text style={[styles.planBadgeText, { color: userDetail.subscription.status === 'ACTIVE' ? '#16a34a' : '#d97706' }]}>
                              {userDetail.subscription.status?.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.goalSubText}>
                            PayHere Sub ID: {userDetail.subscription.payhere_subscription_id || 'N/A'} • Next Billing: {userDetail.subscription.next_billing_date || 'N/A'}
                          </Text>
                          <Text style={styles.goalSubText}>
                            Payment Method: {userDetail.subscription.card_masked || 'Tokenized Card'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.emptySubtitle}>
                          No recurring PayHere subscription on file (User is on {userDetail.profile.plan_tier?.toUpperCase() || 'STARTER'} plan).
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Order History</Text>
                    {userDetail.orders.length === 0 ? (
                      <View style={styles.emptyState}>
                        <Feather name="credit-card" size={32} color="#94a3b8" />
                        <Text style={styles.emptyTitle}>No transaction orders found</Text>
                        <Text style={styles.emptySubtitle}>User is on free starter tier with no purchase orders.</Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {userDetail.orders.map((ord, idx) => (
                          <View key={ord.id || idx} style={styles.orderItemCard}>
                            <View>
                              <Text style={styles.orderTypeText}>
                                {ord.order_type === 'add_on_topup'
                                  ? `Talk Time Top-Up (+${ord.minutes_credited} min)`
                                  : `Subscription (${ord.plan_tier?.toUpperCase() || 'PLAN'})`}
                              </Text>
                              <Text style={styles.orderDateText}>
                                {ord.created_at ? new Date(ord.created_at).toLocaleString() : ''}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.orderAmountText}>LKR {Number(ord.amount_lkr || 0).toFixed(2)}</Text>
                              <Text style={[styles.orderStatusPill, { color: ord.status === 'completed' ? '#16a34a' : '#dc2626' }]}>
                                {ord.status?.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Test Accounts Management Modal */}
      <Modal
        visible={isTestAccountsModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsTestAccountsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.editModalContainer, { maxWidth: 680, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#fef3c7', width: 38, height: 38 }]}>
                  <Text style={{ fontSize: 18 }}>🧪</Text>
                </View>
                <View>
                  <Text style={styles.modalTitle}>Test Accounts (Zero-OTP Bypass)</Text>
                  <Text style={styles.modalSubtitle}>
                    Numbers that skip SMS OTP verification and enter the dashboard instantly.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setIsTestAccountsModalOpen(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
              >
                <Feather name="x" size={18} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ padding: 20, gap: 16 }}>
              {/* Form to Create Test Account */}
              <View style={styles.testFormCard}>
                <Text style={styles.testFormTitle}>Create New Test Account</Text>
                <Text style={styles.testFormSubtitle}>
                  This user will skip SMS verification on phone entry and immediately reach the dashboard.
                </Text>

                <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                  <View style={[styles.formGroup, { flex: 1, minWidth: 200, marginBottom: 0 }]}>
                    <Text style={styles.formLabel}>User Name / Label *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newTestName}
                      onChangeText={setNewTestName}
                      placeholder="e.g. QA Tester 1, Apple Reviewer"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={[styles.formGroup, { flex: 1, minWidth: 200, marginBottom: 0 }]}>
                    <Text style={styles.formLabel}>Mobile Number (with country code) *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newTestPhone}
                      onChangeText={setNewTestPhone}
                      placeholder="+94770000001"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                {/* Plan Selection */}
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.formLabel}>Assigned Plan Tier</Text>
                  <View style={styles.tierSelectRow}>
                    {(['starter', 'basic', 'pro', 'premium', 'unlimited'] as const).map((p) => {
                      const isActive = newTestPlan === p;
                      return (
                        <Pressable
                          key={p}
                          onPress={() => handleSelectTestPlan(p)}
                          style={[styles.tierOption, isActive && styles.tierOptionActive]}
                        >
                          <Text style={[styles.tierOptionText, isActive && styles.tierOptionTextActive]}>
                            {p.toUpperCase()}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Minutes Allowance */}
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.formLabel}>Practice Minutes Balance</Text>
                  <TextInput
                    style={[styles.formInput, { maxWidth: 200 }]}
                    value={newTestMinutes}
                    onChangeText={setNewTestMinutes}
                    keyboardType="number-pad"
                    placeholder="9999"
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.formHint}>Unlimited plans default to 9,999 practice minutes.</Text>
                </View>

                <View style={{ alignItems: 'flex-end', marginTop: 14 }}>
                  <Pressable
                    onPress={handleCreateTestAccount}
                    disabled={isCreatingTestAccount}
                    style={({ pressed }) => [
                      styles.saveBtn,
                      pressed && { opacity: 0.8 },
                      isCreatingTestAccount && { opacity: 0.6 },
                    ]}
                  >
                    {isCreatingTestAccount ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Feather name="plus" size={16} color="#ffffff" />
                        <Text style={styles.saveBtnText}>Add Test Account</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* List of Registered Test Accounts */}
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.sectionTitle}>Registered Test Accounts ({testAccounts.length})</Text>
                  {isLoadingTestAccounts && <ActivityIndicator size="small" color="#0d9488" />}
                </View>

                {testAccounts.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ ...fontStyle('inter', 'regular'), fontSize: 13, color: '#94a3b8' }}>
                      No test accounts registered yet. Use the form above to add one.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {testAccounts.map((t) => (
                      <View key={t.id} style={styles.testAccountCardItem}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.testAccountName}>{t.name}</Text>
                            <View style={[styles.planBadge, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                              <Text style={[styles.planBadgeText, { color: '#16a34a' }]}>
                                {t.plan.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.testAccountPhone}>{t.phoneNumber}</Text>
                          <Text style={styles.testAccountMins}>
                            {t.minutesBalance.toLocaleString()} mins practice balance
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => handleDeleteTestAccount(t)}
                          disabled={deletingTestAccountId === t.id}
                          style={({ pressed }) => [
                            styles.deleteTestBtn,
                            pressed && { opacity: 0.8 },
                            deletingTestAccountId === t.id && { opacity: 0.5 },
                          ]}
                        >
                          {deletingTestAccountId === t.id ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <>
                              <Feather name="trash-2" size={14} color="#ef4444" />
                              <Text style={styles.deleteTestBtnText}>Remove</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#0d9488',
  },
  scrollBody: {
    flex: 1,
  },
  scrollBodyContent: {
    padding: 24,
    gap: 20,
  },
  // Metric Cards
  metricCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    }),
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 24,
    color: '#0f172a',
    marginTop: 2,
  },
  metricSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  // Filter Bar
  filterBar: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  searchAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0f172a',
  },
  filtersToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  filtersToggleBtnOpen: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  filtersToggleBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#334155',
  },
  filtersToggleBtnTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },
  filtersBadge: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#ffffff',
  },
  filterMenuDropdown: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    gap: 12,
    marginTop: 2,
  },
  resetFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
  resetFiltersText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#0d9488',
    textDecorationLine: 'underline',
  },
  filterPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#64748b',
    marginRight: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: '#0d9488',
  },
  filterPillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  // Table Card
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  tableCardHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#0f172a',
  },
  tableSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  table: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableColHeader: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#64748b',
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
  tableCol: {
    justifyContent: 'center',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  avatarText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0284c7',
  },
  userName: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  userPhone: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  levelBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
  },
  goalSubText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  planBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusSubText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10,
  },
  balanceMinutes: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#0f172a',
  },
  allowanceSubText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  sessionsCountText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#334155',
  },
  practicedMinutesText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#b45309',
  },
  levelsCompletedSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewBtn: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  viewBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#0d9488',
  },
  editBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#475569',
  },
  // Pagination
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  pageIndicatorText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
  },
  paginationBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    gap: 8,
  },
  emptyTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 16,
    color: '#334155',
    marginTop: 8,
  },
  emptySubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94a3b8',
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailModalContainer: {
    width: '100%',
    maxWidth: 920,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' },
    }),
  },
  editModalContainer: {
    width: '100%',
    maxWidth: 540,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  modalAvatarText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0f766e',
  },
  modalTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0f172a',
  },
  modalSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalLoading: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  modalLoadingText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748b',
  },
  modalBody: {
    flex: 1,
  },
  detailTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  detailTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  detailTabItemActive: {
    borderBottomColor: '#0d9488',
  },
  detailTabText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  detailTabTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },
  modalTabScroll: {
    maxHeight: 520,
  },
  modalKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  modalKpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalKpiLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  modalKpiValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 20,
    marginTop: 4,
  },
  modalKpiSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  sectionTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 14,
  },
  attributesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  attributeItem: {
    width: '48%',
    minWidth: 220,
  },
  attrLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
  },
  attrValue: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
    marginTop: 2,
  },
  scoreBarsGrid: {
    gap: 12,
  },
  scoreBarItem: {
    gap: 4,
  },
  scoreBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreBarLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
  },
  scoreBarVal: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0f172a',
  },
  scoreBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  // Sessions in Modal
  sessionsList: {
    gap: 12,
  },
  sessionItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sessionItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTopicText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  sessionDateText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },
  sessionDurationText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0f172a',
  },
  sessionStatusPill: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    marginTop: 2,
  },
  sessionScoresRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  miniScoreBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  miniScoreLabel: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10,
    color: '#64748b',
  },
  miniScoreVal: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#0f172a',
    marginTop: 2,
  },
  feedbackBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  feedbackLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#64748b',
  },
  feedbackText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  // Corrections in Modal
  correctionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  corrRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  corrStudentLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#dc2626',
  },
  corrStudentSaid: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#991b1b',
  },
  corrNaturalLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#16a34a',
  },
  corrMoreNatural: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#15803d',
  },
  corrExplanation: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  // Progress Rows
  progressRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  progNumberCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progNumberText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 13,
    color: '#2563eb',
  },
  progTitleText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  progStatusSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  progScoreText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 15,
  },
  progPassedSub: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  // Order Rows
  orderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderTypeText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  orderDateText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  orderAmountText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 14,
    color: '#0f172a',
  },
  orderStatusPill: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    marginTop: 2,
  },
  // Form Groups
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#334155',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0f172a',
  },
  formHint: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  tierSelectRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tierOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tierOptionActive: {
    backgroundColor: '#f0fdfa',
    borderColor: '#0d9488',
  },
  tierOptionText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  tierOptionTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748b',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0d9488',
  },
  saveBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#ffffff',
  },
  // Test Account UI Styles
  testAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  testAccountBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#b45309',
  },
  testBadgePill: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  testBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#b45309',
    letterSpacing: 0.5,
  },
  testFormCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  testFormTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    color: '#0f172a',
  },
  testFormSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  testAccountCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  testAccountName: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  testAccountPhone: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  testAccountMins: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#0d9488',
    marginTop: 2,
  },
  deleteTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteTestBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#ef4444',
  },
  deleteUserRowBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteModalBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#ef4444',
  },
});
