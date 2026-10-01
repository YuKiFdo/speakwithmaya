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
  status: string;
  turnsCount: number;
  correctionsCount: number;
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
}

interface UsageResponse {
  dailyUsage: DailyUsagePoint[];
  sessions: SessionRecord[];
  stats: {
    totalTokens: number;
    totalCostLkr: number;
    totalCostUsd: number;
    totalSessions: number;
    avgDurationMinutes: number;
    minutesToday?: number;
    minutesThisMonth?: number;
    avgCostPerMin?: number;
  };
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
    group: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'home', route: '/(tabs)/dashboard' },
    ],
  },
  {
    group: 'USERS',
    items: [
      { id: 'users', label: 'Users', icon: 'users' },
      { id: 'sessions', label: 'Sessions', icon: 'message-square' },
    ],
  },
  {
    group: 'AI',
    items: [
      { id: 'maya-config', label: 'Maya Configuration', icon: 'sliders' },
      { id: 'ai-usage', label: 'AI Usage & Logs', icon: 'bar-chart-2' },
    ],
  },
  {
    group: 'MONETIZATION',
    items: [
      { id: 'plans', label: 'Plans & Pricing', icon: 'star' },
      { id: 'transactions', label: 'Transactions', icon: 'credit-card' },
    ],
  },
  {
    group: 'ENGAGEMENT',
    items: [
      { id: 'notifications', label: 'Notifications', icon: 'bell' },
      { id: 'help', label: 'Help & Support', icon: 'help-circle' },
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
        {/* ============================================================ */}
        {/* 1. SIDEBAR (Left Column)                                     */}
        {/* ============================================================ */}
        {sidebarOpen && (
          <View style={[styles.sidebar, isPhone && styles.sidebarMobile]}>
            {/* Logo Row */}
            <View style={styles.sidebarLogoRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="mic" size={18} color="#ffffff" />
              </View>
              <View style={styles.logoTextCol}>
                <Text style={styles.brandTitle}>SpeakMaya</Text>
                <Text style={styles.brandSubtitle}>AI English Coach</Text>
              </View>
              {isPhone && (
                <Pressable onPress={() => setSidebarOpen(false)} style={styles.closeSidebarBtn}>
                  <Feather name="x" size={20} color="#64748b" />
                </Pressable>
              )}
            </View>

            {/* Navigation Groups */}
            <ScrollView style={styles.sidebarNavScroll} showsVerticalScrollIndicator={false}>
              {NAV_GROUPS.map((grp) => (
                <View key={grp.group} style={styles.navGroup}>
                  <Text style={styles.navGroupTitle}>{grp.group}</Text>
                  {grp.items.map((item) => {
                    const isActive = activeNav === item.label;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => handleNavPress(item)}
                        style={[styles.navItem, isActive && styles.navItemActive]}
                      >
                        <Feather
                          name={item.icon}
                          size={16}
                          color={isActive ? '#0d9488' : '#64748b'}
                          style={styles.navItemIcon}
                        />
                        <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* Bottom Profile Area */}
            <View style={styles.sidebarFooter}>
              <View style={styles.userProfileRow}>
                <View style={styles.userAvatarCircle}>
                  <Text style={styles.userAvatarText}>SA</Text>
                </View>
                <View style={styles.userProfileTextCol}>
                  <Text style={styles.userName}>Super Admin</Text>
                  <Text style={styles.userEmail} numberOfLines={1}>
                    admin@speakmaya.com
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => router.replace('/(tabs)/dashboard')}
                style={styles.logoutBtn}
              >
                <Feather name="log-out" size={15} color="#ef4444" />
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* 2. MAIN CONTENT AREA (Top Bar + Scrollable Body)             */}
        {/* ============================================================ */}
        <View style={styles.mainArea}>
          {/* Top Bar Header */}
          <View style={styles.topBar}>
            {/* Left: Hamburger & Breadcrumb */}
            <View style={styles.topBarLeft}>
              <Pressable
                onPress={() => setSidebarOpen((prev) => !prev)}
                style={styles.hamburgerBtn}
              >
                <Feather name="menu" size={20} color="#475569" />
              </Pressable>
              <View style={styles.breadcrumbCol}>
                <Text style={styles.breadcrumbTitle}>AI Usage & Logs</Text>
                <Text style={styles.breadcrumbSub}>AI</Text>
              </View>
            </View>

            {/* Right: Search, Notifications, Super Admin Pill */}
            <View style={styles.topBarRight}>
              {/* Search Pill */}
              <View style={styles.topSearchPill}>
                <Feather name="search" size={13} color="#94a3b8" />
                <Text style={styles.topSearchPlaceholder}>Search...</Text>
                <View style={styles.shortcutBadge}>
                  <Text style={styles.shortcutText}>⌘K</Text>
                </View>
              </View>

              {/* Notification Bell */}
              <Pressable style={styles.bellBtn}>
                <Feather name="bell" size={18} color="#64748b" />
                <View style={styles.bellBadgeDot} />
              </Pressable>

              {/* Super Admin User Dropdown Pill */}
              <View style={styles.topAdminBadge}>
                <View style={styles.topAdminAvatar}>
                  <Text style={styles.topAdminAvatarText}>SA</Text>
                </View>
                {!isPhone && <Text style={styles.topAdminName}>Super Admin</Text>}
                <Feather name="chevron-down" size={14} color="#64748b" style={{ marginLeft: 4 }} />
              </View>
            </View>
          </View>

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

            {/* 5 Summary Metric Cards */}
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

              {/* 4. Estimated AI Cost */}
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Estimated AI Cost</Text>
                <Text style={[styles.metricValue, { color: '#ea580c' }]}>
                  {data?.stats?.totalCostLkr !== undefined
                    ? `LKR ${data.stats.totalCostLkr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : 'LKR 0.00'}
                </Text>
              </View>

              {/* 5. Avg Cost Per Min */}
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
                // @ts-ignore Web pointer movement
                onPointerMove={(e: any) => {
                  const locX = e.nativeEvent?.offsetX ?? e.nativeEvent?.locationX;
                  if (typeof locX === 'number') {
                    handleChartPointer(locX);
                  }
                }}
                // @ts-ignore Web pointer leave
                onPointerLeave={() => {
                  setSelectedPointIndex(null);
                }}
                onTouchMove={(e) => {
                  const locX = e.nativeEvent?.locationX;
                  if (typeof locX === 'number') {
                    handleChartPointer(locX);
                  }
                }}
                onTouchStart={(e) => {
                  const locX = e.nativeEvent?.locationX;
                  if (typeof locX === 'number') {
                    handleChartPointer(locX);
                  }
                }}
                onTouchEnd={() => {
                  setSelectedPointIndex(null);
                }}
                onTouchCancel={() => {
                  setSelectedPointIndex(null);
                }}
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
                    <Text style={[styles.th, { width: 140 }]}>Timestamp</Text>
                    <Text style={[styles.th, { width: 160 }]}>User</Text>
                    <Text style={[styles.th, { width: 110 }]}>Session</Text>
                    <Text style={[styles.th, { width: 130 }]}>Model</Text>
                    <Text style={[styles.th, { width: 90 }]}>Duration</Text>
                    <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Input Tokens</Text>
                    <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Output Tokens</Text>
                    <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>Total</Text>
                    <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Est. Cost</Text>
                    <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>Status</Text>
                    <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Action</Text>
                  </View>

                  {/* Table Body */}
                  {loading && !data ? (
                    <View style={styles.tableLoadingRow}>
                      <ActivityIndicator size="small" color="#0d9488" />
                      <Text style={styles.tableLoadingText}>Loading usage records from database...</Text>
                    </View>
                  ) : !data?.sessions || data.sessions.length === 0 ? (
                    <View style={styles.tableEmptyRow}>
                      <Text style={styles.tableEmptyText}>No sessions found matching filters</Text>
                    </View>
                  ) : (
                    data.sessions.map((row, idx) => (
                      <View
                        key={row.id || idx}
                        style={[styles.tableDataRow, idx % 2 === 1 && styles.tableDataRowAlt]}
                      >
                        {/* Timestamp */}
                        <Text style={[styles.td, { width: 140, color: '#64748b' }]}>
                          {row.displayDate || row.timestamp?.slice(0, 16)}
                        </Text>

                        {/* User */}
                        <View style={[styles.tdUser, { width: 160 }]}>
                          <View
                            style={[
                              styles.userAvatar,
                              { backgroundColor: row.user?.color || '#0d9488' },
                            ]}
                          >
                            <Text style={styles.userAvatarInitials}>
                              {row.user?.initials || 'TF'}
                            </Text>
                          </View>
                          <Text style={styles.userNameText} numberOfLines={1}>
                            {row.user?.name || 'Tharindu Fernando'}
                          </Text>
                        </View>

                        {/* Session */}
                        <View style={[styles.td, { width: 110 }]}>
                          <Text style={styles.sessionCodeText}>{row.sessionCode}</Text>
                        </View>

                        {/* Model Badge */}
                        <View style={[styles.td, { width: 130 }]}>
                          <View style={styles.modelBadge}>
                            <Text style={styles.modelBadgeText}>{row.model}</Text>
                          </View>
                        </View>

                        {/* Duration */}
                        <Text style={[styles.td, { width: 90 }]}>
                          {row.durationFormatted || `${(row.durationSeconds / 60).toFixed(1)}m`}
                        </Text>

                        {/* Input Tokens */}
                        <Text style={[styles.td, { width: 110, textAlign: 'right' }]}>
                          {row.inputTokens.toLocaleString()}
                        </Text>

                        {/* Output Tokens */}
                        <Text style={[styles.td, { width: 110, textAlign: 'right' }]}>
                          {row.outputTokens.toLocaleString()}
                        </Text>

                        {/* Total Tokens */}
                        <Text
                          style={[
                            styles.td,
                            { width: 100, textAlign: 'right', ...fontStyle('inter', 'semiBold') },
                          ]}
                        >
                          {row.totalTokens.toLocaleString()}
                        </Text>

                        {/* Est Cost */}
                        <Text
                          style={[
                            styles.td,
                            { width: 110, textAlign: 'right', color: '#0d9488', ...fontStyle('inter', 'semiBold') },
                          ]}
                        >
                          {`LKR ${row.costLkr.toFixed(2)}`}
                        </Text>

                        {/* Status */}
                        <View style={[styles.td, { width: 100, alignItems: 'center' }]}>
                          <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>Success</Text>
                          </View>
                        </View>

                        {/* Action Detail */}
                        <View style={[styles.td, { width: 80, alignItems: 'center' }]}>
                          <Pressable
                            onPress={() => setActiveSession(row)}
                            style={styles.detailBtn}
                          >
                            <Text style={styles.detailBtnText}>Detail</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
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
                <Text style={styles.modalSub}>{activeSession?.displayDate} • {activeSession?.model}</Text>
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
                  <Text style={styles.modalStatLabel}>Estimated Cost</Text>
                  <Text style={[styles.modalStatValue, { color: '#0d9488' }]}>
                    {activeSession ? `LKR ${activeSession.costLkr.toFixed(2)}` : 'LKR 0.00'}
                  </Text>
                  <Text style={styles.modalStatSub}>${activeSession?.costUsd.toFixed(5)} USD</Text>
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

              {/* Topic */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Practice Topic / Scenario</Text>
                <Text style={styles.modalTopicText}>{activeSession?.topic || 'Speaking Practice'}</Text>
              </View>

              {/* Grammar Corrections */}
              {activeSession?.grammarCorrections && activeSession.grammarCorrections.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Real-Time Coaching Corrections ({activeSession.grammarCorrections.length})</Text>
                  {activeSession.grammarCorrections.map((c, i) => (
                    <View key={i} style={styles.correctionCard}>
                      <Text style={styles.corrStudentSaid}>❌ "{c.studentSaid}"</Text>
                      <Text style={styles.corrMoreNatural}>✅ "{c.moreNatural}"</Text>
                      <Text style={styles.corrExplanation}>{c.explanation}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Transcript Turns */}
              {activeSession?.turns && activeSession.turns.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Transcript Turns ({activeSession.turns.length})</Text>
                  {activeSession.turns.map((t, idx) => (
                    <View key={idx} style={[styles.turnBubble, t.role === 'model' ? styles.turnModel : styles.turnUser]}>
                      <Text style={styles.turnRole}>{t.role === 'model' ? 'Maya (Coach)' : activeSession.user.name}</Text>
                      <Text style={styles.turnText}>{t.text}</Text>
                    </View>
                  ))}
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
    minWidth: 1100,
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
});
