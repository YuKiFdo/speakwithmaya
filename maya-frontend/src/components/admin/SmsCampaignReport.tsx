import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { getBackendBaseUrl } from '@/utils/backend-url';

interface Campaign {
  id: string;
  name: string;
  message: string;
  linkUrl: string;
  audience: string;
  recipients: number;
  sent: number;
  failed: number;
  createdAt: string;
  uniqueClicks: number;
  totalClicks: number;
  practisedAfterClick: number;
  clickRate: number;
}

interface Recipient {
  userId: string | null;
  name: string | null;
  phone: string | null;
  sentOk: boolean | null;
  clicks: number;
  firstClickedAt: string | null;
  practisedAfterClick: boolean;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

/**
 * Click report for SMS broadcasts sent with a tracked link: per campaign sent, unique
 * clicks, click rate and how many clickers started a practice session afterwards;
 * expand a campaign to see each recipient.
 */
export function SmsCampaignReport({ authHeaders, refreshKey }: { authHeaders: () => Record<string, string>; refreshKey: number }) {
  const [loading, setLoading] = useState(true);
  const [migrationApplied, setMigrationApplied] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/sms-campaigns`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Could not load campaigns');
      setMigrationApplied(data.migrationApplied !== false);
      setCampaigns(data.campaigns || []);
    } catch (e: any) {
      setError(e?.message || 'Could not load campaigns');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const toggle = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setRecipients(null);
    try {
      const res = await fetch(`${getBackendBaseUrl()}/v1/admin/sms-campaigns/${id}`, { headers: authHeaders() });
      const data = await res.json();
      setRecipients(res.ok ? data.recipients || [] : []);
    } catch {
      setRecipients([]);
    }
  };

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.headerIcon}>
          <Feather name="bar-chart-2" size={16} color="#0d9488" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>3. Link Click Report</Text>
          <Text style={s.subtitle}>Broadcasts sent with a tracked link: who clicked and who came back to practise.</Text>
        </View>
        <Pressable onPress={load} style={({ pressed }) => [s.refreshBtn, pressed && { opacity: 0.7 }]}>
          <Feather name="refresh-cw" size={14} color="#0d9488" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#0d9488" style={{ marginVertical: 18 }} />
      ) : !migrationApplied ? (
        <Text style={s.notice}>
          Click tracking needs database migration 024 (sms_campaign_click_tracking.sql). Links are still sent, but clicks
          are not recorded until it is applied.
        </Text>
      ) : error ? (
        <Text style={[s.notice, { color: '#B91C1C' }]}>{error}</Text>
      ) : campaigns.length === 0 ? (
        <Text style={s.notice}>No tracked broadcasts yet. Add a link to an SMS broadcast to start tracking clicks.</Text>
      ) : (
        campaigns.map((c) => (
          <View key={c.id} style={s.campaign}>
            <Pressable onPress={() => toggle(c.id)} style={({ pressed }) => [s.campaignHead, pressed && { opacity: 0.85 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.campaignName} numberOfLines={1}>{c.name}</Text>
                <Text style={s.campaignMeta} numberOfLines={1}>
                  {fmtDate(c.createdAt)} · {c.audience} · {c.linkUrl}
                </Text>
              </View>
              <Feather name={openId === c.id ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
            </Pressable>
            <View style={s.statsRow}>
              <Stat label="Sent" value={`${c.sent}`} />
              <Stat label="Clicked" value={`${c.uniqueClicks}`} accent />
              <Stat label="Click rate" value={`${c.clickRate}%`} />
              <Stat label="Practised after" value={`${c.practisedAfterClick}`} accent />
              <Stat label="Total opens" value={`${c.totalClicks}`} />
            </View>
            {openId === c.id && (
              <View style={s.recipients}>
                {recipients === null ? (
                  <ActivityIndicator color="#0d9488" style={{ marginVertical: 10 }} />
                ) : recipients.length === 0 ? (
                  <Text style={s.notice}>No recipients recorded.</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
                    {recipients.map((r, i) => (
                      <View key={`${r.userId || r.phone}-${i}`} style={s.recipientRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.recipientName} numberOfLines={1}>{r.name || 'Unknown user'}</Text>
                          <Text style={s.recipientPhone}>{r.phone}{r.sentOk === false ? ' · not delivered' : ''}</Text>
                        </View>
                        <Text style={[s.pill, r.clicks > 0 ? s.pillOn : s.pillOff]}>
                          {r.clicks > 0 ? `Clicked ${fmtDate(r.firstClickedAt)}` : 'Not clicked'}
                        </Text>
                        {r.practisedAfterClick && <Text style={[s.pill, s.pillPractised]}>Practised</Text>}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, accent && { color: '#0d9488' }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...fontStyle('outfit', 'bold'), fontSize: 16, color: '#0F172A' },
  subtitle: { ...fontStyle('inter', 'regular'), fontSize: 12.5, color: '#64748B', marginTop: 2 },
  refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: '#F0FDFA' },
  notice: { ...fontStyle('inter', 'regular'), fontSize: 13, color: '#64748B', paddingVertical: 8 },
  campaign: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  campaignHead: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, backgroundColor: '#F8FAFC' },
  campaignName: { ...fontStyle('inter', 'semiBold'), fontSize: 14, color: '#0F172A' },
  campaignMeta: { ...fontStyle('inter', 'regular'), fontSize: 11.5, color: '#64748B', marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingVertical: 10, gap: 4 },
  stat: { minWidth: 92, flexGrow: 1, paddingHorizontal: 6, paddingVertical: 4 },
  statValue: { ...fontStyle('outfit', 'bold'), fontSize: 18, color: '#0F172A' },
  statLabel: { ...fontStyle('inter', 'regular'), fontSize: 11, color: '#64748B' },
  recipients: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6 },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  recipientName: { ...fontStyle('inter', 'semiBold'), fontSize: 13, color: '#0F172A' },
  recipientPhone: { ...fontStyle('inter', 'regular'), fontSize: 11.5, color: '#64748B' },
  pill: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pillOn: { backgroundColor: '#CCFBF1', color: '#0F766E' },
  pillOff: { backgroundColor: '#F1F5F9', color: '#64748B' },
  pillPractised: { backgroundColor: '#DCFCE7', color: '#15803D' },
});
