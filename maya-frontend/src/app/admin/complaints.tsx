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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { supabase } from '@/services/supabase';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { mayaAlert } from '@/components/ui/alert-modal';
import { AdminAuthStore } from '@/services/store/admin-auth-store';
import type { AdminComplaintItem } from './users';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

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

type MainTab = 'reviews' | 'complaints';
type ContentFilter = 'ALL' | 'WITH_COMMENT' | 'RATING_ONLY';
type StarFilter = 'ALL' | 5 | 4 | 3 | 2 | 1;
type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';
type ComplaintFilter = 'ALL' | 'open' | 'resolved';
type ComplaintSort = 'newest' | 'oldest';

/* -------------------------------------------------------------------------- */
/*  Theme + helpers                                                           */
/* -------------------------------------------------------------------------- */

const C = {
  bg: '#f6f8fb',
  card: '#ffffff',
  border: '#e6eaf0',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  soft: '#f1f5f9',
  teal: '#0d9488',
  blue: '#3b82f6',
  amber: '#f59e0b',
  green: '#16a34a',
  red: '#ef4444',
};

const PAGE_SIZE = 15;

const shadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.04,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  elevation: 1,
} as const;

const adminHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = AdminAuthStore.getToken();
  if (token) h['x-admin-token'] = token;
  return h;
};

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
  return m === 0 ? `${s}s` : `${m}m ${s}s`;
};

const timeAgo = (iso?: string) => {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const sentimentColor = (r: number) => (r >= 4 ? C.green : r === 3 ? C.amber : C.red);

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

function StarRating({ rating, size = 14, showNumber = false }: { rating: number; size?: number; showNumber?: boolean }) {
  const rounded = Math.round(rating);
  return (
    <View style={s.starRow}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Ionicons key={n} name={n <= rounded ? 'star' : 'star-outline'} size={size} color={n <= rounded ? C.amber : '#cbd5e1'} />
        ))}
      </View>
      {showNumber ? <Text style={s.starNumber}>{Number(rating).toFixed(1)}</Text> : null}
    </View>
  );
}

function Avatar({ url, name, phone, size = 38 }: { url?: string | null; name?: string; phone?: string; size?: number }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={s.avatarText}>{getInitials(name, phone)}</Text>
      )}
    </View>
  );
}

