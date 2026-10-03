import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';
import { useBreakpoint } from '@/hooks/useBreakpoint';

interface AdminTopBarProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  rightElement?: React.ReactNode;
}

export function AdminTopBar({
  title,
  subtitle,
  badgeText,
  sidebarOpen,
  onToggleSidebar,
  rightElement,
}: AdminTopBarProps) {
  const { isPhone } = useBreakpoint();

  return (
    <View style={styles.topHeaderBar}>
      <View style={styles.topHeaderLeft}>
        <Pressable onPress={onToggleSidebar} style={styles.sidebarToggleBtn}>
          <Feather name="menu" size={20} color="#334155" />
        </Pressable>
        <View style={styles.titleContainer}>
          <View style={styles.badgeRow}>
            <Text style={styles.headerTitle}>{title}</Text>
            {badgeText ? (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>{badgeText}</Text>
              </View>
            ) : null}
          </View>
          {subtitle && !isPhone ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {rightElement ? <View style={styles.topHeaderRight}>{rightElement}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 64,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sidebarToggleBtn: {
    padding: 6,
    marginRight: 14,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  titleContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  headerTitle: {
    ...fontStyle('inter', 'bold'),
    fontSize: 18,
    color: '#0f172a',
  },
  activePill: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activePillText: {
    ...fontStyle('inter', 'semiBold'),
    fontSize: 11,
    color: '#0d9488',
  },
  headerSubtitle: {
    ...fontStyle('inter', 'regular'),
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
