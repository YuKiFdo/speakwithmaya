import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export interface AdminNavItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
}

export interface AdminNavGroup {
  group: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
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

interface AdminSidebarProps {
  activeRoute: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ activeRoute, isOpen, onClose }: AdminSidebarProps) {
  const { isPhone } = useBreakpoint();

  if (!isOpen) return null;

  const handleNav = (route: string) => {
    if (activeRoute === route) return;
    router.replace(route as any);
    if (isPhone) {
      onClose();
    }
  };

  return (
    <View style={[styles.sidebar, isPhone && styles.sidebarMobile]}>
      {/* Brand Header */}
      <View style={styles.sidebarLogoRow}>
        <View style={styles.logoBadge}>
          <Ionicons name="mic" size={18} color="#ffffff" />
        </View>
        <View style={styles.logoTextCol}>
          <Text style={styles.brandTitle}>SpeakMaya</Text>
          <Text style={styles.brandSubtitle}>AI English Coach</Text>
        </View>
        {isPhone && (
          <Pressable onPress={onClose} style={styles.closeSidebarBtn}>
            <Feather name="x" size={20} color="#64748b" />
          </Pressable>
        )}
      </View>

      {/* Nav List */}
      <ScrollView style={styles.sidebarNavScroll} showsVerticalScrollIndicator={false}>
        {ADMIN_NAV_GROUPS.map((grp) => (
          <View key={grp.group} style={styles.navGroup}>
            <Text style={styles.navGroupTitle}>{grp.group}</Text>
            {grp.items.map((item) => {
              const isActive = activeRoute === item.route;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleNav(item.route)}
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

      {/* Footer Profile */}
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
          <Feather name="log-out" size={14} color="#ef4444" style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Back to App</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    flexDirection: 'column',
    height: '100%',
  },
  sidebarMobile: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoTextCol: {
    flex: 1,
  },
  brandTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 15,
    color: '#0f172a',
  },
  brandSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  closeSidebarBtn: {
    padding: 4,
  },
  sidebarNavScroll: {
    flex: 1,
    paddingTop: 12,
  },
  navGroup: {
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  navGroupTitle: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 10.5,
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: '#f0fdfa',
  },
  navItemIcon: {
    marginRight: 10,
  },
  navItemText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 13,
    color: '#475569',
  },
  navItemTextActive: {
    color: '#0d9488',
    ...fontStyle('inter', 'semiBold'),
  },
  sidebarFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 10,
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userAvatarText: {
    ...fontStyle('inter', 'bold'),
    fontSize: 12,
    color: '#ffffff',
  },
  userProfileTextCol: {
    flex: 1,
  },
  userName: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 12.5,
    color: '#0f172a',
  },
  userEmail: {
    ...fontStyle('inter', 'regular'),
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    alignSelf: 'flex-start',
  },
  logoutText: {
    ...fontStyle('inter', 'medium'),
    fontSize: 11.5,
    color: '#ef4444',
  },
});
