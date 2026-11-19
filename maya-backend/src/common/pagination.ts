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

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

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

/**
 * Always-on paging for admin lists: `page` (1-based, default 1) and `pageSize`
 * (default 10, max 100; `limit` is accepted as an alias for older clients).
 */
export function readPage(page?: unknown, pageSize?: unknown, limit?: unknown): PageRequest {
  const p = Math.floor(Number(page));
  const raw = pageSize !== undefined && pageSize !== null && pageSize !== '' ? pageSize : limit;
  const l = Math.floor(Number(raw));
  return {
    page: Number.isFinite(p) && p > 0 ? p : 1,
    pageSize: Number.isFinite(l) && l > 0 ? Math.min(l, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
  };
}

/** Clamps the page against `total` and returns the 0-based inclusive row range for `.range()`. */
export function pageWindow(req: PageRequest, total: number): { from: number; to: number; pagination: PaginationMeta } {
  const totalPages = Math.max(1, Math.ceil(total / req.pageSize));
  const page = Math.min(req.page, totalPages);
  const from = (page - 1) * req.pageSize;
  return { from, to: from + req.pageSize - 1, pagination: { page, pageSize: req.pageSize, total, totalPages } };
}
