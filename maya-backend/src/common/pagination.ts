/**
 * Optional, backward-compatible list pagination for admin endpoints.
 *
 * When the request has no `page`, callers return their full list exactly as before.
 * When `page` is present, callers return one slice plus a `pagination` block with the
 * same shape the admin users endpoint already uses:
 *   { page, pageSize, total, totalPages }
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageRequest {
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

/** Parses `page` / `limit` query values. Returns null when no `page` was requested. */
export function parsePageRequest(page?: unknown, limit?: unknown, defaultSize = DEFAULT_PAGE_SIZE): PageRequest | null {
  if (page === undefined || page === null || page === '') return null;
  const p = Math.floor(Number(page));
  const l = Math.floor(Number(limit));
  return {
    page: Number.isFinite(p) && p > 0 ? p : 1,
    pageSize: Number.isFinite(l) && l > 0 ? Math.min(l, MAX_PAGE_SIZE) : defaultSize,
  };
}

/** Slices `items` for the request; an out-of-range page is clamped to the last page. */
export function paginateArray<T>(items: T[], req: PageRequest): { items: T[]; pagination: PaginationMeta } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / req.pageSize));
  const page = Math.min(req.page, totalPages);
  const start = (page - 1) * req.pageSize;
  return {
    items: items.slice(start, start + req.pageSize),
    pagination: { page, pageSize: req.pageSize, total, totalPages },
  };
}
