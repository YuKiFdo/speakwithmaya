import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Rect, Circle, Line, Path, G, Text as SvgText } from 'react-native-svg';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminAuthStore } from '@/services/store/admin-auth-store';

/* -------------------------------------------------------------------------- */
/*  Types (unchanged API contract)                                            */
/* -------------------------------------------------------------------------- */

interface OverviewData {
  kpis: {
    totalUsers: number;
    activeSubscriptions: number;
    totalPracticeMinutes: number;
    totalSessions: number;
    avgSessionDurationSeconds: number;
    totalCostLkr: number;
    totalCostUsd: number;
    totalTokens: number;
    newUsersLast7Days: number;
    newUsersToday: number;
  };
  languageModes: {
    totalSelections: number;
    breakdown: Array<{
      key: 'sinhala_support' | 'english_only' | 'deep_guidance';
      label: string;
      sinhalaLabel: string;
      description: string;
      count: number;
      percentage: number;
      color: string;
    }>;
  };
  levels: {
    breakdown: Array<{
      key: string;
      label: string;
      tag?: string;
      description: string;
      count: number;
      percentage: number;
      color: string;
    }>;
  };
  goals: {
    breakdown: Array<{
      key: string;
      label: string;
      icon: string;
      description: string;
      count: number;
      percentage: number;
    }>;
  };
  plans: {
    tiers: Array<{ tier: string; label: string; count: number; percentage: number; color: string }>;
    statuses: Array<{ status: string; label: string; count: number; percentage: number; color: string }>;
  };
  dailyCommitment: {
    breakdown: Array<{ minutes: number; label: string; count: number; percentage: number }>;
  };
  employment: {
    breakdown: Array<{ key: string; label: string; count: number; percentage: number }>;
  };
  trends: {
    days14: Array<{
      date: string;
      dayLabel: string;
      shortLabel: string;
      registrations: number;
      sessions: number;
      isToday: boolean;
    }>;
  };
}

type TabKey = 'overview' | 'learners' | 'revenue';
type RangeKey = 7 | 14;
type ChartMode = 'bars' | 'line';

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
  violet: '#7c3aed',
  amber: '#d97706',
  green: '#16a34a',
  red: '#ef4444',
};

const PALETTE = ['#0d9488', '#3b82f6', '#7c3aed', '#f59e0b', '#ec4899', '#64748b', '#14b8a6', '#ef4444'];

