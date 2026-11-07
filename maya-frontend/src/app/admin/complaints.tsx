import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { supabase } from '@/services/supabase';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { mayaAlert } from '@/components/ui/alert-modal';
import type { AdminComplaintItem } from './users';

export interface AdminSessionReviewItem {
  id: string;
  sessionId: string;
  userId?: string;
  displayName: string;
  phoneNumber: string;
  email?: string | null;
  avatarUrl?: string | null;
  planTier: string;
  level?: string;
  topic: string;
  durationSeconds: number;
  overallScore: number;
  rating: number;
  feedback?: string | null;
  createdAt: string;
}

export interface SessionReviewStats {
  totalReviews: number;
  avgRating: number;
  commentsCount: number;
  withoutCommentsCount: number;
  starCounts: Record<number, number>;
}

type MainTab = 'complaints' | 'session_reviews';
type ReviewContentFilter = 'ALL' | 'WITH_COMMENT' | 'RATING_ONLY';
type ReviewStarFilter = 'ALL' | 5 | 4 | 3 | 2 | 1;

function StarRatingDisplay({
  rating,
  size = 14,
  showNumber = false,
}: {
  rating: number;
  size?: number;
  showNumber?: boolean;
}) {
  const rounded = Math.round(rating);
  return (
    <View style={styles.starRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Ionicons
            key={s}
            name={s <= rounded ? 'star' : 'star-outline'}
            size={size}
            color={s <= rounded ? '#f59e0b' : '#cbd5e1'}
          />
        ))}
      </View>
      {showNumber && (
        <Text style={styles.starNumberText}>
          {Number(rating).toFixed(1)}
        </Text>
      )}
    </View>
  );
}

