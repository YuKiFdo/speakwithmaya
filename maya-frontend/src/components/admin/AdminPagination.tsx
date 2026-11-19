import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontStyle } from '@/theme/fonts';

export const ADMIN_PAGE_SIZES = [10, 25, 50, 100] as const;
export const ADMIN_DEFAULT_PAGE_SIZE = 10;

/** Server pagination block returned by every paged admin endpoint. */
export interface AdminPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Props {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Plural noun shown in "Showing 1 to 10 of 42 <label>" */
  label?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
}

/**
 * Footer for server-paged admin lists: "Showing X to Y of Z", a per-page picker
 * (10 / 25 / 50 / 100) and Prev / numbered / Next buttons.
 */
export function AdminPagination({
  page,
  pageSize,
  total,
  totalPages,
  label = 'items',
  onPageChange,
  onPageSizeChange,
  disabled,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pages = Math.max(1, totalPages);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canPrev = !disabled && page > 1;
  const canNext = !disabled && page < pages;

  return (
    <View style={styles.paginationRow}>
      <View style={styles.paginationInfoCol}>
        <Text style={styles.paginationInfoText}>
          Showing <Text style={styles.paginationInfoBold}>{from}</Text> to{' '}
          <Text style={styles.paginationInfoBold}>{to}</Text> of{' '}
          <Text style={styles.paginationInfoBold}>{total}</Text> {label}
        </Text>

        <View style={styles.pageSizeContainer}>
          <Text style={styles.pageSizeLabel}>Per page:</Text>
          <Pressable
            onPress={() => setMenuOpen((o) => !o)}
            style={styles.pageSizeDropdownBtn}
            accessibilityRole="button"
            accessibilityLabel={`Rows per page: ${pageSize}`}
          >
            <Text style={styles.pageSizeDropdownText}>{pageSize}</Text>
            <Feather name="chevron-down" size={13} color="#64748b" />
          </Pressable>
          {menuOpen && (
            <View style={styles.pageSizePopover}>
              {ADMIN_PAGE_SIZES.map((sz) => (
                <Pressable
                  key={sz}
                  onPress={() => {
                    setMenuOpen(false);
                    if (sz !== pageSize) onPageSizeChange(sz);
                  }}
                  style={[styles.pageSizeOption, pageSize === sz && styles.pageSizeOptionActive]}
                >
                  <Text style={[styles.pageSizeOptionText, pageSize === sz && styles.pageSizeOptionTextActive]}>
                    {sz}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.pageNavControls}>
        <Pressable
          onPress={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          style={[styles.pageNavBtn, !canPrev && styles.pageNavBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
        >
          <Feather name="chevron-left" size={15} color={canPrev ? '#334155' : '#cbd5e1'} />
          <Text style={[styles.pageNavBtnText, !canPrev && styles.pageNavBtnTextDisabled]}>Prev</Text>
        </Pressable>

        <View style={styles.pageNumbersRow}>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const isGap = prev !== undefined && p - prev > 1;
              return (
                <React.Fragment key={p}>
                  {isGap && <Text style={styles.pageEllipsis}>...</Text>}
                  <Pressable
                    onPress={() => !disabled && p !== page && onPageChange(p)}
                    style={[styles.pageNumberBtn, page === p && styles.pageNumberBtnActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Page ${p}`}
                  >
                    <Text style={[styles.pageNumberText, page === p && styles.pageNumberTextActive]}>{p}</Text>
                  </Pressable>
                </React.Fragment>
              );
            })}
        </View>

        <Pressable
          onPress={() => canNext && onPageChange(page + 1)}
          disabled={!canNext}
          style={[styles.pageNavBtn, !canNext && styles.pageNavBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Next page"
        >
          <Text style={[styles.pageNavBtnText, !canNext && styles.pageNavBtnTextDisabled]}>Next</Text>
          <Feather name="chevron-right" size={15} color={canNext ? '#334155' : '#cbd5e1'} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
