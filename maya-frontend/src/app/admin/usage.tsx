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
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { AdminSessionTranscriptAndPlayer } from '@/components/admin/AdminSessionTranscriptAndPlayer';

interface DailyUsagePoint {
  date: string;
  tokens: number;
  minutes?: number;
  costLkr: number;
  costUsd: number;
  sessionsCount: number;
}

interface SessionRecord {
  id: string;
  sessionCode: string;
  timestamp: string;
  displayDate: string;
  user: {
    name: string;
    initials: string;
    color: string;
  };
  model: string;
  durationSeconds: number;
  durationFormatted: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costLkr: number;
  costPerMinLkr?: number;
  costPerMinUsd?: number;
  status: string;
  turnsCount: number;
  correctionsCount: number;
  hintsUsedCount?: number;
  hintTokens?: number;
  hintCostLkr?: number;
  hintCostUsd?: number;
  totalWithHintsLkr?: number;
  scores: {
    overall: number;
    fluency: number;
    grammar: number;
    pronunciation: number;
  };
  turns?: Array<{ role: 'user' | 'model'; text: string; timestamp?: string }>;
  grammarCorrections?: Array<{
    studentSaid: string;
    moreNatural: string;
    explanation: string;
    highlightWords?: string[];
  }>;
  topic?: string;
  languageMode?: string;
  sinhalaStyle?: string;
  userRating?: number | null;
  userFeedback?: string | null;
  user_rating?: number | null;
  user_feedback?: string | null;
  diagnostics?: SessionDiagnosticsData;
}

export interface SessionDiagnosticsData {
  sessionId: string;
  durationSeconds: number;
  turnsCount: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  slowTurnsCount: number;
  backpressureWarnings: number;
  errorCount: number;
  events: Array<{ ts: number; event: string; detail?: string }>;
  disconnectReason?: string;
  micPermission?: string;
  micMuted?: boolean;
  hasUserSpoken?: boolean;
  guideStatus?: string;
  createdAt?: string;
}

interface UsageResponse {
  dailyUsage: DailyUsagePoint[];
  sessions: SessionRecord[];
  stats: {
    totalTokens: number;
    totalCostLkr: number;
    totalCostUsd: number;
    totalHintsUsed?: number;
    totalHintCostLkr?: number;
    totalHintCostUsd?: number;
    grandTotalCostLkr?: number;
    totalSessions: number;
    avgDurationMinutes: number;
    minutesToday?: number;
    minutesThisMonth?: number;
    avgCostPerMin?: number;
  };
}

function formatClientDateTime(isoTimestamp?: string, fallbackDisplayDate?: string): string {
  if (isoTimestamp) {
    try {
      let cleanIso = isoTimestamp.trim();
      if (!cleanIso.endsWith('Z') && !cleanIso.match(/[+-]\d{2}(:?\d{2})?$/)) {
        cleanIso = cleanIso.includes('T') ? `${cleanIso}Z` : `${cleanIso.replace(' ', 'T')}Z`;
      }
      const d = new Date(cleanIso);
      if (!isNaN(d.getTime())) {
        const formatter = new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        });
        const parts = formatter.formatToParts(d);
        const month = parts.find((p) => p.type === 'month')?.value || '';
        const day = parts.find((p) => p.type === 'day')?.value || '';
        const hour = parts.find((p) => p.type === 'hour')?.value || '00';
        const minute = parts.find((p) => p.type === 'minute')?.value || '00';
        const second = parts.find((p) => p.type === 'second')?.value || '00';
        return `${month} ${day}, ${hour}:${minute}:${second}`;
      }
    } catch {
      // Fall through to fallback below
    }
  }
  if (fallbackDisplayDate) return fallbackDisplayDate;
  if (isoTimestamp) return isoTimestamp.slice(0, 16);
  return '-';
}

function formatEndReasonLabel(reason?: string): string {
  if (!reason) return '';
  if (reason === 'user_ended_call') return 'User Clicked End Call';
  if (reason === 'user_force_ended') return 'User Force Ended (Popup)';
  if (reason === 'timer_farewell') return 'Full Session Timer Complete';
  if (reason === 'browser_tab_closed') return 'Browser Tab / App Closed Early';
  if (reason === 'network_dropped') return 'Network Dropped / Offline';
  if (reason.startsWith('closed_code_1001')) return 'Browser Tab Closed (1001)';
  if (reason.startsWith('closed_code_1006')) return 'Abnormal Drop / Lost Connection';
  return reason.replace(/_/g, ' ');
}

function getEndReasonColor(reason?: string): string {
  if (reason === 'user_ended_call') return '#2563eb';
  if (reason === 'timer_farewell') return '#10b981';
  if (reason === 'browser_tab_closed') return '#f59e0b';
  if (reason === 'network_dropped' || reason?.includes('1006')) return '#ef4444';
  if (reason === 'user_force_ended') return '#ea580c';
  return '#64748b';
}

function getEndReasonIcon(reason?: string): string {
  if (reason === 'user_ended_call') return 'call-outline';
  if (reason === 'timer_farewell') return 'checkmark-circle-outline';
  if (reason === 'browser_tab_closed') return 'exit-outline';
  if (reason === 'network_dropped' || reason?.includes('1006')) return 'cloud-offline-outline';
  if (reason === 'user_force_ended') return 'close-circle-outline';
  return 'information-circle-outline';
}

function formatMicStatusLabel(data?: SessionDiagnosticsData): string {
  if (!data) return 'Mic Status Unknown';
  if (data.micPermission === 'denied') return 'Permission Denied by User';
  if (data.micMuted) return 'Hardware / System Mic Muted';
  if (data.hasUserSpoken || data.turnsCount > 0) return 'Active & User Spoke';
  return 'Granted but Kept Silent (0 turns)';
}

function getMicStatusColor(data?: SessionDiagnosticsData): string {
  if (!data) return '#64748b';
  if (data.micPermission === 'denied') return '#ef4444';
  if (data.micMuted) return '#f59e0b';
  if (data.hasUserSpoken || data.turnsCount > 0) return '#10b981';
  return '#64748b';
}

function getMicStatusIcon(data?: SessionDiagnosticsData): string {
  if (!data) return 'mic-outline';
  if (data.micPermission === 'denied') return 'mic-off-outline';
  if (data.micMuted) return 'volume-mute-outline';
  if (data.hasUserSpoken || data.turnsCount > 0) return 'mic';
  return 'volume-low-outline';
}

function formatGuideStatusLabel(status?: string): string {
  if (!status) return 'Not recorded';
  if (status === 'completed') return 'Guide Completed (All 4 Steps)';
  if (status === 'skipped') return 'Guide Skipped by User';
  if (status.startsWith('step_')) {
    const stepNum = Number(status.replace('step_', '')) + 1;
    return `Stuck on Tip #${stepNum}`;
  }
  return status;
}

function getGuideStatusColor(status?: string): string {
  if (status === 'completed') return '#10b981';
  if (status === 'skipped') return '#64748b';
  if (status?.startsWith('step_')) return '#f59e0b';
  return '#94a3b8';
}

function getGuideStatusIcon(status?: string): string {
  if (status === 'completed') return 'checkmark-done-circle-outline';
  if (status === 'skipped') return 'play-skip-forward-outline';
  if (status?.startsWith('step_')) return 'pause-circle-outline';
  return 'help-circle-outline';
}

// Sidebar Navigation Structure
interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  route?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'AI CONFIGURATION',
    items: [
      { id: 'roadmap-studio', label: 'Roadmap Studio', icon: 'sliders', route: '/admin/roadmap' },
      { id: 'ai-usage', label: 'AI Usage & Logs', icon: 'bar-chart-2', route: '/admin/usage' },
    ],
  },
  {
    group: 'STUDENT APP',
    items: [
      { id: 'dashboard', label: 'Student Dashboard', icon: 'home', route: '/(tabs)/dashboard' },
      { id: 'student-roadmap', label: 'Student Roadmap View', icon: 'map', route: '/(tabs)/roadmap' },
    ],
  },
];

