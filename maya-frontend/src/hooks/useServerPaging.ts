import { useCallback, useEffect, useRef, useState } from 'react';
import { ADMIN_DEFAULT_PAGE_SIZE, type AdminPaginationMeta } from '@/components/admin/AdminPagination';

/**
 * Page / page-size state for a server-paged admin list. Resets to page 1 whenever
 * `resetKey` (filters, search, sort) changes, and keeps the server's clamped page.
 */
export function useServerPaging(resetKey: string, initialPageSize = ADMIN_DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [meta, setMeta] = useState<AdminPaginationMeta>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
    totalPages: 1,
  });
  const firstKey = useRef(true);

  useEffect(() => {
    if (firstKey.current) {
      firstKey.current = false;
      return;
    }
    setPage(1);
  }, [resetKey]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  /** Store the server's pagination block (adopting its clamped page). */
  const applyMeta = useCallback((m?: Partial<AdminPaginationMeta> | null) => {
    if (!m) return;
    setMeta((prev) => ({
      page: m.page ?? prev.page,
      pageSize: m.pageSize ?? prev.pageSize,
      total: m.total ?? 0,
      totalPages: Math.max(1, m.totalPages ?? 1),
    }));
    if (m.page && m.page > 0) setPage((p) => (p !== m.page ? m.page! : p));
  }, []);

  return { page, setPage, pageSize, setPageSize, meta, applyMeta };
}