export default function AdminComplaintsScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);

  // Active Main Tab: 'complaints' vs 'session_reviews'
  const [activeTab, setActiveTab] = useState<MainTab>('session_reviews');

  // --- Complaints State ---
  const [complaints, setComplaints] = useState<AdminComplaintItem[]>([]);
  const [complaintStats, setComplaintStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(true);
  const [complaintSearch, setComplaintSearch] = useState('');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<'ALL' | 'open' | 'resolved'>('ALL');

  // --- Session Reviews State ---
  const [reviews, setReviews] = useState<AdminSessionReviewItem[]>([]);
  const [reviewStats, setReviewStats] = useState<SessionReviewStats>({
    totalReviews: 0,
    avgRating: 0,
    commentsCount: 0,
    withoutCommentsCount: 0,
    starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewContentFilter, setReviewContentFilter] = useState<ReviewContentFilter>('ALL');
  const [reviewStarFilter, setReviewStarFilter] = useState<ReviewStarFilter>('ALL');
  const [reviewViewMode, setReviewViewMode] = useState<'table' | 'cards'>('table');

  // Fetch Complaints
  const fetchComplaints = async () => {
    setIsComplaintsLoading(true);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/complaints`);
      if (res.ok) {
        const data = await res.json();
        setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
        if (data.stats) {
          setComplaintStats(data.stats);
        }
      }
    } catch (err) {
      console.warn('[AdminComplaints] Failed to load complaints:', err);
    } finally {
      setIsComplaintsLoading(false);
    }
  };

  // Fetch Session Reviews (with resilient direct-Supabase fallback)
  const fetchReviews = async () => {
    setIsReviewsLoading(true);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/session-reviews`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
        if (data.stats) {
          setReviewStats(data.stats);
        }
        setIsReviewsLoading(false);
        return;
      }
    } catch {
      // Backend request fallback to Supabase query below
    }

    // Direct Supabase Fallback
    try {
      if (supabase) {
        const [{ data: sessionRows }, { data: profiles }] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, user_id, topic, status, duration_seconds, overall_score, user_rating, user_feedback, summary, created_at, start_time')
            .not('user_rating', 'is', null)
            .order('created_at', { ascending: false }),
          supabase.from('profiles').select('*'),
        ]);

        const profileMap = new Map<string, any>();
        for (const p of profiles || []) {
          profileMap.set(p.id, p);
        }

        const items: AdminSessionReviewItem[] = (sessionRows || []).map((row: any) => {
          const prof = row.user_id ? profileMap.get(row.user_id) : null;
          const feedback = row.user_feedback ? String(row.user_feedback).trim() : null;
          return {
            id: row.id,
            sessionId: row.id,
            userId: row.user_id,
            displayName: prof?.display_name || 'Anonymous Student',
            phoneNumber: prof?.phone_number || 'No phone',
            email: prof?.email || null,
            avatarUrl: prof?.avatar_url || null,
            planTier: prof?.plan_tier || 'starter',
            level: prof?.level || 'Intermediate',
            topic: row.topic || 'Speaking Practice',
            durationSeconds: row.duration_seconds || 0,
            overallScore: row.overall_score || 0,
            rating: Number(row.user_rating) || 5,
            feedback: feedback && feedback.length > 0 ? feedback : null,
            createdAt: row.created_at || row.start_time || new Date().toISOString(),
          };
        });

        const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let totalScore = 0;
        let commentsCount = 0;

        for (const r of items) {
          const s = Math.min(5, Math.max(1, Math.round(r.rating)));
          starCounts[s] = (starCounts[s] || 0) + 1;
          totalScore += r.rating;
          if (r.feedback) commentsCount += 1;
        }

        const totalReviews = items.length;
        const avgRating = totalReviews > 0 ? Number((totalScore / totalReviews).toFixed(1)) : 0;

        setReviews(items);
        setReviewStats({
          totalReviews,
          avgRating,
          commentsCount,
          withoutCommentsCount: totalReviews - commentsCount,
          starCounts,
        });
      }
    } catch (err) {
      console.warn('[AdminComplaints] Failed to load session reviews via fallback:', err);
    } finally {
      setIsReviewsLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchReviews();
  }, []);

  const handleRefresh = () => {
    fetchComplaints();
    fetchReviews();
  };

  // Complaint Actions
  const handleToggleStatus = async (item: AdminComplaintItem) => {
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
      message: `Are you sure you want to delete this complaint from ${item.displayName}?`,
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

  // Delete / Clear Session Review
  const handleDeleteReview = async (item: AdminSessionReviewItem) => {
    const confirmed = await mayaAlert.confirm({
      title: 'Delete Session Review',
      message: `Are you sure you want to remove this ${item.rating}-star review from ${item.displayName}?`,
      confirmText: 'Delete Review',
      cancelText: 'Cancel',
      type: 'warning',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/session-reviews/${item.sessionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchReviews();
        return;
      }
    } catch {}

    // Fallback: update in Supabase directly
    try {
      if (supabase) {
        await supabase
          .from('sessions')
          .update({ user_rating: null, user_feedback: null })
          .eq('id', item.sessionId);
        fetchReviews();
      }
    } catch {}
  };

  // Filtered Complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (complaintStatusFilter !== 'ALL' && c.status !== complaintStatusFilter) return false;
      if (complaintSearch.trim()) {
        const q = complaintSearch.toLowerCase().trim();
        const matchName = (c.displayName || '').toLowerCase().includes(q);
        const matchPhone = (c.phoneNumber || '').toLowerCase().includes(q);
        const matchEmail = (c.email || '').toLowerCase().includes(q);
        const matchMsg = (c.message || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchEmail || matchMsg;
      }
      return true;
    });
  }, [complaints, complaintStatusFilter, complaintSearch]);

  // Filtered Session Reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      // Star Filter
      if (reviewStarFilter !== 'ALL' && Math.round(r.rating) !== reviewStarFilter) {
        return false;
      }
      // Content Filter
      if (reviewContentFilter === 'WITH_COMMENT' && !r.feedback) {
        return false;
      }
      if (reviewContentFilter === 'RATING_ONLY' && r.feedback) {
        return false;
      }
      // Search
      if (reviewSearch.trim()) {
        const q = reviewSearch.toLowerCase().trim();
        const matchName = (r.displayName || '').toLowerCase().includes(q);
        const matchPhone = (r.phoneNumber || '').toLowerCase().includes(q);
        const matchTopic = (r.topic || '').toLowerCase().includes(q);
        const matchFeedback = (r.feedback || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchTopic || matchFeedback;
      }
      return true;
    });
  }, [reviews, reviewStarFilter, reviewContentFilter, reviewSearch]);

  const getInitials = (name?: string, phone?: string) => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (phone && phone.length > 2) return phone.slice(-2);
    return 'ST';
  };

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

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.mainLayout}>
        <AdminSidebar
          activeRoute="/admin/complaints"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <View style={styles.contentArea}>
          <AdminTopBar
            title={
              activeTab === 'session_reviews'
                ? 'Student Feedback & Session Reviews'
                : 'Student Complaints & Inquiries'
            }
            subtitle={
              activeTab === 'session_reviews'
                ? 'Real-time star ratings and optional post-session comments submitted by students.'
                : 'Review and resolve issues or inquiries submitted by students from the Account screen.'
            }
            badgeText={
              activeTab === 'session_reviews'
                ? `${reviewStats.totalReviews} Reviews • ${reviewStats.avgRating} ★`
                : `${complaintStats.open} Open`
            }
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            rightElement={
              <Pressable
                onPress={handleRefresh}
                style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
              >
                <Feather name="refresh-cw" size={14} color="#0d9488" />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
            }
          />

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollBodyContent}>
            {/* Top Navigation Tabs Switcher */}
            <View style={styles.tabSwitcherContainer}>
              <Pressable
                onPress={() => setActiveTab('session_reviews')}
                style={[
                  styles.tabButton,
                  activeTab === 'session_reviews' && styles.tabButtonActive,
                ]}
              >
                <Ionicons
                  name={activeTab === 'session_reviews' ? 'star' : 'star-outline'}
                  size={17}
                  color={activeTab === 'session_reviews' ? '#f59e0b' : '#64748b'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'session_reviews' && styles.tabButtonTextActive,
                  ]}
                >
                  Session Reviews
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === 'session_reviews' && styles.tabBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === 'session_reviews' && styles.tabBadgeTextActive,
                    ]}
                  >
                    {reviewStats.totalReviews}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('complaints')}
                style={[
                  styles.tabButton,
                  activeTab === 'complaints' && styles.tabButtonActive,
                ]}
              >
                <Feather
                  name="alert-circle"
                  size={16}
                  color={activeTab === 'complaints' ? '#0d9488' : '#64748b'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === 'complaints' && styles.tabButtonTextActive,
                  ]}
                >
                  Complaints & Inquiries
                </Text>
                {complaintStats.open > 0 && (
                  <View style={styles.tabBadgeAlert}>
                    <Text style={styles.tabBadgeAlertText}>{complaintStats.open} Open</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* TAB CONTENT: SESSION REVIEWS */}
            {activeTab === 'session_reviews' && (
              <>
                {/* Review Metric Cards (Overall Score + Star Count Breakdown + Comments Breakdown) */}
                <View style={styles.metricCardsGrid}>
                  {/* Card 1: Average Rating & Overall Quality */}
                  <View style={styles.metricCard}>
                    <View style={styles.ratingHeroWrap}>
                      <Text style={styles.ratingHeroNumber}>
                        {reviewStats.avgRating ? reviewStats.avgRating.toFixed(1) : '5.0'}
                      </Text>
                      <View style={{ gap: 4 }}>
                        <StarRatingDisplay rating={reviewStats.avgRating || 5} size={18} />
                        <Text style={styles.ratingHeroSubtext}>
                          Based on {reviewStats.totalReviews} total ratings
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Card 2: Star Counts Distribution (5★, 4★, 3★, 2★, 1★) */}
                  <View style={[styles.metricCard, { flex: 1.4 }]}>
                    <View style={styles.cardHeaderSmall}>
                      <Text style={styles.metricLabelBold}>Star Rating Count</Text>
                      <Text style={styles.metricLabelSub}>Click a row to filter</Text>
                    </View>
                    <View style={styles.starDistributionList}>
                      {([5, 4, 3, 2, 1] as const).map((star) => {
                        const count = reviewStats.starCounts[star] || 0;
                        const pct =
                          reviewStats.totalReviews > 0
                            ? Math.round((count / reviewStats.totalReviews) * 100)
                            : 0;
                        const isSelected = reviewStarFilter === star;
                        return (
                          <Pressable
                            key={star}
                            onPress={() =>
                              setReviewStarFilter(isSelected ? 'ALL' : star)
                            }
                            style={[
                              styles.starDistRow,
                              isSelected && styles.starDistRowSelected,
                            ]}
                          >
                            <View style={styles.starDistLabel}>
                              <Text style={styles.starDistLabelText}>{star}</Text>
                              <Ionicons name="star" size={12} color="#f59e0b" />
                            </View>

                            <View style={styles.starProgressBarTrack}>
                              <View
                                style={[
                                  styles.starProgressBarFill,
                                  { width: `${pct}%` },
                                  isSelected && { backgroundColor: '#f59e0b' },
                                ]}
                              />
                            </View>

                            <View style={styles.starDistCountWrap}>
                              <Text style={styles.starDistCountText}>{count}</Text>
                              <Text style={styles.starDistPctText}>({pct}%)</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Card 3: Feedback vs Rating Only Breakdown */}
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabelBold}>Feedback Separation</Text>
                    <View style={styles.commentSplitGrid}>
                      <Pressable
                        onPress={() =>
                          setReviewContentFilter(
                            reviewContentFilter === 'WITH_COMMENT' ? 'ALL' : 'WITH_COMMENT'
                          )
                        }
                        style={[
                          styles.commentSplitPill,
                          reviewContentFilter === 'WITH_COMMENT' && styles.commentSplitPillActive,
                        ]}
                      >
                        <View style={[styles.splitIconBox, { backgroundColor: '#f0fdfa' }]}>
                          <Feather name="message-circle" size={16} color="#0d9488" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.splitCountValue}>{reviewStats.commentsCount}</Text>
                          <Text style={styles.splitCountLabel}>With Written Comments</Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          setReviewContentFilter(
                            reviewContentFilter === 'RATING_ONLY' ? 'ALL' : 'RATING_ONLY'
                          )
                        }
                        style={[
                          styles.commentSplitPill,
                          reviewContentFilter === 'RATING_ONLY' && styles.commentSplitPillActive,
                        ]}
                      >
                        <View style={[styles.splitIconBox, { backgroundColor: '#f8fafc' }]}>
                          <Feather name="star" size={16} color="#64748b" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.splitCountValue}>{reviewStats.withoutCommentsCount}</Text>
                          <Text style={styles.splitCountLabel}>Rating Only (No Text)</Text>
                        </View>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Filter & Search Bar */}
                <View style={styles.filterBarCard}>
                  <View style={styles.searchInputWrap}>
                    <Feather name="search" size={16} color="#94a3b8" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by student name, phone, topic, or comment..."
                      placeholderTextColor="#94a3b8"
                      value={reviewSearch}
                      onChangeText={setReviewSearch}
                    />
                    {reviewSearch.length > 0 && (
                      <Pressable onPress={() => setReviewSearch('')}>
                        <Feather name="x-circle" size={16} color="#94a3b8" />
                      </Pressable>
                    )}
                  </View>

                  {/* Comment Separation Filter Pills */}
                  <View style={styles.filterPillRow}>
                    <Text style={styles.filterSectionTitle}>Show:</Text>
                    <Pressable
                      onPress={() => setReviewContentFilter('ALL')}
                      style={[
                        styles.filterPill,
                        reviewContentFilter === 'ALL' && styles.filterPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          reviewContentFilter === 'ALL' && styles.filterPillTextActive,
                        ]}
                      >
                        All ({reviewStats.totalReviews})
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setReviewContentFilter('WITH_COMMENT')}
                      style={[
                        styles.filterPill,
                        styles.filterPillComment,
                        reviewContentFilter === 'WITH_COMMENT' && styles.filterPillCommentActive,
                      ]}
                    >
                      <Feather
                        name="message-circle"
                        size={12}
                        color={reviewContentFilter === 'WITH_COMMENT' ? '#ffffff' : '#0d9488'}
                      />
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: reviewContentFilter === 'WITH_COMMENT' ? '#ffffff' : '#0d9488' },
                        ]}
                      >
                        With Comments ({reviewStats.commentsCount})
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setReviewContentFilter('RATING_ONLY')}
                      style={[
                        styles.filterPill,
                        reviewContentFilter === 'RATING_ONLY' && styles.filterPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          reviewContentFilter === 'RATING_ONLY' && styles.filterPillTextActive,
                        ]}
                      >
                        Rating Only ({reviewStats.withoutCommentsCount})
                      </Text>
                    </Pressable>
                  </View>

                  {/* Star Filter Pills */}
                  <View style={styles.filterPillRow}>
                    <Text style={styles.filterSectionTitle}>Stars:</Text>
                    <Pressable
                      onPress={() => setReviewStarFilter('ALL')}
                      style={[
                        styles.filterPillSmall,
                        reviewStarFilter === 'ALL' && styles.filterPillSmallActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillSmallText,
                          reviewStarFilter === 'ALL' && styles.filterPillSmallTextActive,
                        ]}
                      >
                        All
                      </Text>
                    </Pressable>

                    {([5, 4, 3, 2, 1] as const).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setReviewStarFilter(reviewStarFilter === s ? 'ALL' : s)}
                        style={[
                          styles.filterPillSmall,
                          reviewStarFilter === s && styles.filterPillSmallActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterPillSmallText,
                            reviewStarFilter === s && styles.filterPillSmallTextActive,
                          ]}
                        >
                          {s} ★ ({reviewStats.starCounts[s] || 0})
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* View Mode Toggle: Table vs Cards */}
                  <View style={styles.viewModeGroup}>
                    <Pressable
                      onPress={() => setReviewViewMode('table')}
                      style={[
                        styles.viewModeBtn,
                        reviewViewMode === 'table' && styles.viewModeBtnActive,
                      ]}
                      accessibilityLabel="Table View"
                    >
                      <Feather
                        name="list"
                        size={14}
                        color={reviewViewMode === 'table' ? '#0d9488' : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.viewModeBtnText,
                          reviewViewMode === 'table' && styles.viewModeBtnTextActive,
                        ]}
                      >
                        Table
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setReviewViewMode('cards')}
                      style={[
                        styles.viewModeBtn,
                        reviewViewMode === 'cards' && styles.viewModeBtnActive,
                      ]}
                      accessibilityLabel="Comments Feed View"
                    >
                      <Feather
                        name="grid"
                        size={14}
                        color={reviewViewMode === 'cards' ? '#0d9488' : '#64748b'}
                      />
                      <Text
                        style={[
                          styles.viewModeBtnText,
                          reviewViewMode === 'cards' && styles.viewModeBtnTextActive,
                        ]}
                      >
                        Comments Feed
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Session Reviews Table or Cards Feed */}
                <View style={styles.tableCard}>
                  <View style={styles.tableCardHeader}>
                    <View>
                      <Text style={styles.tableTitle}>
                        {reviewContentFilter === 'WITH_COMMENT'
                          ? 'Student Written Comments & Feedback'
                          : 'Student Session Reviews'}
                      </Text>
                      <Text style={styles.tableSubtitle}>
                        Showing {filteredReviews.length} of {reviews.length} reviews
                        {reviewStarFilter !== 'ALL' ? ` • ${reviewStarFilter} Stars only` : ''}
                        {reviewContentFilter === 'WITH_COMMENT'
                          ? ' • Filtered to show written comments'
                          : reviewContentFilter === 'RATING_ONLY'
                          ? ' • Filtered to show rating only'
                          : ''}
                      </Text>
                    </View>
                  </View>

                  {isReviewsLoading ? (
                    <AdminTableSkeleton rows={5} />
                  ) : filteredReviews.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="star-outline" size={40} color="#94a3b8" />
                      <Text style={styles.emptyTitle}>No session reviews found</Text>
                      <Text style={styles.emptySubtitle}>
                        {reviewSearch || reviewStarFilter !== 'ALL' || reviewContentFilter !== 'ALL'
                          ? 'Try resetting the filters or clearing the search query.'
                          : 'When students rate their sessions, their star counts and comments will appear here.'}
                      </Text>
                    </View>
                  ) : reviewViewMode === 'cards' ? (
                    /* CARDS / COMMENTS FEED VIEW */
                    <View style={styles.reviewCardsGrid}>
                      {filteredReviews.map((rev) => {
                        const tierStyle = getTierColor(rev.planTier);
                        const hasComment = Boolean(rev.feedback && rev.feedback.trim().length > 0);
                        return (
                          <View
                            key={rev.id}
                            style={[
                              styles.reviewFeedCard,
                              hasComment && styles.reviewFeedCardHighlighted,
                            ]}
                          >
                            <View style={styles.cardTopRow}>
                              <View style={styles.cardStudentInfo}>
                                <View style={styles.userAvatar}>
                                  {rev.avatarUrl ? (
                                    <Image
                                      source={{ uri: rev.avatarUrl }}
                                      style={styles.userAvatarImage}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <Text style={styles.avatarText}>
                                      {getInitials(rev.displayName, rev.phoneNumber)}
                                    </Text>
                                  )}
                                </View>
                                <View>
                                  <Text style={styles.userName} numberOfLines={1}>
                                    {rev.displayName || 'Anonymous Student'}
                                  </Text>
                                  <Text style={styles.userPhone} numberOfLines={1}>
                                    {rev.phoneNumber || 'No phone'}
                                  </Text>
                                </View>
                              </View>

                              <View
                                style={[
                                  styles.planBadge,
                                  { backgroundColor: tierStyle.bg, borderColor: tierStyle.border },
                                ]}
                              >
                                <Text style={[styles.planBadgeText, { color: tierStyle.text }]}>
                                  {(rev.planTier || 'starter').toUpperCase()}
                                </Text>
                              </View>
                            </View>

                            {/* Rating and Star Count Display */}
                            <View style={styles.cardRatingRow}>
                              <StarRatingDisplay rating={rev.rating} size={16} showNumber />
                              <Text style={styles.cardTopicBadge}>{rev.topic}</Text>
                            </View>

                            {/* Separately Highlighted Student Comment */}
                            {hasComment ? (
                              <View style={styles.commentHighlightBox}>
                                <View style={styles.commentIconRow}>
                                  <Feather name="message-circle" size={14} color="#0d9488" />
                                  <Text style={styles.commentBoxTag}>Student Comment</Text>
                                </View>
                                <Text style={styles.commentBoxText}>"{rev.feedback}"</Text>
                              </View>
                            ) : (
                              <View style={styles.noCommentPill}>
                                <Text style={styles.noCommentPillText}>
                                  Rating only • No written comment
                                </Text>
                              </View>
                            )}

                            {/* Card Footer: Date, Duration, and Action */}
                            <View style={styles.cardFooterRow}>
                              <Text style={styles.cardMetaText}>
                                {new Date(rev.createdAt).toLocaleDateString()} • {formatDuration(rev.durationSeconds)}
                              </Text>

                              <Pressable
                                onPress={() => handleDeleteReview(rev)}
                                style={({ pressed }) => [
                                  styles.deleteBtn,
                                  pressed && { opacity: 0.8 },
                                ]}
                                accessibilityLabel="Delete review"
                              >
                                <Feather name="trash-2" size={13} color="#ef4444" />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    /* STRUCTURED TABLE VIEW */
                    <View style={styles.table}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableColHeader, { flex: 1.8 }]}>STUDENT</Text>
                        <Text style={[styles.tableColHeader, { flex: 1.2 }]}>STAR RATING</Text>
                        <Text style={[styles.tableColHeader, { flex: 3.2 }]}>
                          STUDENT COMMENT (SEPARATE)
                        </Text>
                        <Text style={[styles.tableColHeader, { flex: 1.6 }]}>SESSION TOPIC</Text>
                        <Text style={[styles.tableColHeader, { flex: 1.1 }]}>DATE</Text>
                        <Text style={[styles.tableColHeader, { flex: 0.7, textAlign: 'right' }]}>
                          ACTIONS
                        </Text>
                      </View>

                      {filteredReviews.map((rev) => {
                        const tierStyle = getTierColor(rev.planTier);
                        const hasComment = Boolean(rev.feedback && rev.feedback.trim().length > 0);
                        return (
                          <View key={rev.id} style={styles.tableRow}>
                            {/* Col 1: Student info */}
                            <View
                              style={[
                                styles.tableCol,
                                { flex: 1.8, flexDirection: 'row', alignItems: 'center', gap: 10 },
                              ]}
                            >
                              <View style={styles.userAvatar}>
                                {rev.avatarUrl ? (
                                  <Image
                                    source={{ uri: rev.avatarUrl }}
                                    style={styles.userAvatarImage}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <Text style={styles.avatarText}>
                                    {getInitials(rev.displayName, rev.phoneNumber)}
                                  </Text>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.userName} numberOfLines={1}>
                                  {rev.displayName || 'Anonymous Student'}
                                </Text>
                                <Text style={styles.userPhone} numberOfLines={1}>
                                  {rev.phoneNumber || 'No phone'}
                                </Text>
                                <View
                                  style={[
                                    styles.planBadge,
                                    {
                                      backgroundColor: tierStyle.bg,
                                      borderColor: tierStyle.border,
                                      marginTop: 4,
                                    },
                                  ]}
                                >
                                  <Text style={[styles.planBadgeText, { color: tierStyle.text }]}>
                                    {(rev.planTier || 'starter').toUpperCase()}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            {/* Col 2: Star Rating & Count */}
                            <View style={[styles.tableCol, { flex: 1.2 }]}>
                              <StarRatingDisplay rating={rev.rating} size={15} showNumber />
                              <Text style={styles.starColSub}>
                                {rev.rating === 5
                                  ? '5 / 5 Stars'
                                  : `${Number(rev.rating).toFixed(1)} / 5 Stars`}
                              </Text>
                            </View>

                            {/* Col 3: Student Comment (Separately formatted) */}
                            <View style={[styles.tableCol, { flex: 3.2, paddingRight: 14 }]}>
                              {hasComment ? (
                                <View style={styles.commentTableCellBox}>
                                  <View style={styles.commentTableCellHeader}>
                                    <Feather name="message-circle" size={13} color="#0d9488" />
                                    <Text style={styles.commentTableCellLabel}>Student Comment</Text>
                                  </View>
                                  <Text style={styles.commentTableCellText}>
                                    "{rev.feedback}"
                                  </Text>
                                </View>
                              ) : (
                                <View style={styles.noCommentTableCell}>
                                  <Feather name="minus" size={12} color="#94a3b8" />
                                  <Text style={styles.noCommentTableCellText}>
                                    Rating only • No written comment
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Col 4: Session Topic & Duration */}
                            <View style={[styles.tableCol, { flex: 1.6 }]}>
                              <Text style={styles.topicText} numberOfLines={1}>
                                {rev.topic}
                              </Text>
                              <Text style={styles.durationSubText}>
                                {formatDuration(rev.durationSeconds)} • Score: {rev.overallScore}%
                              </Text>
                            </View>

                            {/* Col 5: Date */}
                            <View style={[styles.tableCol, { flex: 1.1 }]}>
                              <Text style={styles.dateText}>
                                {new Date(rev.createdAt).toLocaleDateString()}
                              </Text>
                              <Text style={styles.timeSubText}>
                                {new Date(rev.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>

                            {/* Col 6: Actions */}
                            <View
                              style={[
                                styles.tableCol,
                                { flex: 0.7, flexDirection: 'row', justifyContent: 'flex-end' },
                              ]}
                            >
                              <Pressable
                                onPress={() => handleDeleteReview(rev)}
                                style={({ pressed }) => [
                                  styles.actionBtn,
                                  styles.deleteBtn,
                                  pressed && { opacity: 0.8 },
                                ]}
                                accessibilityLabel="Delete review"
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
              </>
            )}

            {/* TAB CONTENT: COMPLAINTS & INQUIRIES */}
            {activeTab === 'complaints' && (
              <>
                {/* KPI Summary Cards */}
                <View style={styles.metricCardsGrid}>
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconWrap}>
                      <Feather name="message-square" size={18} color="#0d9488" />
                    </View>
                    <View>
                      <Text style={styles.metricLabel}>Total Submissions</Text>
                      <Text style={styles.metricValue}>{complaintStats.total}</Text>
                    </View>
                  </View>

                  <View style={styles.metricCard}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#fef2f2' }]}>
                      <Feather name="alert-circle" size={18} color="#dc2626" />
                    </View>
                    <View>
                      <Text style={styles.metricLabel}>Open Issues</Text>
                      <Text style={[styles.metricValue, { color: '#dc2626' }]}>
                        {complaintStats.open}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricCard}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#f0fdf4' }]}>
                      <Feather name="check-circle" size={18} color="#16a34a" />
                    </View>
                    <View>
                      <Text style={styles.metricLabel}>Resolved</Text>
                      <Text style={[styles.metricValue, { color: '#16a34a' }]}>
                        {complaintStats.resolved}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Filter & Search Bar */}
                <View style={styles.filterBarCard}>
                  <View style={styles.searchInputWrap}>
                    <Feather name="search" size={16} color="#94a3b8" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by student name, phone, email, or complaint text..."
                      placeholderTextColor="#94a3b8"
                      value={complaintSearch}
                      onChangeText={setComplaintSearch}
                    />
                    {complaintSearch.length > 0 && (
                      <Pressable onPress={() => setComplaintSearch('')}>
                        <Feather name="x-circle" size={16} color="#94a3b8" />
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.statusFilterGroup}>
                    {(['ALL', 'open', 'resolved'] as const).map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => setComplaintStatusFilter(st)}
                        style={[
                          styles.filterPill,
                          complaintStatusFilter === st && styles.filterPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterPillText,
                            complaintStatusFilter === st && styles.filterPillTextActive,
                          ]}
                        >
                          {st === 'ALL' ? 'All' : st.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Complaints Table */}
                <View style={styles.tableCard}>
                  <View style={styles.tableCardHeader}>
                    <Text style={styles.tableTitle}>Submitted Complaints & Feedback</Text>
                    <Text style={styles.tableSubtitle}>
                      Showing {filteredComplaints.length} of {complaints.length} items
                    </Text>
                  </View>

                  {isComplaintsLoading ? (
                    <AdminTableSkeleton rows={5} />
                  ) : filteredComplaints.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Feather name="message-square" size={36} color="#94a3b8" />
                      <Text style={styles.emptyTitle}>No complaints found</Text>
                      <Text style={styles.emptySubtitle}>
                        When students submit complaints or feedback, they will appear here.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.table}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableColHeader, { flex: 1.8 }]}>STUDENT</Text>
                        <Text style={[styles.tableColHeader, { flex: 0.9 }]}>PLAN</Text>
                        <Text style={[styles.tableColHeader, { flex: 2.8 }]}>
                          COMPLAINT / FEEDBACK MESSAGE
                        </Text>
                        <Text style={[styles.tableColHeader, { flex: 1.1 }]}>SUBMITTED</Text>
                        <Text style={[styles.tableColHeader, { flex: 0.9 }]}>STATUS</Text>
                        <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right' }]}>
                          ACTIONS
                        </Text>
                      </View>

                      {filteredComplaints.map((c) => {
                        const tierStyle = getTierColor(c.planTier);
                        const isResolved = c.status === 'resolved';
                        return (
                          <View key={c.id} style={styles.tableRow}>
                            <View
                              style={[
                                styles.tableCol,
                                { flex: 1.8, flexDirection: 'row', alignItems: 'center', gap: 10 },
                              ]}
                            >
                              <View style={styles.userAvatar}>
                                {c.avatarUrl ? (
                                  <Image
                                    source={{ uri: c.avatarUrl }}
                                    style={styles.userAvatarImage}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <Text style={styles.avatarText}>
                                    {getInitials(c.displayName, c.phoneNumber)}
                                  </Text>
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

                            <View style={[styles.tableCol, { flex: 2.8, paddingRight: 12 }]}>
                              <Text style={styles.messageText}>{c.message}</Text>
                            </View>

                            <View style={[styles.tableCol, { flex: 1.1 }]}>
                              <Text style={styles.dateText}>
                                {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}
                              </Text>
                              <Text style={styles.timeSubText}>
                                {c.createdAt
                                  ? new Date(c.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </Text>
                            </View>

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

                            <View
                              style={[
                                styles.tableCol,
                                { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
                              ]}
                            >
                              <Pressable
                                onPress={() => handleToggleStatus(c)}
                                style={({ pressed }) => [
                                  styles.actionBtn,
                                  isResolved ? styles.reopenBtn : styles.resolveBtn,
                                  pressed && { opacity: 0.8 },
                                ]}
                              >
                                <Feather
                                  name={isResolved ? 'rotate-ccw' : 'check'}
                                  size={13}
                                  color={isResolved ? '#475569' : '#0d9488'}
                                />
                                <Text
                                  style={isResolved ? styles.reopenBtnText : styles.resolveBtnText}
                                >
                                  {isResolved ? 'Reopen' : 'Resolve'}
                                </Text>
                              </Pressable>

                              <Pressable
                                onPress={() => handleDeleteComplaint(c)}
                                style={({ pressed }) => [
                                  styles.actionBtn,
                                  styles.deleteBtn,
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
              </>
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
    backgroundColor: '#f8fafc',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    flexDirection: 'column',
  },
  scrollBody: {
    flex: 1,
  },
  scrollBodyContent: {
    padding: 24,
    gap: 20,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  refreshBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#0d9488',
  },

  // Tab Switcher
  tabSwitcherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  tabButtonText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#0d9488',
  },
  tabBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  tabBadgeActive: {
    backgroundColor: '#ccfbf1',
  },
  tabBadgeText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#64748b',
  },
  tabBadgeTextActive: {
    color: '#0d9488',
  },
  tabBadgeAlert: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  tabBadgeAlertText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#dc2626',
  },

  // Metric Cards
  metricCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ratingHeroWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingHeroNumber: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 44,
    color: '#0f172a',
    lineHeight: 48,
  },
  ratingHeroSubtext: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  cardHeaderSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricLabelBold: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  metricLabelSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
  },

  // Star Distribution
  starDistributionList: {
    gap: 6,
  },
  starDistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  starDistRowSelected: {
    backgroundColor: '#fffbeb',
  },
  starDistLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    width: 24,
  },
  starDistLabelText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12,
    color: '#334155',
  },
  starProgressBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  starProgressBarFill: {
    height: '100%',
    backgroundColor: '#fcd34d',
    borderRadius: 4,
  },
  starDistCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 60,
    justifyContent: 'flex-end',
  },
  starDistCountText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0f172a',
  },
  starDistPctText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
  },

  // Comment Split Grid
  commentSplitGrid: {
    gap: 8,
    marginTop: 10,
  },
  commentSplitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commentSplitPillActive: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
  },
  splitIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitCountValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0f172a',
  },
  splitCountLabel: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },

  metricIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  metricValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0f172a',
    marginTop: 2,
  },

  // Filter Bar
  filterBarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    ...fontStyle('inter', 'regular'),
  },
  filterPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterSectionTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#94a3b8',
    marginRight: 2,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: '#0d9488',
  },
  filterPillComment: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterPillCommentActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  filterPillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  filterPillSmall: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillSmallActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  filterPillSmallText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#475569',
  },
  filterPillSmallTextActive: {
    color: '#ffffff',
    ...fontStyle('inter', 'bold'),
  },
  viewModeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  viewModeBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
  },
  viewModeBtnTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },

  statusFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Table Structure
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

  // User Avatar & Name
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

  // Star Display
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starNumberText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 13,
    color: '#0f172a',
  },
  starColSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
  },

  // Separate Comment Styling in Table
  commentTableCellBox: {
    backgroundColor: '#f0fdfa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    borderLeftWidth: 3,
    borderLeftColor: '#0d9488',
  },
  commentTableCellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  commentTableCellLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#0d9488',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  commentTableCellText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  noCommentTableCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  noCommentTableCellText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  // Topic & Duration
  topicText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#1e293b',
  },
  durationSubText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },

  // Date
  dateText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
  },
  timeSubText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },

  // Actions
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  resolveBtn: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  resolveBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#0d9488',
  },
  reopenBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reopenBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#475569',
  },
  deleteBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },

  // Cards / Comments Feed View
  reviewCardsGrid: {
    padding: 18,
    gap: 14,
  },
  reviewFeedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  reviewFeedCardHighlighted: {
    borderColor: '#99f6e4',
    backgroundColor: '#fdfffe',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardStudentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cardTopicBadge: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#475569',
  },
  commentHighlightBox: {
    backgroundColor: '#f0fdfa',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    borderLeftWidth: 4,
    borderLeftColor: '#0d9488',
    gap: 6,
  },
  commentIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  commentBoxTag: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#0d9488',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  commentBoxText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    lineHeight: 21,
    color: '#0f172a',
    fontStyle: 'italic',
  },
  noCommentPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    alignSelf: 'flex-start',
  },
  noCommentPillText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardMetaText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
  },

  // Complaints message text
  messageText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    lineHeight: 19,
    color: '#1e293b',
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
    textAlign: 'center',
    maxWidth: 400,
  },
});