const fmt = (n: number | undefined | null, digits = 0) =>
  (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

const pctChange = (cur: number, prev: number): number | null => {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
};

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

function getGoalIcon(icon: string): any {
  const known = ['mic', 'briefcase', 'globe', 'award', 'compass'];
  return known.includes(icon) ? icon : 'target';
}

/* -------------------------------------------------------------------------- */
/*  Small reusable pieces                                                     */
/* -------------------------------------------------------------------------- */

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
          <Pressable
            key={String(o.key)}
            onPress={() => onChange(o.key)}
            style={[s.segmentItem, active && s.segmentItemActive]}
          >
            <Text style={[s.segmentText, active && s.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DeltaPill({ delta, suffix = 'vs prev 7d' }: { delta: number | null; suffix?: string }) {
  if (delta === null) {
    return (
      <View style={[s.delta, { backgroundColor: '#e0f2fe' }]}>
        <Text style={[s.deltaText, { color: '#0369a1' }]}>New</Text>
      </View>
    );
  }
  const up = delta >= 0;
  return (
    <View style={s.deltaRow}>
      <View style={[s.delta, { backgroundColor: up ? '#dcfce7' : '#fee2e2' }]}>
        <Feather name={up ? 'arrow-up-right' : 'arrow-down-right'} size={12} color={up ? C.green : C.red} />
        <Text style={[s.deltaText, { color: up ? '#15803d' : '#b91c1c' }]}>{Math.abs(delta).toFixed(0)}%</Text>
      </View>
      <Text style={s.deltaSuffix}>{suffix}</Text>
    </View>
  );
}

function Sparkline({ values, color, width = 96, height = 32 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - ((v - min) / range) * (height - 6)]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={color} opacity={0.12} />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={color} />
    </Svg>
  );
}

function KpiCard({
  label,
  value,
  unit,
  icon,
  tint,
  delta,
  spark,
  footer,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: string;
  tint: string;
  delta?: number | null;
  spark?: number[];
  footer?: string;
}) {
  return (
    <View style={s.kpiCard}>
      <View style={s.kpiTop}>
        <View style={[s.kpiIcon, { backgroundColor: `${tint}18` }]}>
          <Feather name={icon as any} size={16} color={tint} />
        </View>
        <Text style={s.kpiLabel}>{label}</Text>
      </View>
      <View style={s.kpiMid}>
        <Text style={s.kpiValue}>
          {value}
          {unit ? <Text style={s.kpiUnit}> {unit}</Text> : null}
        </Text>
        {spark ? <Sparkline values={spark} color={tint} /> : null}
      </View>
      {delta !== undefined ? <DeltaPill delta={delta} /> : null}
      {footer ? <Text style={s.kpiFooter}>{footer}</Text> : null}
    </View>
  );
}

function Card({
  title,
  subtitle,
  icon,
  tint = C.teal,
  right,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  tint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[s.card, style]}>
      <View style={s.cardHeader}>
        <View style={s.cardHeaderLeft}>
          <View style={[s.cardIcon, { backgroundColor: `${tint}18` }]}>
            <Feather name={icon as any} size={16} color={tint} />
          </View>
          <View style={{ flex: 1 }}>
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

/** Donut with tappable legend. Selecting a row highlights its slice. */
function DonutBreakdown({
  items,
  centerLabel,
  centerValue,
  unit = 'learners',
}: {
  items: Array<{ key: string; label: string; count: number; percentage: number; color: string; hint?: string }>;
  centerLabel: string;
  centerValue: string;
  unit?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const size = 150;
  const stroke = 20;
  const r = (size - stroke) / 2 - 4;
  const circ = 2 * Math.PI * r;
  const total = sum(items.map((i) => i.count)) || 1;
  const activeItem = items.find((i) => i.key === active);

  let offset = 0;
  return (
    <View style={s.donutWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.soft} strokeWidth={stroke} fill="none" />
            {items.map((it) => {
              const len = (it.count / total) * circ;
              const el = (
                <Circle
                  key={it.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={it.color}
                  strokeWidth={active === it.key ? stroke + 6 : stroke}
                  strokeDasharray={`${Math.max(len - 2, 0)} ${circ - Math.max(len - 2, 0)}`}
                  strokeDashoffset={-offset}
                  fill="none"
                  opacity={active && active !== it.key ? 0.3 : 1}
                  onPress={() => setActive(active === it.key ? null : it.key)}
                />
              );
              offset += len;
              return el;
            })}
          </G>
          <SvgText x={size / 2} y={size / 2 - 2} fontSize="22" fontWeight="700" fill={C.text} textAnchor="middle">
            {activeItem ? `${activeItem.percentage}%` : centerValue}
          </SvgText>
          <SvgText x={size / 2} y={size / 2 + 16} fontSize="10.5" fill={C.muted} textAnchor="middle">
            {activeItem ? activeItem.label : centerLabel}
          </SvgText>
        </Svg>
      </View>

      <View style={s.legendCol}>
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <Pressable
              key={it.key}
              onPress={() => setActive(isActive ? null : it.key)}
              style={({ hovered }: any) => [s.legendRow, (isActive || hovered) && s.legendRowActive]}
            >
              <View style={[s.legendDot, { backgroundColor: it.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.legendLabel} numberOfLines={1}>
                  {it.label}
                </Text>
                {isActive && it.hint ? <Text style={s.legendHint}>{it.hint}</Text> : null}
              </View>
              <Text style={s.legendCount}>
                {fmt(it.count)} {unit}
              </Text>
              <Text style={[s.legendPct, { color: it.color }]}>{it.percentage}%</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Ranked horizontal bars. Tap a row to reveal its description. */
function BarList({
  items,
  unit = 'learners',
  defaultColor = C.teal,
}: {
  items: Array<{ key: string; label: string; count: number; percentage: number; color?: string; description?: string; tag?: string }>;
  unit?: string;
  defaultColor?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [sortByValue, setSortByValue] = useState(false);
  const list = useMemo(
    () => (sortByValue ? [...items].sort((a, b) => b.count - a.count) : items),
    [items, sortByValue],
  );
  const max = Math.max(...items.map((i) => i.percentage), 1);

  return (
    <View>
      <Pressable onPress={() => setSortByValue(!sortByValue)} style={s.sortBtn}>
        <Feather name="bar-chart-2" size={12} color={C.muted} />
        <Text style={s.sortBtnText}>{sortByValue ? 'Sorted by size' : 'Default order'}</Text>
      </Pressable>
      {list.map((it, idx) => {
        const color = it.color || PALETTE[idx % PALETTE.length] || defaultColor;
        const isOpen = open === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => setOpen(isOpen ? null : it.key)}
            style={({ hovered }: any) => [s.barRow, hovered && { backgroundColor: C.bg }]}
          >
            <View style={s.barRowTop}>
              <View style={s.barLabelWrap}>
                <Text style={s.barLabel} numberOfLines={1}>
                  {it.label}
                </Text>
                {it.tag ? (
                  <View style={[s.tag, { backgroundColor: `${color}18` }]}>
                    <Text style={[s.tagText, { color }]}>{it.tag}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.barCount}>
                {fmt(it.count)} {unit}
              </Text>
              <Text style={[s.barPct, { color }]}>{it.percentage}%</Text>
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.max((it.percentage / max) * 100, 2)}%`, backgroundColor: color }]} />
            </View>
            {isOpen && it.description ? <Text style={s.barDesc}>{it.description}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Interactive trend chart: hover/tap a day for exact values, toggle series and style. */
function TrendChart({
  days,
  showSignups,
  showCalls,
  mode,
}: {
  days: OverviewData['trends']['days14'];
  showSignups: boolean;
  showCalls: boolean;
  mode: ChartMode;
}) {
  const [width, setWidth] = useState(600);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const height = 220;
  const pad = { t: 16, b: 28, l: 34, r: 8 };
  const iw = Math.max(width - pad.l - pad.r, 50);
  const ih = height - pad.t - pad.b;

  const visible = [
    ...(showSignups ? days.map((d) => d.registrations) : []),
    ...(showCalls ? days.map((d) => d.sessions) : []),
  ];
  const rawMax = Math.max(...visible, 4);
  const niceMax = Math.ceil(rawMax / 4) * 4;
  const colW = iw / days.length;
  const xAt = (i: number) => pad.l + i * colW + colW / 2;
  const yAt = (v: number) => pad.t + ih - (v / niceMax) * ih;

  const linePath = (key: 'registrations' | 'sessions') =>
    days.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d[key]).toFixed(1)}`).join(' ');
  const areaPath = (key: 'registrations' | 'sessions') =>
    `${linePath(key)} L${xAt(days.length - 1)},${pad.t + ih} L${xAt(0)},${pad.t + ih} Z`;

  const active = activeIdx !== null ? days[activeIdx] : days[days.length - 1];
  const barW = Math.max(Math.min(colW * (showSignups && showCalls ? 0.32 : 0.5), 22), 5);

  return (
    <View>
      <View style={s.tooltipBar}>
        <Text style={s.tooltipDate}>{active.dayLabel}{active.isToday ? ' · Today' : ''}</Text>
        <View style={s.tooltipVals}>
          <View style={s.tooltipItem}>
            <View style={[s.legendDot, { backgroundColor: C.blue }]} />
            <Text style={s.tooltipNum}>{active.registrations}</Text>
            <Text style={s.tooltipLbl}>signups</Text>
          </View>
          <View style={s.tooltipItem}>
            <View style={[s.legendDot, { backgroundColor: C.teal }]} />
            <Text style={s.tooltipNum}>{active.sessions}</Text>
            <Text style={s.tooltipLbl}>calls</Text>
          </View>
        </View>
      </View>

      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        <Svg width={width} height={height}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.t + ih - t * ih;
            return (
              <G key={t}>
                <Line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={t === 0 ? '#dbe2ea' : C.soft} strokeWidth={1} strokeDasharray={t === 0 ? undefined : '4 4'} />
                <SvgText x={pad.l - 6} y={y + 3} fontSize="9.5" fill={C.faint} textAnchor="end">
                  {Math.round(t * niceMax)}
                </SvgText>
              </G>
            );
          })}

          {activeIdx !== null && (
            <Rect x={xAt(activeIdx) - colW / 2 + 1} y={pad.t} width={colW - 2} height={ih} fill={C.teal} opacity={0.07} rx={4} />
          )}

          {mode === 'line' && (
            <>
              {showSignups && <Path d={areaPath('registrations')} fill={C.blue} opacity={0.08} />}
              {showCalls && <Path d={areaPath('sessions')} fill={C.teal} opacity={0.08} />}
              {showSignups && <Path d={linePath('registrations')} stroke={C.blue} strokeWidth={2.5} fill="none" strokeLinejoin="round" />}
              {showCalls && <Path d={linePath('sessions')} stroke={C.teal} strokeWidth={2.5} fill="none" strokeLinejoin="round" />}
            </>
          )}

          {days.map((d, i) => {
            const cx = xAt(i);
            const isActive = activeIdx === i;
            return (
              <G key={d.date}>
                {mode === 'bars' && (
                  <>
                    {showSignups && (
                      <Rect
                        x={showCalls ? cx - barW - 1 : cx - barW / 2}
                        y={yAt(d.registrations)}
                        width={barW}
                        height={Math.max(pad.t + ih - yAt(d.registrations), d.registrations > 0 ? 2 : 0)}
                        fill={C.blue}
                        opacity={activeIdx !== null && !isActive ? 0.45 : 1}
                        rx={3}
                      />
                    )}
                    {showCalls && (
                      <Rect
                        x={showSignups ? cx + 1 : cx - barW / 2}
                        y={yAt(d.sessions)}
                        width={barW}
                        height={Math.max(pad.t + ih - yAt(d.sessions), d.sessions > 0 ? 2 : 0)}
                        fill={C.teal}
                        opacity={activeIdx !== null && !isActive ? 0.45 : 1}
                        rx={3}
                      />
                    )}
                  </>
                )}
                {mode === 'line' && isActive && (
                  <>
                    {showSignups && <Circle cx={cx} cy={yAt(d.registrations)} r={4.5} fill="#fff" stroke={C.blue} strokeWidth={2.5} />}
                    {showCalls && <Circle cx={cx} cy={yAt(d.sessions)} r={4.5} fill="#fff" stroke={C.teal} strokeWidth={2.5} />}
                  </>
                )}
                <SvgText
                  x={cx}
                  y={height - 9}
                  fontSize="9.5"
                  fontWeight={d.isToday || isActive ? '700' : '500'}
                  fill={d.isToday ? C.teal : isActive ? C.text : C.muted}
                  textAnchor="middle"
                >
                  {days.length > 10 && i % 2 === 1 && !d.isToday ? '' : d.shortLabel}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Invisible hit areas for hover (web) + tap (mobile) */}
        <View style={[StyleSheet.absoluteFill, { left: pad.l, right: pad.r, flexDirection: 'row' }]}>
          {days.map((d, i) => (
            <Pressable
              key={d.date}
              style={{ flex: 1, height: '100%' }}
              onPress={() => setActiveIdx(activeIdx === i ? null : i)}
              {...({ onHoverIn: () => setActiveIdx(i), onHoverOut: () => setActiveIdx(null) } as any)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function Chip({ label, color, active, onPress }: { label: string; color: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: `${color}15`, borderColor: color }]}>
      <View style={[s.legendDot, { backgroundColor: active ? color : C.faint }]} />
      <Text style={[s.chipText, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

function Skeleton() {
  return (
    <View>
      <View style={s.kpiGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.kpiCard, { height: 128 }]}>
            <View style={[s.skel, { width: '50%', height: 12 }]} />
            <View style={[s.skel, { width: '65%', height: 28, marginTop: 18 }]} />
            <View style={[s.skel, { width: '40%', height: 12, marginTop: 14 }]} />
          </View>
        ))}
      </View>
      <View style={[s.card, { height: 300, marginTop: 16 }]}>
        <View style={[s.skel, { width: '30%', height: 16 }]} />
        <View style={[s.skel, { width: '100%', height: 200, marginTop: 20 }]} />
      </View>
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <ActivityIndicator color={C.teal} />
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                    */
/* -------------------------------------------------------------------------- */

export default function AdminDashboardScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState('');

  const [tab, setTab] = useState<TabKey>('overview');
  const [range, setRange] = useState<RangeKey>(14);
  const [chartMode, setChartMode] = useState<ChartMode>('bars');
  const [showSignups, setShowSignups] = useState(true);
  const [showCalls, setShowCalls] = useState(true);

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const token = AdminAuthStore.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['x-admin-token'] = token;

      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/analytics/overview`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Server responded with ${res.status}`);
      }
      setData(await res.json());
      setLastRefreshed(
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      );
    } catch (err: any) {
      console.warn('[AdminDashboard] Fetch error:', err);
      setErrorMessage(err?.message || 'Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    setSidebarOpen(!isPhone);
  }, [isPhone]);

  /* ---------------------------- Derived analytics --------------------------- */
  const derived = useMemo(() => {
    if (!data) return null;
    const { kpis, trends } = data;
    const days = trends.days14;
    const last7 = days.slice(-7);
    const prev7 = days.slice(-14, -7);

    const signupsCur = sum(last7.map((d) => d.registrations));
    const signupsPrev = sum(prev7.map((d) => d.registrations));
    const callsCur = sum(last7.map((d) => d.sessions));
    const callsPrev = sum(prev7.map((d) => d.sessions));

    const peak = days.reduce((best, d) => (d.sessions > best.sessions ? d : best), days[0]);
    const activeRate = kpis.totalUsers ? (kpis.activeSubscriptions / kpis.totalUsers) * 100 : 0;
    const costPerMin = kpis.totalPracticeMinutes ? kpis.totalCostLkr / kpis.totalPracticeMinutes : 0;
    const costPerUser = kpis.totalUsers ? kpis.totalCostLkr / kpis.totalUsers : 0;
    const callsPerUser = kpis.totalUsers ? kpis.totalSessions / kpis.totalUsers : 0;
    const avgMin = kpis.avgSessionDurationSeconds / 60;

    const topMode = [...data.languageModes.breakdown].sort((a, b) => b.count - a.count)[0];
    const topLevel = [...data.levels.breakdown].sort((a, b) => b.count - a.count)[0];
    const topGoal = [...data.goals.breakdown].sort((a, b) => b.count - a.count)[0];
    const canceled = data.plans.statuses.find((x) => x.status === 'canceled');

    const insights: Array<{ icon: string; tone: string; title: string; text: string }> = [];
    if (signupsCur || signupsPrev) {
      const d = pctChange(signupsCur, signupsPrev);
      insights.push({
        icon: d !== null && d < 0 ? 'trending-down' : 'trending-up',
        tone: d !== null && d < 0 ? C.red : C.green,
        title: 'Signups',
        text:
          d === null
            ? `${signupsCur} new learners this week (none the week before).`
            : `${signupsCur} new learners in the last 7 days, ${d >= 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(0)}% on the week before.`,
      });
    }
    if (peak && peak.sessions > 0) {
      insights.push({
        icon: 'zap',
        tone: C.teal,
        title: 'Peak usage',
        text: `Busiest day was ${peak.dayLabel} with ${peak.sessions} calls.`,
      });
    }
    if (topMode) {
      insights.push({
        icon: 'message-circle',
        tone: C.violet,
        title: 'Language preference',
        text: `${topMode.percentage}% choose "${topMode.label}" - the most popular coaching mode.`,
      });
    }
    if (topLevel) {
      insights.push({
        icon: 'layers',
        tone: C.blue,
        title: 'Learner level',
        text: `Largest group is ${topLevel.label} (${topLevel.percentage}%).`,
      });
    }
    if (topGoal) {
      insights.push({
        icon: 'target',
        tone: C.amber,
        title: 'Main goal',
        text: `${topGoal.percentage}% joined to ${topGoal.label.toLowerCase()}.`,
      });
    }
    insights.push({
      icon: 'dollar-sign',
      tone: C.amber,
      title: 'Unit cost',
      text: `AI cost is about LKR ${costPerMin.toFixed(2)} per practice minute and LKR ${costPerUser.toFixed(0)} per learner.`,
    });

    return {
      days,
      last7,
      signupsCur,
      signupsPrev,
      callsCur,
      callsPrev,
      signupsDelta: pctChange(signupsCur, signupsPrev),
      callsDelta: pctChange(callsCur, callsPrev),
      peak,
      activeRate,
      costPerMin,
      costPerUser,
      callsPerUser,
      avgMin,
      canceled: canceled?.count ?? 0,
      insights,
    };
  }, [data]);

  const visibleDays = useMemo(() => (derived ? derived.days.slice(-range) : []), [derived, range]);
  const kpis = data?.kpis;
  const twoCol = !isPhone;

  /* --------------------------------- Tabs ----------------------------------- */

  const renderOverview = () => {
    if (!data || !derived || !kpis) return null;
    return (
      <>
        {/* KPIs */}
        <View style={s.kpiGrid}>
          <KpiCard
            label="Real learners"
            icon="users"
            tint={C.blue}
            value={fmt(kpis.totalUsers)}
            delta={derived.signupsDelta}
            spark={derived.days.map((d) => d.registrations)}
            footer={`+${kpis.newUsersToday} today · ${kpis.newUsersLast7Days} this week`}
          />
          <KpiCard
            label="Active subscribers"
            icon="check-circle"
            tint={C.green}
            value={fmt(kpis.activeSubscriptions)}
            footer={`${derived.activeRate.toFixed(1)}% of learners · ${derived.canceled} canceled`}
          />
          <KpiCard
            label="Practice time"
            icon="mic"
            tint={C.teal}
            value={fmt(kpis.totalPracticeMinutes)}
            unit="min"
            delta={derived.callsDelta}
            spark={derived.days.map((d) => d.sessions)}
            footer={`${fmt(kpis.totalSessions)} calls · ${derived.avgMin.toFixed(1)} min avg`}
          />
          <KpiCard
            label="AI cost"
            icon="dollar-sign"
            tint={C.amber}
            value={`LKR ${fmt(kpis.totalCostLkr)}`}
            footer={`$${kpis.totalCostUsd.toFixed(2)} · LKR ${derived.costPerMin.toFixed(2)}/min`}
          />
        </View>

        {/* Insights */}
        <View style={s.insightsWrap}>
          <View style={s.insightsHeader}>
            <Feather name="zap" size={14} color={C.teal} />
            <Text style={s.insightsTitle}>Key insights</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {derived.insights.map((i, idx) => (
              <View key={idx} style={s.insightCard}>
                <View style={[s.insightIcon, { backgroundColor: `${i.tone}18` }]}>
                  <Feather name={i.icon as any} size={14} color={i.tone} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.insightTitle}>{i.title}</Text>
                  <Text style={s.insightText}>{i.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Trend */}
        <Card
          title="Activity & growth"
          subtitle="Hover or tap a day for exact numbers"
          icon="trending-up"
          tint={C.violet}
          style={{ marginBottom: 16 }}
          right={
            <View style={s.controlsRow}>
              <Chip label="Signups" color={C.blue} active={showSignups} onPress={() => (showCalls || !showSignups) && setShowSignups(!showSignups)} />
              <Chip label="Calls" color={C.teal} active={showCalls} onPress={() => (showSignups || !showCalls) && setShowCalls(!showCalls)} />
              <Segmented<RangeKey> options={[{ key: 7, label: '7D' }, { key: 14, label: '14D' }]} value={range} onChange={setRange} />
              <Segmented<ChartMode> options={[{ key: 'bars', label: 'Bars' }, { key: 'line', label: 'Line' }]} value={chartMode} onChange={setChartMode} />
            </View>
          }
        >
          <TrendChart days={visibleDays} showSignups={showSignups} showCalls={showCalls} mode={chartMode} />
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Signups (7d)</Text>
              <Text style={s.summaryValue}>{derived.signupsCur}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Calls (7d)</Text>
              <Text style={s.summaryValue}>{derived.callsCur}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Peak day</Text>
              <Text style={s.summaryValue}>
                {derived.peak.shortLabel} · {derived.peak.sessions}
              </Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Calls / learner</Text>
              <Text style={s.summaryValue}>{derived.callsPerUser.toFixed(1)}</Text>
            </View>
          </View>
        </Card>

        {/* Language modes + plans */}
        <View style={s.grid}>
          <Card
            title="Coaching language modes"
            subtitle="How learners balance English and Sinhala help"
            icon="message-circle"
            tint={C.teal}
            style={s.gridItem}
            right={
              <View style={s.countBadge}>
                <Text style={s.countBadgeText}>{data.languageModes.totalSelections} selections</Text>
              </View>
            }
          >
            <DonutBreakdown
              centerLabel="selections"
              centerValue={fmt(data.languageModes.totalSelections)}
              items={data.languageModes.breakdown.map((m) => ({
                key: m.key,
                label: `${m.label}  ·  ${m.sinhalaLabel}`,
                count: m.count,
                percentage: m.percentage,
                color: m.color,
                hint: m.description,
              }))}
            />
          </Card>

          <Card
            title="Subscription mix"
            subtitle="Plans and account status"
            icon="credit-card"
            tint={C.green}
            style={s.gridItem}
          >
            <DonutBreakdown
              centerLabel="learners"
              centerValue={fmt(kpis.totalUsers)}
              unit="users"
              items={data.plans.tiers.map((t) => ({
                key: t.tier,
                label: t.label,
                count: t.count,
                percentage: t.percentage,
                color: t.color,
              }))}
            />
          </Card>
        </View>
      </>
    );
  };

  const renderLearners = () => {
    if (!data || !kpis) return null;
    const commit = data.dailyCommitment.breakdown;
    const topCommit = [...commit].sort((a, b) => b.count - a.count)[0];
    return (
      <>
        <View style={s.grid}>
          <Card title="English levels" subtitle="Current speaking ability" icon="layers" tint={C.blue} style={s.gridItem}>
            <BarList items={data.levels.breakdown} />
          </Card>
          <Card title="Primary goals" subtitle="Why learners joined SpeakMaya" icon="target" tint={C.amber} style={s.gridItem}>
            <BarList
              items={data.goals.breakdown}
              defaultColor={C.amber}
            />
          </Card>
        </View>

        <View style={s.grid}>
          <Card
            title="Daily practice target"
            subtitle="Minutes per day learners aim for"
            icon="clock"
            tint={C.teal}
            style={s.gridItem}
          >
            <View style={s.commitRow}>
              {commit.map((c) => {
                const isTop = topCommit && c.minutes === topCommit.minutes;
                return (
                  <View key={c.minutes} style={[s.commitCard, isTop && { borderColor: C.teal, backgroundColor: '#f0fdfa' }]}>
                    <Text style={s.commitLabel}>{c.label}</Text>
                    <Text style={s.commitPct}>{c.percentage}%</Text>
                    <Text style={s.commitCount}>{c.count} learners</Text>
                    {isTop ? <Text style={s.commitTop}>Most chosen</Text> : null}
                  </View>
                );
              })}
            </View>
          </Card>

          <Card title="Employment" subtitle="Who is learning" icon="briefcase" tint="#475569" style={s.gridItem}>
            <BarList items={data.employment.breakdown} defaultColor="#475569" />
          </Card>
        </View>
      </>
    );
  };

  const renderRevenue = () => {
    if (!data || !derived || !kpis) return null;
    return (
      <>
        <View style={s.kpiGrid}>
          <KpiCard label="Cost per minute" icon="clock" tint={C.amber} value={`LKR ${derived.costPerMin.toFixed(2)}`} footer="AI cost / practice minute" />
          <KpiCard label="Cost per learner" icon="user" tint={C.blue} value={`LKR ${fmt(derived.costPerUser)}`} footer="Total AI cost / learners" />
          <KpiCard label="Tokens used" icon="cpu" tint={C.violet} value={fmt(kpis.totalTokens)} footer={`${fmt(kpis.totalTokens / Math.max(kpis.totalSessions, 1))} per call`} />
          <KpiCard label="Paid conversion" icon="check-circle" tint={C.green} value={`${derived.activeRate.toFixed(1)}%`} footer={`${kpis.activeSubscriptions} of ${kpis.totalUsers} learners`} />
        </View>

        <View style={s.grid}>
          <Card title="Plans" subtitle="Tier distribution" icon="credit-card" tint={C.green} style={s.gridItem}>
            <BarList
              unit="users"
              items={data.plans.tiers.map((t) => ({ key: t.tier, label: t.label, count: t.count, percentage: t.percentage, color: t.color }))}
            />
          </Card>
          <Card title="Account retention" subtitle="Subscription status" icon="refresh-cw" tint={C.violet} style={s.gridItem}>
            <DonutBreakdown
              centerLabel="learners"
              centerValue={fmt(kpis.totalUsers)}
              unit="users"
              items={data.plans.statuses.map((st) => ({
                key: st.status,
                label: st.label,
                count: st.count,
                percentage: st.percentage,
                color: st.color,
              }))}
            />
          </Card>
        </View>
      </>
    );
  };

  /* --------------------------------- Render --------------------------------- */

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <View style={s.container}>
        <AdminSidebar activeRoute="/admin/dashboard" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <View style={s.main}>
          <AdminTopBar
            title="Analytics Dashboard"
            subtitle="Real learners only (test accounts excluded)"
            badgeText={kpis ? `${fmt(kpis.totalUsers)} learners` : undefined}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            rightElement={
              <Pressable
                onPress={fetchOverview}
                disabled={isLoading}
                style={({ hovered }: any) => [s.refreshBtn, hovered && { backgroundColor: '#ccfbf1' }, isLoading && { opacity: 0.6 }]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={C.teal} />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={14} color={C.teal} />
                    <Text style={s.refreshText}>{lastRefreshed ? `Updated ${lastRefreshed}` : 'Refresh'}</Text>
                  </>
                )}
              </Pressable>
            }
          />

          {/* Tab bar */}
          <View style={s.tabBar}>
            {([
              { key: 'overview', label: 'Overview', icon: 'grid' },
              { key: 'learners', label: 'Learners', icon: 'users' },
              { key: 'revenue', label: 'Cost & Plans', icon: 'credit-card' },
            ] as Array<{ key: TabKey; label: string; icon: string }>).map((t) => {
              const active = tab === t.key;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={[s.tab, active && s.tabActive]}>
                  <Feather name={t.icon as any} size={14} color={active ? C.teal : C.muted} />
                  <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scroll, isPhone && { padding: 14 }]} showsVerticalScrollIndicator={false}>
            {errorMessage ? (
              <View style={s.errorBanner}>
                <Feather name="alert-triangle" size={18} color={C.red} />
                <Text style={s.errorText}>{errorMessage}</Text>
                <Pressable onPress={fetchOverview} style={s.retryBtn}>
                  <Text style={s.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {isLoading && !data ? <Skeleton /> : null}

            {data ? (
              <View style={isLoading ? { opacity: 0.6 } : undefined}>
                {tab === 'overview' && renderOverview()}
                {tab === 'learners' && renderLearners()}
                {tab === 'revenue' && renderRevenue()}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*  Styles                                                                    */
/* -------------------------------------------------------------------------- */

const shadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.04,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  elevation: 1,
} as const;

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0f172a' },
  container: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  main: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingBottom: 64 },

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
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.teal },
  tabText: { ...fontStyle('inter', 'medium'), fontSize: 13, color: C.muted },
  tabTextActive: { ...fontStyle('inter', 'semiBold'), color: C.teal },

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
    marginBottom: 18,
  },
  errorText: { flex: 1, ...fontStyle('inter', 'medium'), fontSize: 13, color: '#991b1b' },
  retryBtn: { backgroundColor: C.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  retryText: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: '#fff' },

  skel: { backgroundColor: C.soft, borderRadius: 6 },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  kpiCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
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
  kpiMid: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, marginBottom: 10 },
  kpiValue: { ...fontStyle('outfit', 'bold'), fontSize: 28, color: C.text },
  kpiUnit: { ...fontStyle('inter', 'medium'), fontSize: 14, color: C.muted },
  kpiFooter: { ...fontStyle('inter', 'regular'), fontSize: 12, color: C.muted, marginTop: 6 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  deltaText: { ...fontStyle('inter', 'semiBold'), fontSize: 11.5 },
  deltaSuffix: { ...fontStyle('inter', 'regular'), fontSize: 11, color: C.faint },

  // Insights
  insightsWrap: { marginBottom: 18 },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  insightsTitle: { ...fontStyle('inter', 'bold'), fontSize: 12, letterSpacing: 0.6, color: C.muted, textTransform: 'uppercase' },
  insightCard: {
    width: 270,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  insightIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { ...fontStyle('inter', 'semiBold'), fontSize: 12.5, color: C.text, marginBottom: 2 },
  insightText: { ...fontStyle('inter', 'regular'), fontSize: 12, lineHeight: 17, color: C.muted },

  // Cards + grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  gridItem: { flexGrow: 1, flexBasis: 380, minWidth: 0 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    ...shadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  cardIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...fontStyle('outfit', 'bold'), fontSize: 16, color: C.text },
  cardSubtitle: { ...fontStyle('inter', 'regular'), fontSize: 12, color: C.muted, marginTop: 2 },
  countBadge: { backgroundColor: C.soft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: C.border },
  countBadgeText: { ...fontStyle('inter', 'semiBold'), fontSize: 11.5, color: '#475569' },

  // Controls
  controlsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  segment: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: 8, padding: 2 },
  segmentItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  segmentItemActive: { backgroundColor: '#fff', ...shadow },
  segmentText: { ...fontStyle('inter', 'medium'), fontSize: 12, color: C.muted },
  segmentTextActive: { ...fontStyle('inter', 'semiBold'), color: C.text },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  chipText: { ...fontStyle('inter', 'medium'), fontSize: 12, color: C.muted },

  // Trend
  tooltipBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  tooltipDate: { ...fontStyle('inter', 'semiBold'), fontSize: 12.5, color: C.text },
  tooltipVals: { flexDirection: 'row', gap: 16 },
  tooltipItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tooltipNum: { ...fontStyle('outfit', 'bold'), fontSize: 15, color: C.text },
  tooltipLbl: { ...fontStyle('inter', 'regular'), fontSize: 11.5, color: C.muted },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.soft },
  summaryItem: { flexGrow: 1, flexBasis: 110 },
  summaryLabel: { ...fontStyle('inter', 'regular'), fontSize: 11.5, color: C.muted },
  summaryValue: { ...fontStyle('outfit', 'bold'), fontSize: 16, color: C.text, marginTop: 2 },

  // Donut
  donutWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 20 },
  legendCol: { flexGrow: 1, flexBasis: 220, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 },
  legendRowActive: { backgroundColor: C.bg },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { ...fontStyle('inter', 'medium'), fontSize: 12.5, color: C.text },
  legendHint: { ...fontStyle('inter', 'regular'), fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 15 },
  legendCount: { ...fontStyle('inter', 'regular'), fontSize: 11.5, color: C.muted },
  legendPct: { ...fontStyle('outfit', 'bold'), fontSize: 13.5, minWidth: 40, textAlign: 'right' },

  // Bar list
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginBottom: 6 },
  sortBtnText: { ...fontStyle('inter', 'medium'), fontSize: 11, color: C.muted },
  barRow: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  barRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  barLabelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { ...fontStyle('inter', 'semiBold'), fontSize: 13, color: C.text, flexShrink: 1 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { ...fontStyle('inter', 'bold'), fontSize: 10 },
  barCount: { ...fontStyle('inter', 'regular'), fontSize: 11.5, color: C.muted },
  barPct: { ...fontStyle('outfit', 'bold'), fontSize: 14, minWidth: 42, textAlign: 'right' },
  barTrack: { height: 7, backgroundColor: C.soft, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barDesc: { ...fontStyle('inter', 'regular'), fontSize: 11.5, lineHeight: 16, color: C.muted, marginTop: 8 },

  // Commitment
  commitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  commitCard: {
    flexGrow: 1,
    flexBasis: 90,
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  commitLabel: { ...fontStyle('inter', 'semiBold'), fontSize: 12, color: C.teal },
  commitPct: { ...fontStyle('outfit', 'bold'), fontSize: 22, color: C.text, marginTop: 6 },
  commitCount: { ...fontStyle('inter', 'regular'), fontSize: 11, color: C.muted, marginTop: 2 },
  commitTop: { ...fontStyle('inter', 'bold'), fontSize: 10, color: C.teal, marginTop: 6 },
});