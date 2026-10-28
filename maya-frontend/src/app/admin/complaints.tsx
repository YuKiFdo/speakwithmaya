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
import { Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getBackendBaseUrl } from '@/hooks/useLiveCall';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminTableSkeleton } from '@/components/ui/skeleton';
import { mayaAlert } from '@/components/ui/alert-modal';
import type { AdminComplaintItem } from './users';

export default function AdminComplaintsScreen() {
  const { isPhone } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(!isPhone);

  const [complaints, setComplaints] = useState<AdminComplaintItem[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'open' | 'resolved'>('ALL');

  const fetchComplaints = async () => {
    setIsLoading(true);
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/v1/admin/complaints`);
      if (res.ok) {
        const data = await res.json();
        setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.warn('[AdminComplaints] Failed to load complaints:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

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

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.displayName || '').toLowerCase().includes(q);
        const matchPhone = (c.phoneNumber || '').toLowerCase().includes(q);
        const matchEmail = (c.email || '').toLowerCase().includes(q);
        const matchMsg = (c.message || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchEmail || matchMsg;
      }
      return true;
    });
  }, [complaints, statusFilter, searchQuery]);

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
            title="Student Complaints & Feedback"
            subtitle="Review and resolve issues or feedback submitted by students from the Account screen."
            badgeText={`${stats.open} open`}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            rightElement={
              <Pressable
                onPress={fetchComplaints}
                style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
              >
                <Feather name="refresh-cw" size={14} color="#0d9488" />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
            }
          />

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollBodyContent}>
            {/* KPI Summary Cards */}
            <View style={styles.metricCardsGrid}>
              <View style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Feather name="message-square" size={18} color="#0d9488" />
                </View>
                <View>
                  <Text style={styles.metricLabel}>Total Submissions</Text>
                  <Text style={styles.metricValue}>{stats.total}</Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#fef2f2' }]}>
                  <Feather name="alert-circle" size={18} color="#dc2626" />
                </View>
                <View>
                  <Text style={styles.metricLabel}>Open Issues</Text>
                  <Text style={[styles.metricValue, { color: '#dc2626' }]}>{stats.open}</Text>
                </View>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#f0fdf4' }]}>
                  <Feather name="check-circle" size={18} color="#16a34a" />
                </View>
                <View>
                  <Text style={styles.metricLabel}>Resolved</Text>
                  <Text style={[styles.metricValue, { color: '#16a34a' }]}>{stats.resolved}</Text>
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
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Feather name="x-circle" size={16} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              <View style={styles.statusFilterGroup}>
                {(['ALL', 'open', 'resolved'] as const).map((st) => (
                  <Pressable
                    key={st}
                    onPress={() => setStatusFilter(st)}
                    style={[styles.filterPill, statusFilter === st && styles.filterPillActive]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        statusFilter === st && styles.filterPillTextActive,
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

              {isLoading ? (
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
                    <Text style={[styles.tableColHeader, { flex: 2.8 }]}>COMPLAINT / FEEDBACK MESSAGE</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.1 }]}>SUBMITTED</Text>
                    <Text style={[styles.tableColHeader, { flex: 0.9 }]}>STATUS</Text>
                    <Text style={[styles.tableColHeader, { flex: 1.2, textAlign: 'right' }]}>ACTIONS</Text>
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
                            <Text style={isResolved ? styles.reopenBtnText : styles.resolveBtnText}>
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
  metricCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
  statusFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  messageText: {
    ...fontStyle('inter', 'regular'),
    fontSize: 13,
    lineHeight: 19,
    color: '#1e293b',
  },
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
});