function PlanBadge({ tier }: { tier?: string }) {
  const t = getTierColor(tier || 'starter');
  return (
    <View style={[s.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text style={[s.badgeText, { color: t.text }]}>{(tier || 'starter').toUpperCase()}</Text>
    </View>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <View style={s.segment}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={String(o.key)} onPress={() => onChange(o.key)} style={[s.segItem, active && s.segItemActive]}>
            <Text style={[s.segText, active && s.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tint,
  footer,
  footerColor,
  right,
  onPress,
  active,
}: {
  label: string;
  value: string;
  icon: string;
  tint: string;
  footer?: string;
  footerColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  active?: boolean;
}) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[s.kpiCard, active && { borderColor: tint, backgroundColor: `${tint}08` }]}
    >
      <View style={s.kpiTop}>
        <View style={[s.kpiIcon, { backgroundColor: `${tint}18` }]}>
          <Feather name={icon as any} size={16} color={tint} />
        </View>
        <Text style={s.kpiLabel}>{label}</Text>
      </View>
      <View style={s.kpiMid}>
        <Text style={s.kpiValue}>{value}</Text>
        {right}
      </View>
      {footer ? <Text style={[s.kpiFooter, footerColor ? { color: footerColor } : null]}>{footer}</Text> : null}
    </Wrapper>
  );
}

function Card({ title, subtitle, icon, tint = C.teal, right, children, style }: any) {
  return (
    <View style={[s.card, style]}>
      <View style={s.cardHeader}>
        <View style={s.cardHeaderLeft}>
          <View style={[s.cardIcon, { backgroundColor: `${tint}18` }]}>
            <Feather name={icon} size={16} color={tint} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.cardTitle}>{title}</Text>
            {subtitle ? <Text style={s.cardSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function FilterChip({
  label,
  active,
  color = C.teal,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
  icon?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => [
        s.chip,
        hovered && !active && { backgroundColor: C.soft },
        active && { backgroundColor: `${color}14`, borderColor: color },
      ]}
    >
      {icon ? <Feather name={icon as any} size={12} color={active ? color : C.muted} /> : null}
      <Text style={[s.chipText, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Feather name={icon as any} size={26} color={C.faint} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
      {action ? (
        <Pressable onPress={action.onPress} style={s.emptyBtn}>
          <Text style={s.emptyBtnText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Tiny bar chart: reviews per day, hover/tap for the day's numbers. */
function ReviewsPerDay({ data }: { data: Array<{ label: string; full: string; count: number; avg: number }> }) {
  const [w, setW] = useState(320);
  const [idx, setIdx] = useState<number | null>(null);
  const h = 110;
  const pad = { t: 8, b: 20, l: 4, r: 4 };
  const iw = Math.max(w - pad.l - pad.r, 40);
  const ih = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.count), 1);
  const colW = iw / data.length;
  const bw = Math.min(colW * 0.6, 18);
  const act = idx !== null ? data[idx] : null;

  return (
    <View>
      <Text style={s.miniTooltip}>
        {act
          ? `${act.full}: ${act.count} review${act.count === 1 ? '' : 's'}${act.count ? ` · avg ${act.avg.toFixed(1)}★` : ''}`
          : 'Hover or tap a day'}
      </Text>
      <View style={{ height: h }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Svg width={w} height={h}>
          <Line x1={pad.l} x2={w - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="#dbe2ea" strokeWidth={1} />
          {data.map((d, i) => {
            const cx = pad.l + i * colW + colW / 2;
            const bh = (d.count / max) * ih;
            return (
              <G key={d.full}>
                <Rect
                  x={cx - bw / 2}
                  y={pad.t + ih - Math.max(bh, d.count > 0 ? 3 : 0)}
                  width={bw}
                  height={Math.max(bh, d.count > 0 ? 3 : 0)}
                  rx={3}
                  fill={d.count ? (d.avg >= 4 ? C.green : d.avg >= 3 ? C.amber : C.red) : C.soft}
                  opacity={idx !== null && idx !== i ? 0.4 : 1}
                />
                {i % 2 === 0 || data.length <= 7 ? (
                  <SvgText x={cx} y={h - 6} fontSize="9" fill={C.muted} textAnchor="middle">
                    {d.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
        <View style={[StyleSheet.absoluteFill, { left: pad.l, right: pad.r, flexDirection: 'row' }]}>
          {data.map((d, i) => (
            <Pressable
              key={d.full}
              style={{ flex: 1 }}
              onPress={() => setIdx(idx === i ? null : i)}
              {...({ onHoverIn: () => setIdx(i), onHoverOut: () => setIdx(null) } as any)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function AdminComplaintsScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);
  const [activeTab, setActiveTab] = useState<MainTab>('reviews');

  // Complaints
  const [complaints, setComplaints] = useState<AdminComplaintItem[]>([]);
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(true);
  const [complaintsError, setComplaintsError] = useState<string | null>(null);
  const [complaintSearch, setComplaintSearch] = useState('');
  const [complaintFilter, setComplaintFilter] = useState<ComplaintFilter>('ALL');
  const [complaintSort, setComplaintSort] = useState<ComplaintSort>('newest');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<AdminSessionReviewItem[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [reviewSearch, setReviewSearch] = useState('');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('ALL');
  const [starFilter, setStarFilter] = useState<StarFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  /* ------------------------------- Data layer ------------------------------ */

  const fetchComplaints = useCallback(async () => {
    setIsComplaintsLoading(true);
    setComplaintsError(null);
    try {
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/complaints`, { headers: adminHeaders() });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
    } catch (err: any) {
      console.warn('[AdminComplaints] Failed to load complaints:', err);
      setComplaintsError(err?.message || 'Failed to load complaints.');
    } finally {
      setIsComplaintsLoading(false);
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    setIsReviewsLoading(true);
    try {
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/session-reviews`, { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reviews)) setReviews(data.reviews);
        setIsReviewsLoading(false);
        return;
      }
    } catch {
      // fall through to Supabase fallback
    }

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
        for (const p of profiles || []) profileMap.set(p.id, p);

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
        setReviews(items);
      }
    } catch (err) {
      console.warn('[AdminComplaints] Failed to load session reviews via fallback:', err);
    } finally {
      setIsReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
    fetchReviews();
  }, [fetchComplaints, fetchReviews]);

  useEffect(() => {
    setSidebarOpen(!isPhone);
  }, [isPhone]);

  // Reset pagination whenever filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [reviewSearch, contentFilter, starFilter, sortKey]);

  const handleRefresh = () => {
    fetchComplaints();
    fetchReviews();
  };

  /* -------------------------------- Actions -------------------------------- */

  const handleToggleStatus = async (item: AdminComplaintItem) => {
    const nextStatus = item.status === 'resolved' ? 'open' : 'resolved';
    setBusyId(item.id);
    // optimistic update
    setComplaints((prev) => prev.map((c) => (c.id === item.id ? { ...c, status: nextStatus } : c)));
    try {
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/complaints/${item.id}/status`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      // rollback
      setComplaints((prev) => prev.map((c) => (c.id === item.id ? { ...c, status: item.status } : c)));
    } finally {
      setBusyId(null);
    }
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
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/complaints/${item.id}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      if (res.ok) setComplaints((prev) => prev.filter((c) => c.id !== item.id));
    } catch {}
  };

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
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/session-reviews/${item.sessionId}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== item.id));
        return;
      }
    } catch {}

    try {
      if (supabase) {
        await supabase.from('sessions').update({ user_rating: null, user_feedback: null }).eq('id', item.sessionId);
        setReviews((prev) => prev.filter((r) => r.id !== item.id));
      }
    } catch {}
  };

  /* ------------------------------ Derived: reviews ------------------------- */

  const rv = useMemo(() => {
    const total = reviews.length;
    const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let withComment = 0;
    for (const r of reviews) {
      const st = Math.min(5, Math.max(1, Math.round(r.rating)));
      starCounts[st] += 1;
      if (r.feedback) withComment += 1;
    }
    const avgRating = avg(reviews.map((r) => r.rating));
    const positive = starCounts[5] + starCounts[4];
    const neutral = starCounts[3];
    const negative = starCounts[2] + starCounts[1];

    const now = new Date();
    const days: Array<{ label: string; full: string; key: string; count: number; avg: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        key: dayKey(d),
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        full: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: 0,
        avg: 0,
      });
    }
    const sums: Record<string, number> = {};
    for (const r of reviews) {
      const k = dayKey(new Date(r.createdAt));
      const slot = days.find((x) => x.key === k);
      if (slot) {
        slot.count += 1;
        sums[k] = (sums[k] || 0) + r.rating;
      }
    }
    days.forEach((d) => (d.avg = d.count ? sums[d.key] / d.count : 0));

    const last7 = reviews.filter((r) => Date.now() - new Date(r.createdAt).getTime() < 7 * 86400000);
    const prev7 = reviews.filter((r) => {
      const age = Date.now() - new Date(r.createdAt).getTime();
      return age >= 7 * 86400000 && age < 14 * 86400000;
    });
    const avgDelta = last7.length && prev7.length ? avg(last7.map((r) => r.rating)) - avg(prev7.map((r) => r.rating)) : null;

    const attention = reviews.filter((r) => Math.round(r.rating) <= 2).length;

    return {
      total,
      starCounts,
      withComment,
      withoutComment: total - withComment,
      avgRating,
      positive,
      neutral,
      negative,
      days,
      last7Count: last7.length,
      avgDelta,
      attention,
      commentRate: total ? (withComment / total) * 100 : 0,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const q = reviewSearch.toLowerCase().trim();
    const list = reviews.filter((r) => {
      if (starFilter !== 'ALL' && Math.round(r.rating) !== starFilter) return false;
      if (contentFilter === 'WITH_COMMENT' && !r.feedback) return false;
      if (contentFilter === 'RATING_ONLY' && r.feedback) return false;
      if (q) {
        return (
          (r.displayName || '').toLowerCase().includes(q) ||
          (r.phoneNumber || '').toLowerCase().includes(q) ||
          (r.topic || '').toLowerCase().includes(q) ||
          (r.feedback || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
    const t = (r: AdminSessionReviewItem) => new Date(r.createdAt).getTime();
    list.sort((a, b) => {
      switch (sortKey) {
        case 'oldest':
          return t(a) - t(b);
        case 'highest':
          return b.rating - a.rating || t(b) - t(a);
        case 'lowest':
          return a.rating - b.rating || t(b) - t(a);
        default:
          return t(b) - t(a);
      }
    });
    return list;
  }, [reviews, starFilter, contentFilter, reviewSearch, sortKey]);

  const activeReviewFilters =
    (starFilter !== 'ALL' ? 1 : 0) + (contentFilter !== 'ALL' ? 1 : 0) + (reviewSearch.trim() ? 1 : 0);

  const clearReviewFilters = () => {
    setStarFilter('ALL');
    setContentFilter('ALL');
    setReviewSearch('');
  };

  /* ---------------------------- Derived: complaints ------------------------ */

  const cp = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter((c) => c.status !== 'resolved').length;
    const resolved = total - open;
    const oldestOpen = complaints
      .filter((c) => c.status !== 'resolved' && c.createdAt)
      .sort((a, b) => new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime())[0];
    return {
      total,
      open,
      resolved,
      rate: total ? (resolved / total) * 100 : 0,
      oldestOpen,
    };
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    const q = complaintSearch.toLowerCase().trim();
    const list = complaints.filter((c) => {
      if (complaintFilter !== 'ALL') {
        const isResolved = c.status === 'resolved';
        if (complaintFilter === 'resolved' && !isResolved) return false;
        if (complaintFilter === 'open' && isResolved) return false;
      }
      if (q) {
        return (
          (c.displayName || '').toLowerCase().includes(q) ||
          (c.phoneNumber || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.message || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
    const t = (c: AdminComplaintItem) => (c.createdAt ? new Date(c.createdAt as any).getTime() : 0);
    list.sort((a, b) => (complaintSort === 'newest' ? t(b) - t(a) : t(a) - t(b)));
    return list;
  }, [complaints, complaintFilter, complaintSearch, complaintSort]);

  /* --------------------------------- Renders ------------------------------- */

  const renderSearch = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <View style={s.searchWrap}>
      <Feather name="search" size={16} color={C.faint} />
      <TextInput
        style={s.searchInput}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        value={value}
        onChangeText={onChange}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Feather name="x-circle" size={16} color={C.faint} />
        </Pressable>
      ) : null}
    </View>
  );

  const renderReviews = () => {
    const shown = filteredReviews.slice(0, visibleCount);
    const pct = (n: number) => (rv.total ? Math.round((n / rv.total) * 100) : 0);

    return (
      <>
        {/* KPIs */}
        <View style={s.kpiGrid}>
          <KpiCard
            label="Average rating"
            icon="star"
            tint={C.amber}
            value={rv.total ? rv.avgRating.toFixed(1) : '-'}
            right={rv.total ? <StarRating rating={rv.avgRating} size={14} /> : undefined}
            footer={
              rv.avgDelta === null
                ? `${rv.total} total ratings`
                : `${rv.avgDelta >= 0 ? '+' : ''}${rv.avgDelta.toFixed(1)} vs previous 7 days`
            }
            footerColor={rv.avgDelta === null ? undefined : rv.avgDelta >= 0 ? C.green : C.red}
          />
          <KpiCard
            label="Reviews (7 days)"
            icon="inbox"
            tint={C.blue}
            value={String(rv.last7Count)}
            footer={`${rv.total} all time`}
          />
          <KpiCard
            label="With comments"
            icon="message-circle"
            tint={C.teal}
            value={`${rv.commentRate.toFixed(0)}%`}
            footer={`${rv.withComment} written · ${rv.withoutComment} rating only`}
            onPress={() => setContentFilter(contentFilter === 'WITH_COMMENT' ? 'ALL' : 'WITH_COMMENT')}
            active={contentFilter === 'WITH_COMMENT'}
          />
          <KpiCard
            label="Needs attention"
            icon="alert-triangle"
            tint={C.red}
            value={String(rv.attention)}
            footer={rv.attention ? 'Tap to see 1-2 star reviews' : 'No low ratings'}
            onPress={() => {
              if (!rv.attention) return;
              const isOn = starFilter === 1 || starFilter === 2;
              setStarFilter(isOn ? 'ALL' : 2);
            }}
            active={starFilter === 2 || starFilter === 1}
          />
        </View>

        {/* Distribution + trend */}
        <View style={s.grid}>
          <Card title="Rating breakdown" subtitle="Tap a row to filter" icon="bar-chart-2" tint={C.amber} style={s.gridItem}>
            <View style={s.sentimentBar}>
              {rv.total > 0 ? (
                <>
                  <View style={{ flex: Math.max(rv.positive, 0.0001), backgroundColor: C.green }} />
                  <View style={{ flex: Math.max(rv.neutral, 0.0001), backgroundColor: C.amber }} />
                  <View style={{ flex: Math.max(rv.negative, 0.0001), backgroundColor: C.red }} />
                </>
              ) : (
                <View style={{ flex: 1, backgroundColor: C.soft }} />
              )}
            </View>
            <View style={s.sentimentLegend}>
              <Text style={[s.sentimentText, { color: C.green }]}>{pct(rv.positive)}% positive</Text>
              <Text style={[s.sentimentText, { color: C.amber }]}>{pct(rv.neutral)}% neutral</Text>
              <Text style={[s.sentimentText, { color: C.red }]}>{pct(rv.negative)}% negative</Text>
            </View>

            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = rv.starCounts[star];
              const p = pct(count);
              const selected = starFilter === star;
              return (
                <Pressable
                  key={star}
                  onPress={() => setStarFilter(selected ? 'ALL' : star)}
                  style={({ hovered }: any) => [s.distRow, (selected || hovered) && { backgroundColor: C.bg }]}
                >
                  <View style={s.distLabel}>
                    <Text style={s.distLabelText}>{star}</Text>
                    <Ionicons name="star" size={12} color={C.amber} />
                  </View>
                  <View style={s.distTrack}>
                    <View style={[s.distFill, { width: `${p}%`, backgroundColor: sentimentColor(star) }]} />
                  </View>
                  <Text style={s.distCount}>{count}</Text>
                  <Text style={s.distPct}>{p}%</Text>
                </Pressable>
              );
            })}
          </Card>

          <Card title="Reviews per day" subtitle="Last 14 days, colored by average rating" icon="trending-up" tint={C.blue} style={s.gridItem}>
            <ReviewsPerDay data={rv.days} />
          </Card>
        </View>

        {/* Filters */}
        <View style={s.filterCard}>
          {renderSearch(reviewSearch, setReviewSearch, 'Search student, phone, topic or comment...')}
          <View style={s.filterRow}>
            <Segmented<ContentFilter>
              options={[
                { key: 'ALL', label: `All ${rv.total}` },
                { key: 'WITH_COMMENT', label: `Comments ${rv.withComment}` },
                { key: 'RATING_ONLY', label: `Rating only ${rv.withoutComment}` },
              ]}
              value={contentFilter}
              onChange={setContentFilter}
            />
            <Segmented<SortKey>
              options={[
                { key: 'newest', label: 'Newest' },
                { key: 'oldest', label: 'Oldest' },
                { key: 'highest', label: 'Highest' },
                { key: 'lowest', label: 'Lowest' },
              ]}
              value={sortKey}
              onChange={setSortKey}
            />
          </View>
          <View style={s.filterRow}>
            <FilterChip label="All stars" active={starFilter === 'ALL'} onPress={() => setStarFilter('ALL')} />
            {([5, 4, 3, 2, 1] as const).map((st) => (
              <FilterChip
                key={st}
                label={`${st}★ ${rv.starCounts[st]}`}
                color={sentimentColor(st)}
                active={starFilter === st}
                onPress={() => setStarFilter(starFilter === st ? 'ALL' : st)}
              />
            ))}
            {activeReviewFilters > 0 ? (
              <Pressable onPress={clearReviewFilters} style={s.clearBtn}>
                <Feather name="x" size={12} color={C.red} />
                <Text style={s.clearBtnText}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* List */}
        <View style={s.listCard}>
          <View style={s.listHeader}>
            <Text style={s.listTitle}>Student reviews</Text>
            <Text style={s.listSub}>
              Showing {Math.min(visibleCount, filteredReviews.length)} of {filteredReviews.length}
              {filteredReviews.length !== reviews.length ? ` (filtered from ${reviews.length})` : ''}
            </Text>
          </View>

          {isReviewsLoading && reviews.length === 0 ? (
            <AdminTableSkeleton rows={5} />
          ) : filteredReviews.length === 0 ? (
            reviews.length === 0 ? (
              <EmptyState icon="star" title="No reviews yet" text="When students rate their sessions, their ratings and comments will appear here." />
            ) : (
              <EmptyState
                icon="filter"
                title="No reviews match your filters"
                text="Try removing a filter or searching for something else."
                action={{ label: 'Clear filters', onPress: clearReviewFilters }}
              />
            )
          ) : (
            <>
              {shown.map((rev) => {
                const hasComment = !!(rev.feedback && rev.feedback.trim().length);
                const isLong = (rev.feedback?.length || 0) > 180;
                const isOpen = !!expanded[rev.id];
                const color = sentimentColor(rev.rating);
                return (
                  <View key={rev.id} style={[s.reviewRow, { borderLeftColor: color }]}>
                    <View style={s.reviewHead}>
                      <Avatar url={rev.avatarUrl} name={rev.displayName} phone={rev.phoneNumber} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={s.nameRow}>
                          <Text style={s.userName} numberOfLines={1}>
                            {rev.displayName || 'Anonymous Student'}
                          </Text>
                          <PlanBadge tier={rev.planTier} />
                        </View>
                        <Text style={s.userSub} numberOfLines={1}>
                          {rev.phoneNumber || 'No phone'}
                          {rev.level ? ` · ${rev.level}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <StarRating rating={rev.rating} size={14} showNumber />
                        <Text style={s.userSub}>{timeAgo(rev.createdAt)}</Text>
                      </View>
                    </View>

                    {hasComment ? (
                      <View style={s.commentBox}>
                        <Text style={s.commentText} numberOfLines={isOpen ? undefined : 3}>
                          {rev.feedback}
                        </Text>
                        {isLong ? (
                          <Pressable onPress={() => setExpanded((p) => ({ ...p, [rev.id]: !isOpen }))}>
                            <Text style={s.moreLink}>{isOpen ? 'Show less' : 'Read more'}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={s.reviewFoot}>
                      <View style={s.metaWrap}>
                        <View style={s.metaPill}>
                          <Feather name="book-open" size={11} color={C.muted} />
                          <Text style={s.metaText} numberOfLines={1}>
                            {rev.topic}
                          </Text>
                        </View>
                        <View style={s.metaPill}>
                          <Feather name="clock" size={11} color={C.muted} />
                          <Text style={s.metaText}>{formatDuration(rev.durationSeconds)}</Text>
                        </View>
                        <View style={s.metaPill}>
                          <Feather name="award" size={11} color={C.muted} />
                          <Text style={s.metaText}>Score {rev.overallScore}%</Text>
                        </View>
                        {!hasComment ? <Text style={s.noComment}>Rating only</Text> : null}
                      </View>
                      <Pressable
                        onPress={() => handleDeleteReview(rev)}
                        style={({ hovered }: any) => [s.iconBtn, hovered && { backgroundColor: '#fee2e2' }]}
                        accessibilityLabel="Delete review"
                      >
                        <Feather name="trash-2" size={14} color={C.red} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {visibleCount < filteredReviews.length ? (
                <Pressable onPress={() => setVisibleCount((v) => v + PAGE_SIZE)} style={s.moreBtn}>
                  <Text style={s.moreBtnText}>
                    Show {Math.min(PAGE_SIZE, filteredReviews.length - visibleCount)} more
                  </Text>
                  <Feather name="chevron-down" size={14} color={C.teal} />
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </>
    );
  };

  const renderComplaints = () => (
    <>
      {complaintsError ? (
        <View style={s.errorBanner}>
          <Feather name="alert-triangle" size={18} color={C.red} />
          <Text style={s.errorText}>{complaintsError}</Text>
          <Pressable onPress={fetchComplaints} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={s.kpiGrid}>
        <KpiCard label="Total submissions" icon="message-square" tint={C.teal} value={String(cp.total)} footer="All time" />
        <KpiCard
          label="Open issues"
          icon="alert-circle"
          tint={C.red}
          value={String(cp.open)}
          footer={cp.oldestOpen ? `Oldest waiting ${timeAgo(cp.oldestOpen.createdAt as any).replace(' ago', '')}` : 'All caught up'}
          footerColor={cp.open ? C.red : C.green}
          onPress={() => setComplaintFilter(complaintFilter === 'open' ? 'ALL' : 'open')}
          active={complaintFilter === 'open'}
        />
        <KpiCard
          label="Resolved"
          icon="check-circle"
          tint={C.green}
          value={String(cp.resolved)}
          footer={`${cp.rate.toFixed(0)}% resolution rate`}
          onPress={() => setComplaintFilter(complaintFilter === 'resolved' ? 'ALL' : 'resolved')}
          active={complaintFilter === 'resolved'}
        />
      </View>

      <View style={s.filterCard}>
        {renderSearch(complaintSearch, setComplaintSearch, 'Search student, phone, email or message...')}
        <View style={s.filterRow}>
          <Segmented<ComplaintFilter>
            options={[
              { key: 'ALL', label: `All ${cp.total}` },
              { key: 'open', label: `Open ${cp.open}` },
              { key: 'resolved', label: `Resolved ${cp.resolved}` },
            ]}
            value={complaintFilter}
            onChange={setComplaintFilter}
          />
          <Segmented<ComplaintSort>
            options={[
              { key: 'newest', label: 'Newest' },
              { key: 'oldest', label: 'Oldest' },
            ]}
            value={complaintSort}
            onChange={setComplaintSort}
          />
        </View>
      </View>

      <View style={s.listCard}>
        <View style={s.listHeader}>
          <Text style={s.listTitle}>Complaints & inquiries</Text>
          <Text style={s.listSub}>
            Showing {filteredComplaints.length} of {complaints.length}
          </Text>
        </View>

        {isComplaintsLoading && complaints.length === 0 ? (
          <AdminTableSkeleton rows={5} />
        ) : filteredComplaints.length === 0 ? (
          complaints.length === 0 ? (
            <EmptyState icon="message-square" title="No complaints yet" text="When students send complaints or feedback from the Account screen, they will appear here." />
          ) : (
            <EmptyState
              icon="filter"
              title="Nothing matches your filters"
              text="Try a different status or search."
              action={{
                label: 'Reset',
                onPress: () => {
                  setComplaintFilter('ALL');
                  setComplaintSearch('');
                },
              }}
            />
          )
        ) : (
          filteredComplaints.map((c) => {
            const isResolved = c.status === 'resolved';
            return (
              <View key={c.id} style={[s.reviewRow, { borderLeftColor: isResolved ? C.green : C.red }]}>
                <View style={s.reviewHead}>
                  <Avatar url={c.avatarUrl} name={c.displayName} phone={c.phoneNumber} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.nameRow}>
                      <Text style={s.userName} numberOfLines={1}>
                        {c.displayName || 'Anonymous Student'}
                      </Text>
                      <PlanBadge tier={c.planTier} />
                    </View>
                    <Text style={s.userSub} numberOfLines={1}>
                      {c.phoneNumber || 'No phone'}
                      {c.email ? ` · ${c.email}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View
                      style={[
                        s.badge,
                        { backgroundColor: isResolved ? '#f0fdf4' : '#fef2f2', borderColor: isResolved ? '#bbf7d0' : '#fecaca' },
                      ]}
                    >
                      <Text style={[s.badgeText, { color: isResolved ? C.green : '#dc2626' }]}>{isResolved ? 'RESOLVED' : 'OPEN'}</Text>
                    </View>
                    <Text style={s.userSub}>{timeAgo(c.createdAt as any)}</Text>
                  </View>
                </View>

                <View style={s.commentBox}>
                  <Text style={s.complaintText}>{c.message}</Text>
                </View>

                <View style={s.reviewFoot}>
                  <Text style={s.userSub}>
                    {c.createdAt ? new Date(c.createdAt as any).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => handleToggleStatus(c)}
                      disabled={busyId === c.id}
                      style={({ hovered }: any) => [
                        s.actionBtn,
                        isResolved ? s.reopenBtn : s.resolveBtn,
                        hovered && { opacity: 0.85 },
                        busyId === c.id && { opacity: 0.5 },
                      ]}
                    >
                      {busyId === c.id ? (
                        <ActivityIndicator size="small" color={C.teal} />
                      ) : (
                        <Feather name={isResolved ? 'rotate-ccw' : 'check'} size={13} color={isResolved ? '#475569' : C.teal} />
                      )}
                      <Text style={isResolved ? s.reopenText : s.resolveText}>{isResolved ? 'Reopen' : 'Mark resolved'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteComplaint(c)}
                      style={({ hovered }: any) => [s.iconBtn, hovered && { backgroundColor: '#fee2e2' }]}
                      accessibilityLabel="Delete complaint"
                    >
                      <Feather name="trash-2" size={14} color={C.red} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </>
  );

  const isLoadingAny = isReviewsLoading || isComplaintsLoading;

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <View style={s.mainLayout}>
        <AdminSidebar activeRoute="/admin/complaints" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <View style={s.contentArea}>
          <AdminTopBar
            title="Student Feedback"
            subtitle={
              activeTab === 'reviews'
                ? 'Star ratings and comments students leave after sessions'
                : 'Issues and inquiries sent from the Account screen'
            }
            badgeText={
              activeTab === 'reviews'
                ? `${rv.total} reviews${rv.total ? ` · ${rv.avgRating.toFixed(1)} ★` : ''}`
                : `${cp.open} open`
            }
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            rightElement={
              <Pressable
                onPress={handleRefresh}
                disabled={isLoadingAny}
                style={({ hovered }: any) => [s.refreshBtn, hovered && { backgroundColor: '#ccfbf1' }, isLoadingAny && { opacity: 0.6 }]}
              >
                {isLoadingAny ? <ActivityIndicator size="small" color={C.teal} /> : <Feather name="refresh-cw" size={14} color={C.teal} />}
                <Text style={s.refreshText}>Refresh</Text>
              </Pressable>
            }
          />

          {/* Tabs */}
          <View style={s.tabBar}>
            <Pressable onPress={() => setActiveTab('reviews')} style={[s.tab, activeTab === 'reviews' && s.tabActive]}>
              <Ionicons name={activeTab === 'reviews' ? 'star' : 'star-outline'} size={15} color={activeTab === 'reviews' ? C.amber : C.muted} />
              <Text style={[s.tabText, activeTab === 'reviews' && s.tabTextActive]}>Session reviews</Text>
              <View style={[s.tabCount, activeTab === 'reviews' && { backgroundColor: '#ccfbf1' }]}>
                <Text style={[s.tabCountText, activeTab === 'reviews' && { color: C.teal }]}>{rv.total}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setActiveTab('complaints')} style={[s.tab, activeTab === 'complaints' && s.tabActive]}>
              <Feather name="alert-circle" size={15} color={activeTab === 'complaints' ? C.teal : C.muted} />
              <Text style={[s.tabText, activeTab === 'complaints' && s.tabTextActive]}>Complaints</Text>
              {cp.open > 0 ? (
                <View style={[s.tabCount, { backgroundColor: '#fee2e2' }]}>
                  <Text style={[s.tabCountText, { color: '#dc2626' }]}>{cp.open} open</Text>
                </View>
              ) : (
                <View style={s.tabCount}>
                  <Text style={s.tabCountText}>{cp.total}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scroll, isPhone && { padding: 14 }]} showsVerticalScrollIndicator={false}>
            {activeTab === 'reviews' ? renderReviews() : renderComplaints()}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  mainLayout: { flex: 1, flexDirection: 'row' },
  contentArea: { flex: 1, flexDirection: 'column' },
  scroll: { padding: 24, paddingBottom: 64, gap: 16 },

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
  refreshText: { ...fontStyle('inter', 'medium'), fontSize: 12, color: C.teal },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 24,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.teal },
  tabText: { ...fontStyle('inter', 'medium'), fontSize: 13, color: C.muted },
  tabTextActive: { ...fontStyle('inter', 'semiBold'), color: C.teal },
  tabCount: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: C.soft },
  tabCountText: { ...fontStyle('inter', 'bold'), fontSize: 11, color: C.muted },

  // Errors
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 14,
  },
  errorText: { flex: 1, ...fontStyle('inter', 'medium'), fontSize: 13, color: '#991b1b' },
  retryBtn: { backgroundColor: C.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  retryText: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: '#fff' },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  kpiCard: {
    flexGrow: 1,
    flexBasis: 210,
    minWidth: 190,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    ...shadow,
  },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: C.muted },
  kpiMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 },
  kpiValue: { ...fontStyle('outfit', 'bold'), fontSize: 30, color: C.text },
  kpiFooter: { ...fontStyle('inter', 'regular'), fontSize: 12, color: C.muted },

  // Cards / grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { flexGrow: 1, flexBasis: 380, minWidth: 0 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border, ...shadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  cardIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...fontStyle('outfit', 'bold'), fontSize: 16, color: C.text },
  cardSubtitle: { ...fontStyle('inter', 'regular'), fontSize: 12, color: C.muted, marginTop: 2 },

  // Distribution
  sentimentBar: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', backgroundColor: C.soft },
  sentimentLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  sentimentText: { ...fontStyle('inter', 'semiBold'), fontSize: 11.5 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8 },
  distLabel: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 28 },
  distLabelText: { ...fontStyle('inter', 'bold'), fontSize: 12.5, color: '#334155' },
  distTrack: { flex: 1, height: 8, backgroundColor: C.soft, borderRadius: 4, overflow: 'hidden' },
  distFill: { height: '100%', borderRadius: 4 },
  distCount: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: C.text, width: 30, textAlign: 'right' },
  distPct: { ...fontStyle('inter', 'regular'), fontSize: 11.5, color: C.faint, width: 36, textAlign: 'right' },
  miniTooltip: { ...fontStyle('inter', 'medium'), fontSize: 12, color: C.muted, marginBottom: 6, minHeight: 18 },

  // Filters
  filterCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 12, ...shadow },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: C.text, ...fontStyle('inter', 'regular') },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  chipText: { ...fontStyle('inter', 'medium'), fontSize: 12, color: C.muted },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5 },
  clearBtnText: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: C.red },
  segment: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: 8, padding: 2 },
  segItem: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  segItemActive: { backgroundColor: '#fff', ...shadow },
  segText: { ...fontStyle('inter', 'medium'), fontSize: 12, color: C.muted },
  segTextActive: { ...fontStyle('inter', 'semiBold'), color: C.text },

  // List
  listCard: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', ...shadow },
  listHeader: { padding: 18, borderBottomWidth: 1, borderBottomColor: C.soft },
  listTitle: { ...fontStyle('outfit', 'bold'), fontSize: 16, color: C.text },
  listSub: { ...fontStyle('inter', 'regular'), fontSize: 12, color: C.muted, marginTop: 2 },

  reviewRow: {
    padding: 18,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.soft,
    borderLeftWidth: 4,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  userName: { ...fontStyle('inter', 'semiBold'), fontSize: 13.5, color: C.text, flexShrink: 1 },
  userSub: { ...fontStyle('inter', 'regular'), fontSize: 11.5, color: C.muted, marginTop: 1 },

  commentBox: { backgroundColor: C.bg, borderRadius: 10, padding: 12 },
  commentText: { ...fontStyle('inter', 'regular'), fontSize: 13.5, lineHeight: 20, color: '#1e293b' },
  complaintText: { ...fontStyle('inter', 'regular'), fontSize: 13.5, lineHeight: 20, color: '#1e293b' },
  moreLink: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: C.teal, marginTop: 6 },

  reviewFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  metaWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flexShrink: 1 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.soft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, maxWidth: 220 },
  metaText: { ...fontStyle('inter', 'medium'), fontSize: 11, color: C.muted, flexShrink: 1 },
  noComment: { ...fontStyle('inter', 'regular'), fontSize: 11, color: C.faint, fontStyle: 'italic' },

  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  moreBtnText: { ...fontStyle('inter', 'semiBold'), fontSize: 13, color: C.teal },

  // Atoms
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starNumber: { ...fontStyle('inter', 'bold'), fontSize: 13, color: C.text },
  avatar: { backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { ...fontStyle('outfit', 'bold'), fontSize: 13, color: '#0284c7' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  badgeText: { ...fontStyle('inter', 'bold'), fontSize: 10, letterSpacing: 0.5 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 8 },
  resolveBtn: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1' },
  resolveText: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: C.teal },
  reopenBtn: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  reopenText: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: '#475569' },

  // Empty
  empty: { alignItems: 'center', padding: 48, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...fontStyle('outfit', 'semiBold'), fontSize: 16, color: '#334155', marginTop: 6 },
  emptyText: { ...fontStyle('inter', 'regular'), fontSize: 13, color: C.faint, textAlign: 'center', maxWidth: 380 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#ccfbf1' },
  emptyBtnText: { ...fontStyle('inter', 'semiBold'), fontSize: 12.5, color: C.teal },
});