export default function AdminUsageScreen() {
  const { isPhone } = useBreakpoint();
  const { width: windowWidth } = useWindowDimensions();

  // Sidebar toggle state
  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);
  const [activeNav, setActiveNav] = useState('AI Usage & Logs');

  // Filter States
  const [selectedRange, setSelectedRange] = useState<'today' | '7d' | '30d' | 'custom'>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All Statuses');
  const [selectedModel, setSelectedModel] = useState<string>('All Models');

  // Dropdown UI states
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  // Data States
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [showPageSizeMenu, setShowPageSizeMenu] = useState<boolean>(false);

  // Diagnostics & Logs Modal States
  const [activeLogsSession, setActiveLogsSession] = useState<SessionRecord | null>(null);
  const [logsData, setLogsData] = useState<SessionDiagnosticsData | null>(null);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [logsFilter, setLogsFilter] = useState<string>('');

  // Final Analysis & Review Modal States
  const [activeAnalysisSession, setActiveAnalysisSession] = useState<SessionRecord | null>(null);
  const [analysisDetail, setAnalysisDetail] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [correctionFilter, setCorrectionFilter] = useState<'all' | 'on_call' | 'post_analysis'>('all');
  const [analyzingAi, setAnalyzingAi] = useState<boolean>(false);
  const [analyzingError, setAnalyzingError] = useState<string | null>(null);

  const handleOpenAnalysis = async (session: SessionRecord | null) => {
    if (!session) return;
    setActiveAnalysisSession(session);
    setAnalysisDetail(session);
    setAnalysisLoading(true);
    setCorrectionFilter('all');
    setAnalyzingError(null);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/usage/sessions/${session.id}`);
      if (res.ok) {
        const fullDetail = await res.json();
        setAnalysisDetail(fullDetail);
      }
    } catch {
      // Graceful fallback to existing session record
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleTriggerAiAnalysis = async () => {
    if (!activeAnalysisSession) return;
    const sessionId = activeAnalysisSession.id;
    setAnalyzingAi(true);
    setAnalyzingError(null);
    try {
      const baseUrl = getBackendBaseUrl();
      const turns = (analysisDetail?.turns || []).map((t: any) => ({
        role: t.role,
        text: t.text || t.text_transcript,
      }));
      const res = await fetch(`${baseUrl}/v1/sessions/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          turns: turns.length > 0 ? turns : undefined,
          topic: activeAnalysisSession.topic,
        }),
      });
      if (res.ok) {
        // Re-fetch session detail to get freshly saved post_analysis corrections
        const detailRes = await fetch(`${baseUrl}/v1/admin/usage/sessions/${sessionId}`);
        if (detailRes.ok) {
          const updated = await detailRes.json();
          setAnalysisDetail(updated);
        }
        setCorrectionFilter('post_analysis');
      } else {
        setAnalyzingError('AI Analysis request could not be processed.');
      }
    } catch (err: any) {
      setAnalyzingError(err?.message || 'Error running AI analysis');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Fetch usage data from backend
  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const baseUrl = getBackendBaseUrl();
      const params = new URLSearchParams({
        range: selectedRange,
        search: searchQuery,
        status: selectedStatus === 'All Statuses' ? '' : selectedStatus,
        model: selectedModel === 'All Models' ? '' : selectedModel,
      });

      const res = await fetch(`${baseUrl}/v1/admin/usage?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('[AdminUsage] Error fetching usage logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, [selectedRange, selectedStatus, selectedModel]);

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchUsageData();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch diagnostics for activeLogsSession
  useEffect(() => {
    if (!activeLogsSession) {
      setLogsData(null);
      setLogsFilter('');
      return;
    }

    const fetchDiag = async () => {
      try {
        setLogsLoading(true);
        const baseUrl = getBackendBaseUrl();
        const res = await fetch(`${baseUrl}/v1/sessions/${activeLogsSession.id}/diagnostics`);
        if (res.ok) {
          const json = await res.json();
          if (json && !json.message) {
            setLogsData(json);
          } else {
            setLogsData(null);
          }
        }
      } catch (e) {
        console.warn('[AdminUsage] Error fetching diagnostics:', e);
      } finally {
        setLogsLoading(false);
      }
    };

    fetchDiag();
  }, [activeLogsSession]);

  // Comprehensive client-side search filtering
  const filteredSessions = useMemo(() => {
    if (!data?.sessions) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return data.sessions;
    return data.sessions.filter((row) => {
      const matchCode = (row.sessionCode || '').toLowerCase().includes(q);
      const matchId = (row.id || '').toLowerCase().includes(q);
      const matchUser = (row.user?.name || '').toLowerCase().includes(q);
      const matchTopic = (row.topic || '').toLowerCase().includes(q);
      const matchModel = (row.model || '').toLowerCase().includes(q);
      const matchLang = (row.languageMode || '').toLowerCase().includes(q);
      return matchCode || matchId || matchUser || matchTopic || matchModel || matchLang;
    });
  }, [data?.sessions, searchQuery]);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedRange, selectedStatus, selectedModel, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage, pageSize]);

  // Adjust sidebar on viewport resize
  useEffect(() => {
    if (!isPhone) {
      setSidebarOpen(true);
    }
  }, [isPhone]);

  // SVG Chart path calculation
  const sidebarWidth = sidebarOpen && !isPhone ? 240 : 0;
  const contentWidth = Math.max(340, windowWidth - sidebarWidth);
  const chartWidth = Math.max(300, isPhone ? contentWidth - 48 : contentWidth - 88);
  const chartHeight = 180;
  const paddingLeft = 44;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 28;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const points = data?.dailyUsage || [];

  // Dynamic Y-axis scale based on real session minutes
  const { chartMax, yTicks } = useMemo(() => {
    const rawMax = Math.max(...points.map((p) => p.minutes ?? 0), 0);
    let max = 10;
    if (rawMax <= 10) {
      max = 10;
    } else if (rawMax <= 20) {
      max = 20;
    } else if (rawMax <= 50) {
      max = 50;
    } else if (rawMax <= 100) {
      max = 100;
    } else if (rawMax <= 500) {
      max = Math.ceil(rawMax / 50) * 50;
    } else if (rawMax <= 1000) {
      max = Math.ceil(rawMax / 100) * 100;
    } else {
      max = Math.ceil(rawMax / 5000) * 5000;
    }

    const steps = 4;
    const ticks: { val: number; label: string }[] = [];
    for (let i = steps; i >= 0; i--) {
      const val = Math.round((max / steps) * i);
      const label =
        val >= 1000
          ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
          : val > 0
            ? `${val}m`
            : '0m';
      ticks.push({ val, label });
    }
    return { chartMax: max, yTicks: ticks };
  }, [points]);

  const { pathString, areaString, xLabels, coords } = useMemo(() => {
    if (!points || points.length === 0) {
      return { pathString: '', areaString: '', xLabels: [], coords: [] };
    }

    const n = points.length;
    const computedCoords = points.map((p, i) => {
      const x = paddingLeft + (i / Math.max(1, n - 1)) * innerWidth;
      const minutesVal = p.minutes !== undefined ? p.minutes : 0;
      const normalizedY = Math.min(1, Math.max(0, minutesVal / chartMax));
      const y = paddingTop + (1 - normalizedY) * innerHeight;
      return {
        x,
        y,
        label: p.date,
        minutes: minutesVal,
        tokens: p.tokens,
        costLkr: p.costLkr,
        index: i,
      };
    });

    if (computedCoords.length === 1) {
      const p = computedCoords[0];
      return {
        pathString: `M ${paddingLeft} ${p.y} L ${chartWidth - paddingRight} ${p.y}`,
        areaString: `M ${paddingLeft} ${p.y} L ${chartWidth - paddingRight} ${p.y} L ${chartWidth - paddingRight} ${paddingTop + innerHeight} L ${paddingLeft} ${paddingTop + innerHeight} Z`,
        xLabels: [{ x: chartWidth / 2, label: p.label }],
        coords: computedCoords,
      };
    }

    // Build smooth cubic Bezier curve
    let d = `M ${computedCoords[0].x} ${computedCoords[0].y}`;
    for (let i = 0; i < computedCoords.length - 1; i++) {
      const current = computedCoords[i];
      const next = computedCoords[i + 1];
      const controlX = (current.x + next.x) / 2;
      d += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    const last = computedCoords[computedCoords.length - 1];
    const first = computedCoords[0];
    const bottomY = paddingTop + innerHeight;
    const areaD = `${d} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;

    const step = Math.max(1, Math.floor(computedCoords.length / 5));
    const labels = computedCoords.filter((_, idx) => idx % step === 0 || idx === computedCoords.length - 1);

    return { pathString: d, areaString: areaD, xLabels: labels, coords: computedCoords };
  }, [points, chartWidth, innerWidth, innerHeight, chartMax]);

  // Only show vertical guideline, dot and tooltip when user is pointing/hovering
  const activePoint = useMemo(() => {
    if (!coords || coords.length === 0 || selectedPointIndex === null) return null;
    if (coords[selectedPointIndex]) {
      return coords[selectedPointIndex];
    }
    return null;
  }, [coords, selectedPointIndex]);

  const handleChartPointer = (clientX: number) => {
    if (!coords || coords.length === 0) return;
    let closestIdx = 0;
    let minDiff = Infinity;
    coords.forEach((pt, i) => {
      const diff = Math.abs(pt.x - clientX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    });
    setSelectedPointIndex(closestIdx);
  };

  const handleNavPress = (item: NavItem) => {
    setActiveNav(item.label);
    if (item.route) {
      router.replace(item.route as any);
    }
    if (isPhone) {
      setSidebarOpen(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.appShell}>
        {/* 1. Modular Admin Sidebar */}
        <AdminSidebar
          activeRoute="/admin/usage"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* 2. MAIN CONTENT AREA (Top Bar + Scrollable Body) */}
        <View style={styles.mainArea}>
          {/* Top Bar Header */}
          <AdminTopBar
            title="AI Usage & Logs"
            subtitle="Monitor real-time Gemini AI token consumption, session duration, and LKR costs."
            badgeText="Live Metrics"
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            rightElement={
              <Pressable onPress={fetchUsageData} style={styles.refreshBtn}>
                <Feather name="refresh-cw" size={14} color="#0d9488" style={{ marginRight: 6 }} />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
            }
          />

          {/* Scrollable Page Body */}
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={styles.pageScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Row: Title & Export Logs */}
            <View style={styles.pageHeaderRow}>
              <View>
                <Text style={styles.pageHeading}>AI Usage & Logs</Text>
                <Text style={styles.pageSubheading}>
                  Monitor AI consumption, performance and error rates.
                </Text>
              </View>

              <Pressable onPress={fetchUsageData} style={styles.exportBtn}>
                <Feather name="download" size={14} color="#334155" />
                <Text style={styles.exportBtnText}>Export Logs</Text>
              </Pressable>
            </View>

            {/* 6 Summary Metric Cards */}
            <View style={styles.metricCardsRow}>
              {/* 1. AI Minutes Today */}
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>AI Minutes Today</Text>
                <Text style={[styles.metricValue, { color: '#0f172a' }]}>
                  {data?.stats?.minutesToday !== undefined
                    ? data.stats.minutesToday.toLocaleString()
                    : '0'}
                </Text>
              </View>

              {/* 2. AI Minutes This Month */}
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>AI Minutes This Month</Text>
                <Text style={[styles.metricValue, { color: '#0d9488' }]}>
                  {data?.stats?.minutesThisMonth !== undefined
                    ? data.stats.minutesThisMonth.toLocaleString()
                    : '0'}
                </Text>
              </View>

              {/* 3. AI Sessions */}
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>AI Sessions</Text>
                <Text style={[styles.metricValue, { color: '#2563eb' }]}>
                  {data?.stats?.totalSessions !== undefined
                    ? data.stats.totalSessions.toLocaleString()
                    : '0'}
                </Text>
              </View>

              {/* 4. Hints Used */}
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Hints Used</Text>
                <Text style={[styles.metricValue, { color: '#8b5cf6' }]}>
                  {data?.stats?.totalHintsUsed !== undefined
                    ? data.stats.totalHintsUsed.toLocaleString()
                    : '0'}
                </Text>
                <Text style={styles.metricSubText}>
                  Spend: LKR {(data?.stats?.totalHintCostLkr || 0).toFixed(2)}
                </Text>
              </View>

              {/* 5. Total AI Cost (Voice + Hints) */}
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total AI Cost</Text>
                <Text style={[styles.metricValue, { color: '#ea580c' }]}>
                  {data?.stats?.grandTotalCostLkr !== undefined
                    ? `LKR ${data.stats.grandTotalCostLkr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : data?.stats?.totalCostLkr !== undefined
                      ? `LKR ${data.stats.totalCostLkr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'LKR 0.00'}
                </Text>
                <Text style={styles.metricSubText}>
                  Voice: LKR {(data?.stats?.totalCostLkr || 0).toFixed(2)} | Hints: LKR {(data?.stats?.totalHintCostLkr || 0).toFixed(2)}
                </Text>
              </View>

              {/* 6. Avg Cost Per Min */}
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Avg Cost Per Min</Text>
                <Text style={[styles.metricValue, { color: '#7c3aed' }]}>
                  {data?.stats?.avgCostPerMin !== undefined && data.stats.avgCostPerMin > 0
                    ? `LKR ${Number(data.stats.avgCostPerMin).toFixed(2)}`
                    : 'LKR 0.00'}
                </Text>
              </View>
            </View>

            {/* Daily AI Usage Chart Card */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.chartTitle}>Daily AI Usage</Text>

                {/* Range Toggle Pills */}
                <View style={styles.rangePillContainer}>
                  {(['today', '7d', '30d', 'custom'] as const).map((range) => {
                    const isSelected = selectedRange === range;
                    const label =
                      range === 'today'
                        ? 'Today'
                        : range === '7d'
                          ? '7 Days'
                          : range === '30d'
                            ? '30 Days'
                            : 'Custom';
                    return (
                      <Pressable
                        key={range}
                        onPress={() => setSelectedRange(range)}
                        style={[styles.rangePill, isSelected && styles.rangePillActive]}
                      >
                        <Text style={[styles.rangePillText, isSelected && styles.rangePillTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* SVG Wave Chart */}
              <View
                style={styles.svgWrapper}
                {...(Platform.OS === 'web'
                  ? {
                    onPointerMove: (e: any) => {
                      const locX = e.nativeEvent?.offsetX ?? e.nativeEvent?.locationX;
                      if (typeof locX === 'number') {
                        handleChartPointer(locX);
                      }
                    },
                    onPointerLeave: () => {
                      setSelectedPointIndex(null);
                    },
                  }
                  : {
                    onTouchStart: (e: any) => {
                      const locX = e.nativeEvent?.locationX;
                      if (typeof locX === 'number') {
                        handleChartPointer(locX);
                      }
                    },
                    onTouchMove: (e: any) => {
                      const locX = e.nativeEvent?.locationX;
                      if (typeof locX === 'number') {
                        handleChartPointer(locX);
                      }
                    },
                    onTouchEnd: () => {
                      setSelectedPointIndex(null);
                    },
                    onTouchCancel: () => {
                      setSelectedPointIndex(null);
                    },
                  })}
              >
                {loading && !data ? (
                  <View style={styles.chartLoading}>
                    <ActivityIndicator size="small" color="#0d9488" />
                  </View>
                ) : (
                  <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                      <LinearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#0d9488" stopOpacity="0.18" />
                        <Stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
                      </LinearGradient>
                    </Defs>

                    {/* Horizontal Grid lines with Y-Axis values */}
                    {/* Horizontal Grid lines with dynamic Y-Axis values */}
                    {yTicks.map((tick) => {
                      const normalizedY = Math.min(1, Math.max(0, tick.val / chartMax));
                      const y = paddingTop + (1 - normalizedY) * innerHeight;
                      return (
                        <React.Fragment key={tick.val}>
                          <Line
                            x1={paddingLeft}
                            y1={y}
                            x2={chartWidth - paddingRight}
                            y2={y}
                            stroke="#f1f5f9"
                            strokeWidth="1"
                            strokeDasharray={tick.val === 0 ? undefined : '3,3'}
                          />
                        </React.Fragment>
                      );
                    })}

                    {/* Vertical Guideline for Active Selected Point */}
                    {activePoint && (
                      <Line
                        x1={activePoint.x}
                        y1={paddingTop - 6}
                        x2={activePoint.x}
                        y2={chartHeight - paddingBottom}
                        stroke="#cbd5e1"
                        strokeWidth="1"
                      />
                    )}

                    {/* Area Gradient Fill */}
                    {areaString ? <Path d={areaString} fill="url(#usageGradient)" /> : null}

                    {/* Line Curve */}
                    {pathString ? (
                      <Path
                        d={pathString}
                        fill="none"
                        stroke="#0d9488"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {/* Circle Point Marker on the Curve */}
                    {activePoint && (
                      <Circle
                        cx={activePoint.x}
                        cy={activePoint.y}
                        r={4.5}
                        fill="#0f766e"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    )}
                  </Svg>
                )}

                {/* Floating Tooltip Card */}
                {activePoint && !loading && (
                  <View
                    style={[
                      styles.tooltipCard,
                      {
                        left:
                          activePoint.x + 190 > chartWidth
                            ? Math.max(10, activePoint.x - 185)
                            : activePoint.x + 6,
                        top: Math.max(8, Math.min(activePoint.y + 2, innerHeight - 40)),
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Text style={styles.tooltipDateText}>{activePoint.label}</Text>
                    <Text style={styles.tooltipValueText}>
                      AI Minutes : {activePoint.minutes.toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Y Axis Labels Overlaid on Left */}
                <View style={[styles.yAxisLabels, { height: innerHeight, top: paddingTop }]}>
                  {yTicks.map((tick) => (
                    <Text key={tick.label + tick.val} style={styles.axisText}>
                      {tick.label}
                    </Text>
                  ))}
                </View>

                {/* X Axis Labels along Bottom */}
                <View style={styles.xAxisLabels}>
                  {xLabels.map((lbl, idx) => (
                    <Text
                      key={idx}
                      style={[
                        styles.axisText,
                        {
                          position: 'absolute',
                          left: Math.max(0, lbl.x - 30),
                          width: 60,
                          textAlign: 'center',
                        },
                      ]}
                    >
                      {lbl.label}
                    </Text>
                  ))}
                </View>
              </View>
            </View>

            {/* Search & Logs Table Card */}
            <View style={styles.tableCard}>
              {/* Filter Bar */}
              <View style={styles.filterBar}>
                {/* Search Input */}
                <View style={styles.searchBox}>
                  <Feather name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
                  <TextInput
                    placeholder="Search logs..."
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#94a3b8" />
                    </Pressable>
                  )}
                </View>

                {/* Dropdown Filters */}
                <View style={styles.dropdownsRow}>
                  {/* Status Dropdown */}
                  <View style={styles.dropdownWrapper}>
                    <Pressable
                      onPress={() => setShowStatusMenu(!showStatusMenu)}
                      style={styles.dropdownBtn}
                    >
                      <Text style={styles.dropdownText}>{selectedStatus}</Text>
                      <Feather name="chevron-down" size={14} color="#64748b" />
                    </Pressable>
                    {showStatusMenu && (
                      <View style={styles.menuPopover}>
                        {['All Statuses', 'Success', 'Failed'].map((st) => (
                          <Pressable
                            key={st}
                            onPress={() => {
                              setSelectedStatus(st);
                              setShowStatusMenu(false);
                            }}
                            style={styles.menuItem}
                          >
                            <Text
                              style={[
                                styles.menuItemText,
                                selectedStatus === st && styles.menuItemTextActive,
                              ]}
                            >
                              {st}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Model Dropdown */}
                  <View style={styles.dropdownWrapper}>
                    <Pressable
                      onPress={() => setShowModelMenu(!showModelMenu)}
                      style={styles.dropdownBtn}
                    >
                      <Text style={styles.dropdownText}>{selectedModel}</Text>
                      <Feather name="chevron-down" size={14} color="#64748b" />
                    </Pressable>
                    {showModelMenu && (
                      <View style={styles.menuPopover}>
                        {['All Models', 'gemini-3.8-live', 'GPT-4o'].map((m) => (
                          <Pressable
                            key={m}
                            onPress={() => {
                              setSelectedModel(m);
                              setShowModelMenu(false);
                            }}
                            style={styles.menuItem}
                          >
                            <Text
                              style={[
                                styles.menuItemText,
                                selectedModel === m && styles.menuItemTextActive,
                              ]}
                            >
                              {m}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Table Data */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.tableInner}>
                  {/* Header Row */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.th, { width: 140 }]}>Date & Time (Local)</Text>
                    <Text style={[styles.th, { width: 150 }]}>User</Text>
                    <Text style={[styles.th, { width: 105 }]}>Session</Text>
                    <Text style={[styles.th, { width: 140 }]}>Language Mode</Text>
                    <Text style={[styles.th, { width: 120 }]}>Model</Text>
                    <Text style={[styles.th, { width: 85 }]}>Duration</Text>
                    <Text style={[styles.th, { width: 105, textAlign: 'right' }]}>Input Tokens</Text>
                    <Text style={[styles.th, { width: 105, textAlign: 'right' }]}>Output Tokens</Text>
                    <Text style={[styles.th, { width: 95, textAlign: 'right' }]}>Total</Text>
                    <Text style={[styles.th, { width: 105, textAlign: 'right' }]}>Voice Cost</Text>
                    <Text style={[styles.th, { width: 95, textAlign: 'center' }]}>Hints Used</Text>
                    <Text style={[styles.th, { width: 105, textAlign: 'right' }]}>Hint Cost</Text>
                    <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Total Cost</Text>
                    <Text style={[styles.th, { width: 105, textAlign: 'right' }]}>Avg / Min</Text>
                    <Text style={[styles.th, { width: 90, textAlign: 'center' }]}>Status</Text>
                    <Text style={[styles.th, { width: 235, textAlign: 'center' }]}>Actions</Text>
                  </View>

                  {/* Table Body */}
                  {loading && !data ? (
                    <View style={styles.tableLoadingRow}>
                      <ActivityIndicator size="small" color="#0d9488" />
                      <Text style={styles.tableLoadingText}>Loading usage records from database...</Text>
                    </View>
                  ) : !paginatedSessions || paginatedSessions.length === 0 ? (
                    <View style={styles.tableEmptyRow}>
                      <Text style={styles.tableEmptyText}>No sessions found matching filters</Text>
                    </View>
                  ) : (
                    paginatedSessions.map((row, idx) => (
                      <View
                        key={row.id || idx}
                        style={[styles.tableDataRow, idx % 2 === 1 && styles.tableDataRowAlt]}
                      >
                        <Text style={[styles.td, { width: 140, color: '#64748b' }]}>
                          {formatClientDateTime(row.timestamp, row.displayDate)}
                        </Text>

                        {/* User */}
                        <View style={[styles.tdUser, { width: 150 }]}>
                          <View
                            style={[
                              styles.userAvatar,
                              { backgroundColor: row.user?.color || '#0d9488' },
                            ]}
                          >
                            <Text style={styles.userAvatarInitials}>
                              {row.user?.initials || (row.user?.name ? row.user.name.slice(0, 2).toUpperCase() : 'L')}
                            </Text>
                          </View>
                          <Text style={styles.userNameText} numberOfLines={1}>
                            {row.user?.name || 'Learner'}
                          </Text>
                        </View>

                        {/* Session */}
                        <View style={[styles.td, { width: 105 }]}>
                          <Text style={styles.sessionCodeText}>{row.sessionCode}</Text>
                        </View>

                        {/* Language Mode & Sinhala Style */}
                        <View style={[styles.td, { width: 140 }]}>
                          {row.languageMode === 'english' ? (
                            <View style={styles.modeBadgeEnglish}>
                              <Text style={styles.modeBadgeEnglishText}>English Only</Text>
                            </View>
                          ) : (
                            <View
                              style={
                                row.sinhalaStyle === 'smart'
                                  ? styles.modeBadgeSinhalaSmart
                                  : row.sinhalaStyle === 'deep_guidance'
                                    ? styles.modeBadgeSinhalaDeep
                                    : styles.modeBadgeSinhalaBalanced
                              }
                            >
                              <Text
                                style={
                                  row.sinhalaStyle === 'smart'
                                    ? styles.modeBadgeSinhalaSmartText
                                    : row.sinhalaStyle === 'deep_guidance'
                                      ? styles.modeBadgeSinhalaDeepText
                                      : styles.modeBadgeSinhalaBalancedText
                                }
                              >
                                {row.sinhalaStyle === 'smart'
                                  ? 'Sinhala (Smart)'
                                  : row.sinhalaStyle === 'deep_guidance'
                                    ? 'Sinhala (Deep)'
                                    : 'Sinhala (Balanced)'}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Model Badge */}
                        <View style={[styles.td, { width: 120 }]}>
                          <View style={styles.modelBadge}>
                            <Text style={styles.modelBadgeText}>{row.model}</Text>
                          </View>
                        </View>

                        {/* Duration */}
                        <Text style={[styles.td, { width: 85 }]}>
                          {row.durationFormatted || `${(row.durationSeconds / 60).toFixed(1)}m`}
                        </Text>

                        {/* Input Tokens */}
                        <Text style={[styles.td, { width: 105, textAlign: 'right' }]}>
                          {row.inputTokens.toLocaleString()}
                        </Text>

                        {/* Output Tokens */}
                        <Text style={[styles.td, { width: 105, textAlign: 'right' }]}>
                          {row.outputTokens.toLocaleString()}
                        </Text>

                        {/* Total Tokens */}
                        <Text
                          style={[
                            styles.td,
                            { width: 95, textAlign: 'right', ...fontStyle('inter', 'semiBold') },
                          ]}
                        >
                          {row.totalTokens.toLocaleString()}
                        </Text>

                        {/* Voice Cost */}
                        <Text
                          style={[
                            styles.td,
                            { width: 105, textAlign: 'right', color: '#0d9488', ...fontStyle('inter', 'semiBold') },
                          ]}
                        >
                          {`LKR ${row.costLkr.toFixed(2)}`}
                        </Text>

                        {/* Hints Used */}
                        <View style={[styles.td, { width: 95, alignItems: 'center', justifyContent: 'center' }]}>
                          {row.hintsUsedCount && row.hintsUsedCount > 0 ? (
                            <View style={styles.hintsBadge}>
                              <Text style={styles.hintsBadgeText}>{row.hintsUsedCount} hints</Text>
                            </View>
                          ) : (
                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>-</Text>
                          )}
                        </View>

                        {/* Hint Cost */}
                        <Text
                          style={[
                            styles.td,
                            { width: 105, textAlign: 'right', color: '#7c3aed', ...fontStyle('inter', 'medium') },
                          ]}
                        >
                          {row.hintCostLkr && row.hintCostLkr > 0 ? `LKR ${row.hintCostLkr.toFixed(2)}` : '-'}
                        </Text>

                        {/* Total Cost */}
                        <Text
                          style={[
                            styles.td,
                            { width: 110, textAlign: 'right', color: '#ea580c', ...fontStyle('inter', 'bold') },
                          ]}
                        >
                          {`LKR ${(row.totalWithHintsLkr !== undefined ? row.totalWithHintsLkr : row.costLkr + (row.hintCostLkr || 0)).toFixed(2)}`}
                        </Text>

                        {/* Avg Min Cost */}
                        <Text
                          style={[
                            styles.td,
                            { width: 105, textAlign: 'right', color: '#0284c7', ...fontStyle('inter', 'semiBold') },
                          ]}
                        >
                          {row.costPerMinLkr !== undefined && row.costPerMinLkr > 0
                            ? `LKR ${row.costPerMinLkr.toFixed(2)}/m`
                            : row.durationSeconds > 0
                              ? `LKR ${(row.costLkr / (row.durationSeconds / 60)).toFixed(2)}/m`
                              : `LKR ${row.costLkr.toFixed(2)}/m`}
                        </Text>

                        {/* Status */}
                        <View style={[styles.td, { width: 90, alignItems: 'center' }]}>
                          <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>Success</Text>
                          </View>
                        </View>

                        {/* Action Detail, Review & Logs */}
                        <View style={[styles.td, { width: 235, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }]}>
                          <Pressable
                            onPress={() => setActiveSession(row)}
                            style={styles.detailBtn}
                          >
                            <Text style={styles.detailBtnText}>Detail</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleOpenAnalysis(row)}
                            style={styles.analysisBtn}
                          >
                            <Feather name="award" size={12} color="#9333ea" style={{ marginRight: 4 }} />
                            <Text style={styles.analysisBtnText}>Analysis</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => setActiveLogsSession(row)}
                            style={styles.logsBtn}
                          >
                            <Feather name="activity" size={12} color="#0d9488" style={{ marginRight: 4 }} />
                            <Text style={styles.logsBtnText}>Logs</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>

              {/* Pagination Controls Footer */}
              <View style={styles.paginationRow}>
                <View style={styles.paginationInfoCol}>
                  <Text style={styles.paginationInfoText}>
                    Showing{' '}
                    <Text style={styles.paginationInfoBold}>
                      {filteredSessions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                    </Text>{' '}
                    to{' '}
                    <Text style={styles.paginationInfoBold}>
                      {Math.min(currentPage * pageSize, filteredSessions.length)}
                    </Text>{' '}
                    of <Text style={styles.paginationInfoBold}>{filteredSessions.length}</Text> sessions
                  </Text>

                  <View style={styles.pageSizeContainer}>
                    <Text style={styles.pageSizeLabel}>Per page:</Text>
                    <Pressable
                      onPress={() => setShowPageSizeMenu(!showPageSizeMenu)}
                      style={styles.pageSizeDropdownBtn}
                    >
                      <Text style={styles.pageSizeDropdownText}>{pageSize}</Text>
                      <Feather name="chevron-down" size={13} color="#64748b" />
                    </Pressable>
                    {showPageSizeMenu && (
                      <View style={styles.pageSizePopover}>
                        {[10, 25, 50].map((sz) => (
                          <Pressable
                            key={sz}
                            onPress={() => {
                              setPageSize(sz);
                              setShowPageSizeMenu(false);
                              setCurrentPage(1);
                            }}
                            style={[
                              styles.pageSizeOption,
                              pageSize === sz && styles.pageSizeOptionActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.pageSizeOptionText,
                                pageSize === sz && styles.pageSizeOptionTextActive,
                              ]}
                            >
                              {sz}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Page Navigation */}
                <View style={styles.pageNavControls}>
                  <Pressable
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    style={[styles.pageNavBtn, currentPage <= 1 && styles.pageNavBtnDisabled]}
                  >
                    <Feather name="chevron-left" size={15} color={currentPage <= 1 ? '#cbd5e1' : '#334155'} />
                    <Text style={[styles.pageNavBtnText, currentPage <= 1 && styles.pageNavBtnTextDisabled]}>
                      Prev
                    </Text>
                  </Pressable>

                  <View style={styles.pageNumbersRow}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        const isGap = prev && p - prev > 1;
                        return (
                          <React.Fragment key={p}>
                            {isGap && <Text style={styles.pageEllipsis}>...</Text>}
                            <Pressable
                              onPress={() => setCurrentPage(p)}
                              style={[
                                styles.pageNumberBtn,
                                currentPage === p && styles.pageNumberBtnActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.pageNumberText,
                                  currentPage === p && styles.pageNumberTextActive,
                                ]}
                              >
                                {p}
                              </Text>
                            </Pressable>
                          </React.Fragment>
                        );
                      })}
                  </View>

                  <Pressable
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    style={[styles.pageNavBtn, currentPage >= totalPages && styles.pageNavBtnDisabled]}
                  >
                    <Text style={[styles.pageNavBtnText, currentPage >= totalPages && styles.pageNavBtnTextDisabled]}>
                      Next
                    </Text>
                    <Feather name="chevron-right" size={15} color={currentPage >= totalPages ? '#cbd5e1' : '#334155'} />
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* ============================================================ */}
      {/* 3. SESSION DETAIL BREAKDOWN MODAL                            */}
      {/* ============================================================ */}
      <Modal
        visible={!!activeSession}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveSession(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle}>Session {activeSession?.sessionCode}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>Success</Text>
                  </View>
                </View>
                <Text style={styles.modalSub}>{formatClientDateTime(activeSession?.timestamp, activeSession?.displayDate)} • {activeSession?.model}</Text>
              </View>

              <Pressable onPress={() => setActiveSession(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Cost & Tokens Breakdown Summary */}
              <View style={styles.modalStatsGrid}>
                <View style={styles.modalStatBox}>
                  <Text style={styles.modalStatLabel}>Total Duration</Text>
                  <Text style={styles.modalStatValue}>{activeSession?.durationFormatted}</Text>
                </View>
                <View style={styles.modalStatBox}>
                  <Text style={styles.modalStatLabel}>Voice Cost</Text>
                  <Text style={[styles.modalStatValue, { color: '#0d9488' }]}>
                    {activeSession ? `LKR ${activeSession.costLkr.toFixed(2)}` : 'LKR 0.00'}
                  </Text>
                  <Text style={styles.modalStatSub}>
                    ${activeSession?.costUsd.toFixed(5)} USD • LKR {(
                      activeSession?.costPerMinLkr !== undefined && activeSession.costPerMinLkr > 0
                        ? activeSession.costPerMinLkr
                        : (activeSession?.costLkr || 0) / Math.max(0.1, (activeSession?.durationSeconds || 60) / 60)
                    ).toFixed(2)}/min
                  </Text>
                </View>
                <View style={styles.modalStatBox}>
                  <Text style={styles.modalStatLabel}>Hints Used & Cost</Text>
                  <Text style={[styles.modalStatValue, { color: '#8b5cf6' }]}>
                    {activeSession?.hintsUsedCount || 0} hints
                  </Text>
                  <Text style={styles.modalStatSub}>
                    LKR {(activeSession?.hintCostLkr || 0).toFixed(2)} (${(activeSession?.hintCostUsd || 0).toFixed(5)} USD)
                  </Text>
                </View>
                <View style={styles.modalStatBox}>
                  <Text style={styles.modalStatLabel}>Total Session Spend</Text>
                  <Text style={[styles.modalStatValue, { color: '#ea580c' }]}>
                    {`LKR ${(activeSession?.totalWithHintsLkr !== undefined ? activeSession.totalWithHintsLkr : (activeSession?.costLkr || 0) + (activeSession?.hintCostLkr || 0)).toFixed(2)}`}
                  </Text>
                  <Text style={styles.modalStatSub}>
                    Voice: LKR {(activeSession?.costLkr || 0).toFixed(2)} + Hints: LKR {(activeSession?.hintCostLkr || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.modalStatBox}>
                  <Text style={styles.modalStatLabel}>Total Tokens</Text>
                  <Text style={styles.modalStatValue}>{activeSession?.totalTokens.toLocaleString()}</Text>
                  <Text style={styles.modalStatSub}>
                    In: {activeSession?.inputTokens.toLocaleString()} | Out: {activeSession?.outputTokens.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.modalStatBox}>
                  <Text style={styles.modalStatLabel}>Overall Score</Text>
                  <Text style={[styles.modalStatValue, { color: '#0284c7' }]}>
                    {activeSession?.scores?.overall ?? 85}%
                  </Text>
                  <Text style={styles.modalStatSub}>
                    Fluency: {activeSession?.scores?.fluency ?? 84} | Grammar: {activeSession?.scores?.grammar ?? 82}
                  </Text>
                </View>
              </View>

              {/* Topic & Mode */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Practice Topic / Scenario</Text>
                <Text style={styles.modalTopicText}>{activeSession?.topic || 'Speaking Practice'}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
                  <Text style={styles.modalStatLabel}>Language Mode:</Text>
                  {activeSession?.languageMode === 'english' ? (
                    <View style={styles.modeBadgeEnglish}>
                      <Text style={styles.modeBadgeEnglishText}>English Only</Text>
                    </View>
                  ) : (
                    <View
                      style={
                        activeSession?.sinhalaStyle === 'smart'
                          ? styles.modeBadgeSinhalaSmart
                          : activeSession?.sinhalaStyle === 'deep_guidance'
                            ? styles.modeBadgeSinhalaDeep
                            : styles.modeBadgeSinhalaBalanced
                      }
                    >
                      <Text
                        style={
                          activeSession?.sinhalaStyle === 'smart'
                            ? styles.modeBadgeSinhalaSmartText
                            : activeSession?.sinhalaStyle === 'deep_guidance'
                              ? styles.modeBadgeSinhalaDeepText
                              : styles.modeBadgeSinhalaBalancedText
                        }
                      >
                        {activeSession?.sinhalaStyle === 'smart'
                          ? 'Sinhala (Smart Immersion)'
                          : activeSession?.sinhalaStyle === 'deep_guidance'
                            ? 'Sinhala (Deep Guidance)'
                            : 'Sinhala (Balanced Coaching)'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Student Rating & Feedback Comments Section */}
              <View style={styles.modalReviewSection}>
                <View style={styles.modalReviewHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="star" size={15} color="#f59e0b" />
                    <Text style={styles.modalReviewSectionTitle}>Student Rating & Comments</Text>
                  </View>

                  {typeof (activeSession?.userRating ?? activeSession?.user_rating) === 'number' &&
                  (activeSession?.userRating ?? activeSession?.user_rating)! > 0 ? (
                    <View style={styles.modalRatingBadge}>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={
                              star <= (activeSession?.userRating ?? activeSession?.user_rating)!
                                ? 'star'
                                : 'star-outline'
                            }
                            size={13}
                            color={
                              star <= (activeSession?.userRating ?? activeSession?.user_rating)!
                                ? '#f59e0b'
                                : '#cbd5e1'
                            }
                          />
                        ))}
                      </View>
                      <Text style={styles.modalRatingScoreText}>
                        {(activeSession?.userRating ?? activeSession?.user_rating)}.0
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.modalNoRatingBadge}>
                      <Text style={styles.modalNoRatingBadgeText}>No Rating Submitted</Text>
                    </View>
                  )}
                </View>

                {(activeSession?.userFeedback ?? activeSession?.user_feedback) &&
                (activeSession?.userFeedback ?? activeSession?.user_feedback)!.trim().length > 0 ? (
                  <View style={styles.modalFeedbackCommentBox}>
                    <Feather name="message-square" size={13} color="#0d9488" style={{ marginTop: 2 }} />
                    <Text style={styles.modalFeedbackCommentText}>
                      "{(activeSession?.userFeedback ?? activeSession?.user_feedback)!.trim()}"
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.modalNoCommentText}>
                    No written comment left by student for this session.
                  </Text>
                )}
              </View>

              {/* Audio Recording Player, Coaching Corrections & Full Conversation Transcript */}
              {activeSession?.id && (
                <View style={{ marginBottom: 16 }}>
                  <AdminSessionTranscriptAndPlayer
                    sessionId={activeSession.id}
                    studentName={activeSession.user?.name || 'Student'}
                    durationSeconds={activeSession.durationSeconds}
                    initialTurns={activeSession.turns}
                    initialCorrections={activeSession.grammarCorrections}
                  />
                </View>
              )}

              {/* Actions inside Detail Modal */}
              <View style={[styles.modalFooterActions, { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }]}>
                <Pressable
                  onPress={() => {
                    const s = activeSession;
                    setActiveSession(null);
                    handleOpenAnalysis(s);
                  }}
                  style={styles.modalCheckAnalysisBtn}
                >
                  <Feather name="award" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.modalCheckLogsBtnText}>View Final Analysis & Feedback</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    const s = activeSession;
                    setActiveSession(null);
                    setActiveLogsSession(s);
                  }}
                  style={styles.modalCheckLogsBtn}
                >
                  <Feather name="activity" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.modalCheckLogsBtnText}>Check Network & Diagnostics Logs</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* 4. SESSION DIAGNOSTICS & TELEMETRY LOGS MODAL                */}
      {/* ============================================================ */}
      <Modal
        visible={!!activeLogsSession}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveLogsSession(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContentLogs}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle}>Session Logs & Diagnostics</Text>
                  <View style={styles.logsBadge}>
                    <Text style={styles.logsBadgeText}>{activeLogsSession?.sessionCode}</Text>
                  </View>
                </View>
                <Text style={styles.modalSub}>
                  ID: {activeLogsSession?.id} • {formatClientDateTime(activeLogsSession?.timestamp, activeLogsSession?.displayDate)}
                </Text>
              </View>

              <Pressable onPress={() => setActiveLogsSession(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            {/* Pin KPI Telemetry Cards directly beneath header */}
            {logsData && !logsLoading ? (
              <View style={styles.logsKpiRow}>
                {/* 1. Avg Latency */}
                <View style={styles.logsKpiCard}>
                  <Text style={styles.logsKpiLabel}>Avg Turn Latency</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Text
                      style={[
                        styles.logsKpiValue,
                        {
                          color:
                            logsData.avgLatencyMs > 4000
                              ? '#ef4444'
                              : logsData.avgLatencyMs > 2500
                                ? '#f59e0b'
                                : '#10b981',
                        },
                      ]}
                    >
                      {logsData.avgLatencyMs.toLocaleString()} ms
                    </Text>
                    <View
                      style={[
                        styles.latencyPill,
                        {
                          backgroundColor:
                            logsData.avgLatencyMs > 4000
                              ? '#fef2f2'
                              : logsData.avgLatencyMs > 2500
                                ? '#fffbeb'
                                : '#ecfdf5',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.latencyPillText,
                          {
                            color:
                              logsData.avgLatencyMs > 4000
                                ? '#b91c1c'
                                : logsData.avgLatencyMs > 2500
                                  ? '#b45309'
                                  : '#047857',
                          },
                        ]}
                      >
                        {logsData.avgLatencyMs > 4000
                          ? '🔴 Slow'
                          : logsData.avgLatencyMs > 2500
                            ? '🟡 Moderate'
                            : '🟢 Normal'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Max Latency */}
                <View style={styles.logsKpiCard}>
                  <Text style={styles.logsKpiLabel}>Max Turn Latency</Text>
                  <Text
                    style={[
                      styles.logsKpiValue,
                      {
                        color:
                          logsData.maxLatencyMs > 8000
                            ? '#ef4444'
                            : logsData.maxLatencyMs > 4000
                              ? '#f59e0b'
                              : '#0f172a',
                      },
                    ]}
                  >
                    {logsData.maxLatencyMs.toLocaleString()} ms
                  </Text>
                </View>

                {/* 3. Slow Turns (Over 3s) */}
                <View style={styles.logsKpiCard}>
                  <Text style={styles.logsKpiLabel}>Slow Turns (Over 3s)</Text>
                  <Text
                    style={[
                      styles.logsKpiValue,
                      { color: logsData.slowTurnsCount > 0 ? '#ea580c' : '#0f172a' },
                    ]}
                  >
                    {logsData.slowTurnsCount} / {logsData.turnsCount}
                  </Text>
                </View>

                {/* 4. Backpressure */}
                <View style={styles.logsKpiCard}>
                  <Text style={styles.logsKpiLabel}>Backpressure Alerts</Text>
                  <Text
                    style={[
                      styles.logsKpiValue,
                      { color: logsData.backpressureWarnings > 0 ? '#ef4444' : '#0f172a' },
                    ]}
                  >
                    {logsData.backpressureWarnings}
                  </Text>
                </View>

                {/* 5. Errors */}
                <View style={styles.logsKpiCard}>
                  <Text style={styles.logsKpiLabel}>Recorded Errors</Text>
                  <Text
                    style={[
                      styles.logsKpiValue,
                      { color: logsData.errorCount > 0 ? '#ef4444' : '#0f172a' },
                    ]}
                  >
                    {logsData.errorCount}
                  </Text>
                </View>
              </View>
            ) : null}

            <ScrollView style={styles.modalLogsScrollView} contentContainerStyle={styles.modalLogsBodyContent} showsVerticalScrollIndicator={true}>
              {logsLoading ? (
                <AdminTableSkeleton rows={4} />
              ) : logsData ? (
                <>
                  {/* End Reason, Mic State & Guide Progress Diagnostic Cards (only shown if session has tracking records) */}
                  {(Boolean(logsData.disconnectReason) ||
                    Boolean(logsData.micPermission) ||
                    typeof logsData.micMuted === 'boolean' ||
                    typeof logsData.hasUserSpoken === 'boolean' ||
                    Boolean(logsData.guideStatus)) && (
                    <View style={styles.trackingBadgesRow}>
                      {/* 1. End Trigger */}
                      {Boolean(logsData.disconnectReason) && (
                        <View style={[styles.trackingCard, { borderLeftColor: getEndReasonColor(logsData.disconnectReason) }]}>
                          <Text style={styles.trackingCardLabel}>End Trigger / Disconnect</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Ionicons name={getEndReasonIcon(logsData.disconnectReason) as any} size={15} color={getEndReasonColor(logsData.disconnectReason)} />
                            <Text style={[styles.trackingCardValue, { color: getEndReasonColor(logsData.disconnectReason) }]}>
                              {formatEndReasonLabel(logsData.disconnectReason)}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* 2. Microphone & Audio */}
                      {(Boolean(logsData.micPermission) ||
                        typeof logsData.micMuted === 'boolean' ||
                        typeof logsData.hasUserSpoken === 'boolean') && (
                        <View style={[styles.trackingCard, { borderLeftColor: getMicStatusColor(logsData) }]}>
                          <Text style={styles.trackingCardLabel}>Microphone & Audio</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Ionicons name={getMicStatusIcon(logsData) as any} size={15} color={getMicStatusColor(logsData)} />
                            <Text style={[styles.trackingCardValue, { color: getMicStatusColor(logsData) }]}>
                              {formatMicStatusLabel(logsData)}
                            </Text>
                          </View>
                        </View>
                      )}

                      {/* 3. Guide Progress */}
                      {Boolean(logsData.guideStatus) && (
                        <View style={[styles.trackingCard, { borderLeftColor: getGuideStatusColor(logsData.guideStatus) }]}>
                          <Text style={styles.trackingCardLabel}>Intro Guide Progress</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Ionicons name={getGuideStatusIcon(logsData.guideStatus) as any} size={15} color={getGuideStatusColor(logsData.guideStatus)} />
                            <Text style={[styles.trackingCardValue, { color: getGuideStatusColor(logsData.guideStatus) }]}>
                              {formatGuideStatusLabel(logsData.guideStatus)}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Filter inside logs */}
                  <View style={styles.logsFilterRow}>
                    <Text style={styles.modalSectionTitle}>
                      Session Event Timeline ({logsData.events?.length || 0})
                    </Text>
                    <View style={styles.logsSearchInputWrapper}>
                      <Feather name="search" size={14} color="#94a3b8" />
                      <TextInput
                        placeholder="Filter events..."
                        placeholderTextColor="#94a3b8"
                        value={logsFilter}
                        onChangeText={setLogsFilter}
                        style={styles.logsSearchInput}
                      />
                    </View>
                  </View>

                  {/* Timeline Events List */}
                  <View style={styles.timelineList}>
                    {(logsData.events || [])
                      .filter((e) => {
                        if (!logsFilter) return true;
                        const lf = logsFilter.toLowerCase();
                        return (
                          (e.event || '').toLowerCase().includes(lf) ||
                          (e.detail || '').toLowerCase().includes(lf)
                        );
                      })
                      .map((item, idx) => {
                        const eventDate = new Date(item.ts);
                        const timeStr = !isNaN(eventDate.getTime())
                          ? eventDate.toLocaleTimeString('en-US', { hour12: false }) +
                          '.' +
                          String(eventDate.getMilliseconds()).padStart(3, '0')
                          : `+${idx}s`;

                        const isError =
                          item.event.includes('error') || item.event.includes('timeout');
                        const isWarning =
                          item.event.includes('backpressure') || item.event.includes('slow');
                        const isLatency = item.event.includes('latency');

                        return (
                          <View
                            key={idx}
                            style={[styles.timelineItem, isError && styles.timelineItemError]}
                          >
                            <Text style={styles.timelineTimestamp}>{timeStr}</Text>
                            <View
                              style={[
                                styles.timelineBadge,
                                isError
                                  ? styles.timelineBadgeError
                                  : isWarning
                                    ? styles.timelineBadgeWarning
                                    : isLatency
                                      ? styles.timelineBadgeLatency
                                      : styles.timelineBadgeDefault,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.timelineBadgeText,
                                  isError
                                    ? styles.timelineBadgeTextError
                                    : isWarning
                                      ? styles.timelineBadgeTextWarning
                                      : isLatency
                                        ? styles.timelineBadgeTextLatency
                                        : styles.timelineBadgeTextDefault,
                                ]}
                              >
                                {item.event}
                              </Text>
                            </View>
                            {item.detail ? (
                              <Text style={styles.timelineDetailText} numberOfLines={2}>
                                {item.detail}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                  </View>
                </>
              ) : (
                <View style={styles.logsEmptyContainer}>
                  <Feather name="info" size={32} color="#0d9488" style={{ marginBottom: 12 }} />
                  <Text style={styles.logsEmptyTitle}>No Telemetry Records Available</Text>
                  <Text style={styles.logsEmptySub}>
                    Live performance metrics were not recorded for this session. Full audio token usage and conversation speech turns can be viewed in the Session Detail view.
                  </Text>
                  {activeLogsSession?.turns && activeLogsSession.turns.length > 0 && (
                    <Pressable
                      onPress={() => {
                        const s = activeLogsSession;
                        setActiveLogsSession(null);
                        setActiveSession(s);
                      }}
                      style={styles.viewDetailFromLogsBtn}
                    >
                      <Text style={styles.viewDetailFromLogsBtnText}>View Session Detail & Turns</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* 5. SESSION SPEECH CORRECTIONS & NATURAL REPHRASING MODAL     */}
      {/* ============================================================ */}
      <Modal
        visible={!!activeAnalysisSession}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveAnalysisSession(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContentAnalysis}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle}>Speech Corrections & Natural Phrasing</Text>
                  <View style={[styles.logsBadge, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                    <Text style={[styles.logsBadgeText, { color: '#9333ea' }]}>
                      {activeAnalysisSession?.sessionCode}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modalSub}>
                  Student: {activeAnalysisSession?.user?.name || 'Student'} • {activeAnalysisSession?.topic || 'Speaking Practice'} • {formatClientDateTime(activeAnalysisSession?.timestamp, activeAnalysisSession?.displayDate)}
                </Text>
              </View>

              <Pressable
                onPress={() => setActiveAnalysisSession(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {analysisLoading && !analysisDetail ? (
                <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <ActivityIndicator size="large" color="#9333ea" />
                  <Text style={{ ...fontStyle('inter', 'medium'), fontSize: 13, color: '#64748b' }}>
                    Loading session speech corrections...
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {/* Session Context Bar */}
                  <View style={styles.analysisMetaStrip}>
                    <View style={styles.analysisMetaPill}>
                      <Feather name="clock" size={13} color="#0d9488" />
                      <Text style={styles.analysisMetaPillText}>
                        Duration: {activeAnalysisSession?.durationFormatted || `${Math.round((activeAnalysisSession?.durationSeconds || 0) / 60)}m`}
                      </Text>
                    </View>

                    <View style={styles.analysisMetaPill}>
                      <Feather name="message-square" size={13} color="#2563eb" />
                      <Text style={styles.analysisMetaPillText}>
                        Turns: {(analysisDetail?.turns || []).length || activeAnalysisSession?.turnsCount || 0}
                      </Text>
                    </View>

                    <View style={styles.analysisMetaPill}>
                      <Feather name="target" size={13} color="#7c3aed" />
                      <Text style={styles.analysisMetaPillText}>
                        {activeAnalysisSession?.topic || 'Speaking Practice'}
                      </Text>
                    </View>

                    {typeof (analysisDetail?.userRating ?? activeAnalysisSession?.userRating ?? activeAnalysisSession?.user_rating) === 'number' && (
                      <View style={[styles.analysisMetaPill, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                        <Ionicons name="star" size={13} color="#d97706" />
                        <Text style={[styles.analysisMetaPillText, { color: '#b45309', ...fontStyle('inter', 'bold') }]}>
                          Review: {Number(analysisDetail?.userRating ?? activeAnalysisSession?.userRating ?? activeAnalysisSession?.user_rating)}.0 ★
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Corrections Breakdown */}
                  {(() => {
                    const allList: any[] = analysisDetail?.grammarCorrections || activeAnalysisSession?.grammarCorrections || [];
                    const onCallList = allList.filter((c: any) => (c.source || 'on_call') === 'on_call');
                    const postAnalysisList = allList.filter((c: any) => c.source === 'post_analysis');

                    const filteredList = allList.filter((c: any) => {
                      if (correctionFilter === 'on_call') return (c.source || 'on_call') === 'on_call';
                      if (correctionFilter === 'post_analysis') return c.source === 'post_analysis';
                      return true;
                    });

                    return (
                      <View style={styles.analysisCorrectionsCard}>
                        {/* Section Header with Counts and Action */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                          <View>
                            <Text style={styles.analysisSectionHeading}>
                              Corrections & Natural Phrasing ({allList.length})
                            </Text>
                            <Text style={{ ...fontStyle('inter', 'regular'), fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              {onCallList.length} Live On-Call • {postAnalysisList.length} Post-Session Analysis
                            </Text>
                          </View>

                          {/* Quick Trigger Button for AI Post Analysis */}
                          {postAnalysisList.length === 0 && (
                            <Pressable
                              onPress={handleTriggerAiAnalysis}
                              disabled={analyzingAi}
                              style={styles.runAnalysisHeaderBtn}
                            >
                              {analyzingAi ? (
                                <ActivityIndicator size="small" color="#9333ea" style={{ marginRight: 6 }} />
                              ) : (
                                <Ionicons name="sparkles" size={13} color="#9333ea" style={{ marginRight: 6 }} />
                              )}
                              <Text style={styles.runAnalysisHeaderBtnText}>
                                {analyzingAi ? 'Running AI Post-Analysis...' : 'Generate AI Post-Analysis'}
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        {analyzingError && (
                          <View style={styles.analysisErrorBox}>
                            <Feather name="alert-circle" size={14} color="#dc2626" />
                            <Text style={styles.analysisErrorText}>{analyzingError}</Text>
                          </View>
                        )}

                        {/* Filter Tabs */}
                        <View style={styles.corrFilterTabsRow}>
                          <Pressable
                            onPress={() => setCorrectionFilter('all')}
                            style={[styles.corrFilterTab, correctionFilter === 'all' && styles.corrFilterTabActive]}
                          >
                            <Text style={[styles.corrFilterTabText, correctionFilter === 'all' && styles.corrFilterTabTextActive]}>
                              All ({allList.length})
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => setCorrectionFilter('on_call')}
                            style={[
                              styles.corrFilterTab,
                              correctionFilter === 'on_call' && styles.corrFilterTabOnCallActive,
                            ]}
                          >
                            <View style={[styles.corrTabDot, { backgroundColor: '#10b981' }]} />
                            <Text style={[styles.corrFilterTabText, correctionFilter === 'on_call' && styles.corrFilterTabOnCallText]}>
                              Live On-Call ({onCallList.length})
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => setCorrectionFilter('post_analysis')}
                            style={[
                              styles.corrFilterTab,
                              correctionFilter === 'post_analysis' && styles.corrFilterTabPostActive,
                            ]}
                          >
                            <View style={[styles.corrTabDot, { backgroundColor: '#a855f7' }]} />
                            <Text style={[styles.corrFilterTabText, correctionFilter === 'post_analysis' && styles.corrFilterTabPostText]}>
                              Post-Session Analysis ({postAnalysisList.length})
                            </Text>
                          </Pressable>
                        </View>

                        {/* Helper notice explaining the selected filter */}
                        <View style={styles.corrFilterExplainer}>
                          <Feather
                            name={correctionFilter === 'post_analysis' ? 'award' : 'zap'}
                            size={13}
                            color={correctionFilter === 'post_analysis' ? '#9333ea' : '#059669'}
                          />
                          <Text style={styles.corrFilterExplainerText}>
                            {correctionFilter === 'on_call'
                              ? 'Live On-Call: Real-time correction cards presented to the student on-screen as they spoke during the call.'
                              : correctionFilter === 'post_analysis'
                              ? 'Post-Session Analysis: Comprehensive natural rephrasings, grammar corrections, and phonetics generated from the conversation transcript.'
                              : 'Showing both live on-call prompts and post-session transcript analysis corrections.'}
                          </Text>
                        </View>

                        {/* List of Corrections */}
                        {filteredList.length === 0 ? (
                          <View style={styles.noCorrectionsBox}>
                            {correctionFilter === 'post_analysis' ? (
                              <>
                                <Feather name="cpu" size={24} color="#9333ea" />
                                <Text style={styles.noCorrectionsTitle}>No Post-Session Analysis Yet</Text>
                                <Text style={styles.noCorrectionsSub}>
                                  Deep transcript analysis scans the dialogue turns after the session for pronunciation clarity, grammar rules, and native phrasing.
                                </Text>
                                <Pressable
                                  onPress={handleTriggerAiAnalysis}
                                  disabled={analyzingAi}
                                  style={styles.runAnalysisActionBtn}
                                >
                                  {analyzingAi ? (
                                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                                  ) : (
                                    <Ionicons name="sparkles" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                                  )}
                                  <Text style={styles.runAnalysisActionBtnText}>
                                    {analyzingAi ? 'Running Post-Session AI Analysis...' : 'Generate AI Post-Analysis Now'}
                                  </Text>
                                </Pressable>
                              </>
                            ) : (
                              <>
                                <Feather name="check-circle" size={24} color="#16a34a" />
                                <Text style={styles.noCorrectionsTitle}>
                                  {correctionFilter === 'on_call'
                                    ? 'No Live On-Call Corrections Flagged'
                                    : 'Clean Speech Performance!'}
                                </Text>
                                <Text style={styles.noCorrectionsSub}>
                                  {correctionFilter === 'on_call'
                                    ? 'No live correction prompts were triggered while speaking during this conversation.'
                                    : 'No grammar mistakes or phrasing issues were flagged for this conversation.'}
                                </Text>
                              </>
                            )}
                          </View>
                        ) : (
                          <View style={{ gap: 12 }}>
                            {filteredList.map((c: any, cIdx: number) => {
                              const isPost = c.source === 'post_analysis';
                              return (
                                <View key={cIdx} style={styles.corrCard}>
                                  {/* Top Badges Row */}
                                  <View style={styles.corrCardTopRow}>
                                    <View style={isPost ? styles.corrBadgePost : styles.corrBadgeLive}>
                                      <Feather
                                        name={isPost ? 'award' : 'zap'}
                                        size={11}
                                        color={isPost ? '#7e22ce' : '#047857'}
                                      />
                                      <Text style={isPost ? styles.corrBadgePostText : styles.corrBadgeLiveText}>
                                        {isPost ? 'POST-SESSION ANALYSIS' : 'LIVE ON-CALL'}
                                      </Text>
                                    </View>

                                    {c.type && (
                                      <View style={styles.corrTypeTag}>
                                        <Text style={styles.corrTypeTagText}>
                                          {c.type === 'pronunciation'
                                            ? 'Pronunciation'
                                            : c.type === 'more_natural'
                                            ? 'Natural Phrasing'
                                            : 'Grammar'}
                                        </Text>
                                      </View>
                                    )}
                                  </View>

                                  {/* Speech Comparison: Student Said vs More Natural */}
                                  <View style={styles.corrComparisonGrid}>
                                    {/* Student Spoke */}
                                    <View style={styles.corrStudentBox}>
                                      <View style={styles.corrBoxHeader}>
                                        <Feather name="user" size={11} color="#e11d48" />
                                        <Text style={styles.corrStudentLabel}>Student Said</Text>
                                      </View>
                                      <Text style={styles.corrStudentText}>
                                        "{c.studentSaid || c.student_said}"
                                      </Text>
                                    </View>

                                    {/* Center Arrow */}
                                    <View style={styles.corrArrowContainer}>
                                      <Feather name="arrow-right" size={16} color="#94a3b8" />
                                    </View>

                                    {/* Maya Suggestion / Correct Phrasing */}
                                    <View style={styles.corrMayaBox}>
                                      <View style={styles.corrBoxHeader}>
                                        <Feather name="check" size={11} color="#16a34a" />
                                        <Text style={styles.corrMayaLabel}>More Natural / Correct</Text>
                                      </View>
                                      <Text style={styles.corrMayaText}>
                                        "{c.moreNatural || c.more_natural}"
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Explanation / Rule Box */}
                                  {c.explanation ? (
                                    <View style={styles.corrRuleBox}>
                                      <Feather name="info" size={13} color="#0d9488" style={{ marginTop: 2 }} />
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.corrRuleLabel}>Why this is correct / natural:</Text>
                                        <Text style={styles.corrRuleText}>{c.explanation}</Text>
                                      </View>
                                    </View>
                                  ) : null}

                                  {/* Highlight Words Pill diff if available */}
                                  {Array.isArray(c.highlightWords) && c.highlightWords.length > 0 && (
                                    <View style={styles.corrHighlightsRow}>
                                      <Text style={styles.corrHighlightsLabel}>Key Focus:</Text>
                                      {c.highlightWords.map((hw: string, hIdx: number) => (
                                        <View key={hIdx} style={styles.corrHighlightChip}>
                                          <Text style={styles.corrHighlightChipText}>{hw}</Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  {/* Modal Footer Cross-Navigation */}
                  <View style={[styles.modalFooterActions, { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }]}>
                    <Pressable
                      onPress={() => {
                        const s = activeAnalysisSession;
                        setActiveAnalysisSession(null);
                        setActiveSession(s);
                      }}
                      style={styles.viewDetailFromLogsBtn}
                    >
                      <Feather name="file-text" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.viewDetailFromLogsBtnText}>View Full Transcript & Audio</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        const s = activeAnalysisSession;
                        setActiveAnalysisSession(null);
                        setActiveLogsSession(s);
                      }}
                      style={[styles.viewDetailFromLogsBtn, { backgroundColor: '#0f766e' }]}
                    >
                      <Feather name="activity" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.viewDetailFromLogsBtnText}>Check Diagnostics Logs</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  appShell: {
    flex: 1,
    flexDirection: 'row',
  },

  // ============================================================
  // SIDEBAR STYLES
  // ============================================================
  sidebar: {
    width: 240,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarMobile: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  sidebarLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  brandTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0f172a',
  },
  brandSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
  },
  closeSidebarBtn: {
    padding: 4,
  },
  sidebarNavScroll: {
    flex: 1,
    paddingVertical: 10,
  },
  navGroup: {
    marginBottom: 16,
  },
  navGroupTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 10,
    color: '#94a3b8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#e6f4f1',
  },
  navItemIcon: {
    marginRight: 10,
  },
  navItemText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#64748b',
  },
  navItemTextActive: {
    ...fontStyle('inter', 'semiBold'),
    color: '#0d9488',
  },
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  userAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12,
    color: '#ffffff',
  },
  userProfileTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  userEmail: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  logoutText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#ef4444',
  },

  // ============================================================
  // MAIN AREA & TOP BAR STYLES
  // ============================================================
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8fafc',
  },
  topBar: {
    height: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  hamburgerBtn: {
    padding: 6,
    borderRadius: 6,
  },
  breadcrumbCol: {},
  breadcrumbTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 14,
    color: '#0f172a',
  },
  breadcrumbSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  topSearchPill: {
    height: 34,
    width: 160,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  topSearchPlaceholder: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 6,
    flex: 1,
  },
  shortcutBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shortcutText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10,
    color: '#94a3b8',
  },
  bellBtn: {
    position: 'relative',
    padding: 6,
  },
  bellBadgeDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  topAdminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  topAdminAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0d9488',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topAdminAvatarText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 11,
    color: '#ffffff',
  },
  topAdminName: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#334155',
    marginLeft: 8,
  },

  // ============================================================
  // PAGE CONTENT STYLES
  // ============================================================
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  pageHeading: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 22,
    color: '#0f172a',
  },
  pageSubheading: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exportBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#334155',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#0d9488',
  },

  // 5 Metric Cards Row
  metricCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  metricLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  metricValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 21,
  },
  metricSubText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },

  // Daily AI Usage Chart Card
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  chartTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15,
    color: '#0f172a',
  },
  rangePillContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  rangePillActive: {
    backgroundColor: '#0f766e',
  },
  rangePillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  rangePillTextActive: {
    color: '#ffffff',
    ...fontStyle('inter', 'semiBold'),
  },
  svgWrapper: {
    position: 'relative',
    height: 190,
  },
  chartLoading: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  xAxisLabels: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 18,
  },
  axisText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10,
    color: '#94a3b8',
  },
  tooltipCard: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 20,
    minWidth: 160,
  },
  tooltipDateText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 4,
  },
  tooltipValueText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 15,
    color: '#0d9488',
  },

  // Table Card
  tableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    minWidth: 260,
    flex: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  dropdownsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  dropdownWrapper: {
    position: 'relative',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 38,
    backgroundColor: '#ffffff',
  },
  dropdownText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#334155',
  },
  menuPopover: {
    position: 'absolute',
    top: 42,
    right: 0,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
    paddingVertical: 4,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  menuItemText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#334155',
  },
  menuItemTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },

  // Table Structure
  tableInner: {
    minWidth: 1220,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
  },
  th: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#64748b',
    paddingHorizontal: 6,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  tableDataRowAlt: {
    backgroundColor: '#fbfcfd',
  },
  td: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#334155',
    paddingHorizontal: 6,
  },
  tdUser: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatarInitials: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#ffffff',
  },
  userNameText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#0f172a',
    flex: 1,
  },
  sessionCodeText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0284c7',
  },
  modelBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  modelBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#475569',
  },
  modeBadgeEnglish: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  modeBadgeEnglishText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#2563eb',
  },
  modeBadgeSinhalaSmart: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  modeBadgeSinhalaSmartText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#1d4ed8',
  },
  modeBadgeSinhalaBalanced: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  modeBadgeSinhalaBalancedText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#16a34a',
  },
  modeBadgeSinhalaDeep: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  modeBadgeSinhalaDeepText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#b45309',
  },
  statusBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#059669',
  },
  hintsBadge: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'center',
  },
  hintsBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#7c3aed',
  },
  detailBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#334155',
  },
  tableLoadingRow: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  tableLoadingText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
  },
  tableEmptyRow: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  tableEmptyText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#94a3b8',
  },

  // ============================================================
  // MODAL STYLES
  // ============================================================
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 720,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    color: '#0f172a',
  },
  modalSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 24,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  modalStatBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  modalStatLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  modalStatValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 17,
    color: '#0f172a',
  },
  modalStatSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  modalTopicText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 14,
    color: '#334155',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  modalReviewSection: {
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalReviewSectionTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
  },
  modalRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  modalRatingScoreText: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 12.5,
    color: '#b45309',
  },
  modalNoRatingBadge: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  modalNoRatingBadgeText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
  },
  modalFeedbackCommentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  modalFeedbackCommentText: {
    flex: 1,
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    fontStyle: 'italic',
  },
  modalNoCommentText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11.5,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  correctionCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  corrStudentSaid: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#991b1b',
    marginBottom: 2,
  },
  corrMoreNatural: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#166534',
    marginBottom: 4,
  },
  corrExplanation: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#475569',
  },
  turnBubble: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  turnModel: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 3,
    borderLeftColor: '#0d9488',
  },
  turnUser: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#0284c7',
  },
  turnRole: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  turnText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#0f172a',
  },
  logsBtn: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logsBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0d9488',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexWrap: 'wrap',
    gap: 12,
  },
  paginationInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  },
  paginationInfoText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
  },
  paginationInfoBold: {
    ...fontStyle('inter', 'semiBold'),
    color: '#0f172a',
  },
  pageSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  pageSizeLabel: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
  },
  pageSizeDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pageSizeDropdownText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
  },
  pageSizePopover: {
    position: 'absolute',
    bottom: 28,
    left: 50,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
    minWidth: 54,
  },
  pageSizeOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pageSizeOptionActive: {
    backgroundColor: '#f0fdfa',
  },
  pageSizeOptionText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },
  pageSizeOptionTextActive: {
    ...fontStyle('inter', 'semiBold'),
    color: '#0d9488',
  },
  pageNavControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  pageNavBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
  },
  pageNavBtnText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
  },
  pageNavBtnTextDisabled: {
    color: '#cbd5e1',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageNumberBtn: {
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
  },
  pageNumberBtnActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  pageNumberText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#334155',
  },
  pageNumberTextActive: {
    ...fontStyle('inter', 'semiBold'),
    color: '#ffffff',
  },
  pageEllipsis: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#94a3b8',
    paddingHorizontal: 2,
  },
  modalContentLogs: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 860,
    maxHeight: '90%',
    height: '86%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalLogsScrollView: {
    flex: 1,
  },
  modalLogsBodyContent: {
    paddingBottom: 24,
  },
  trackingBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  trackingCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  trackingCardLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackingCardValue: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
  },
  logsBadge: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logsBadgeText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#0d9488',
  },
  logsLoadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  logsLoadingText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
  },
  logsKpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logsKpiCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  logsKpiLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logsKpiValue: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 18,
    marginTop: 4,
  },
  latencyPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  latencyPillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 10,
  },
  logsFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
    flexWrap: 'wrap',
    gap: 10,
  },
  logsSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 180,
    gap: 6,
  },
  logsSearchInput: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#0f172a',
    padding: 0,
  },
  timelineList: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  timelineItemError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  timelineTimestamp: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#94a3b8',
    minWidth: 70,
  },
  timelineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineBadgeDefault: {
    backgroundColor: '#e2e8f0',
  },
  timelineBadgeLatency: {
    backgroundColor: '#e0f2fe',
  },
  timelineBadgeWarning: {
    backgroundColor: '#fef3c7',
  },
  timelineBadgeError: {
    backgroundColor: '#fee2e2',
  },
  timelineBadgeText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11,
  },
  timelineBadgeTextDefault: {
    color: '#475569',
  },
  timelineBadgeTextLatency: {
    color: '#0284c7',
  },
  timelineBadgeTextWarning: {
    color: '#b45309',
  },
  timelineBadgeTextError: {
    color: '#b91c1c',
  },
  timelineDetailText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  logsEmptyContainer: {
    paddingVertical: 50,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logsEmptyTitle: {
    ...fontStyle('outfit', 'bold'),
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 6,
  },
  logsEmptySub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 420,
    marginBottom: 16,
  },
  viewDetailFromLogsBtn: {
    backgroundColor: '#0d9488',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewDetailFromLogsBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#ffffff',
  },
  modalFooterActions: {
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCheckLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCheckLogsBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#ffffff',
  },

  // Final Speech Analysis & Review Modal Styles
  analysisBtn: {
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  analysisBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12,
    color: '#9333ea',
  },
  modalCheckAnalysisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9333ea',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalContentAnalysis: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '95%',
    maxWidth: 820,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  analysisMetaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  analysisMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  analysisMetaPillText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#334155',
  },
  analysisSectionHeading: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 15,
    color: '#0f172a',
  },
  analysisCorrectionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  runAnalysisHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#d8b4fe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  runAnalysisHeaderBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11.5,
    color: '#9333ea',
  },
  runAnalysisActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9333ea',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  runAnalysisActionBtnText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#ffffff',
  },
  analysisErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 8,
  },
  analysisErrorText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#b91c1c',
    flex: 1,
  },
  corrFilterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    backgroundColor: '#f8fafc',
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  corrFilterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  corrFilterTabActive: {
    backgroundColor: '#0f172a',
  },
  corrFilterTabOnCallActive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  corrFilterTabPostActive: {
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  corrTabDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  corrFilterTabText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 12,
    color: '#64748b',
  },
  corrFilterTabTextActive: {
    color: '#ffffff',
    ...fontStyle('inter', 'semiBold'),
  },
  corrFilterTabOnCallText: {
    color: '#047857',
    ...fontStyle('inter', 'semiBold'),
  },
  corrFilterTabPostText: {
    color: '#7e22ce',
    ...fontStyle('inter', 'semiBold'),
  },
  corrFilterExplainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: '#f8fafc',
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  corrFilterExplainerText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    lineHeight: 16,
  },
  noCorrectionsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  noCorrectionsTitle: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 14,
    color: '#0f172a',
  },
  noCorrectionsSub: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 17,
  },
  corrCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  corrCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  corrBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  corrBadgeLiveText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#047857',
    letterSpacing: 0.3,
  },
  corrBadgePost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  corrBadgePostText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#7e22ce',
    letterSpacing: 0.3,
  },
  corrTypeTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  corrTypeTagText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10.5,
    color: '#475569',
  },
  corrComparisonGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    flexWrap: 'wrap',
  },
  corrStudentBox: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  corrBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  corrStudentLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 9.5,
    color: '#be123c',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  corrStudentText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#881337',
    lineHeight: 18,
  },
  corrArrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  corrMayaBox: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  corrMayaLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 9.5,
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  corrMayaText: {
    ...fontStyle('outfit', 'semiBold'),
    fontSize: 13,
    color: '#14532d',
    lineHeight: 18,
  },
  corrRuleBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
  },
  corrRuleLabel: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10,
    color: '#0f766e',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  corrRuleText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  corrHighlightsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 2,
  },
  corrHighlightsLabel: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10.5,
    color: '#64748b',
  },
  corrHighlightChip: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  corrHighlightChipText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 10.5,
    color: '#1d4ed8',
  },
  analysisReviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  studentCommentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdfa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    borderLeftWidth: 3,
    borderLeftColor: '#0d9488',
  },
  studentCommentTag: {
    ...fontStyle('inter', 'bold'),
    fontSize: 10.5,
    color: '#0d9488',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  studentCommentText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 13,
    color: '#0f172a',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
