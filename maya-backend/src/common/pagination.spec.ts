import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, pageWindow, paginateArray, readPage } from './pagination.js';

describe('readPage', () => {
  it('defaults to page 1 and 10 rows', () => {
    expect(readPage()).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });

  it('reads page and pageSize from query strings', () => {
    expect(readPage('3', '25')).toEqual({ page: 3, pageSize: 25 });
  });

  it('accepts the legacy `limit` alias when pageSize is absent', () => {
    expect(readPage('2', undefined, '50')).toEqual({ page: 2, pageSize: 50 });
    expect(readPage('2', '', '50')).toEqual({ page: 2, pageSize: 50 });
    expect(readPage('2', '20', '50')).toEqual({ page: 2, pageSize: 20 });
  });

  it('caps pageSize and rejects invalid values', () => {
    expect(readPage('1', '5000').pageSize).toBe(MAX_PAGE_SIZE);
    expect(readPage('-4', 'abc')).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
    expect(readPage('0', '0')).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
    expect(readPage('2.9', '10.7')).toEqual({ page: 2, pageSize: 10 });
  });
});

describe('pageWindow', () => {
  it('returns the inclusive row range for the page', () => {
    expect(pageWindow({ page: 2, pageSize: 10 }, 35)).toEqual({
      from: 10,
      to: 19,
      pagination: { page: 2, pageSize: 10, total: 35, totalPages: 4 },
    });
  });

  it('clamps a page past the end to the last page', () => {
    const w = pageWindow({ page: 9, pageSize: 10 }, 35);
    expect(w.pagination.page).toBe(4);
    expect(w.from).toBe(30);
  });

  it('reports one empty page when there are no rows', () => {
    expect(pageWindow({ page: 3, pageSize: 10 }, 0)).toEqual({
      from: 0,
      to: 9,
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
    });
  });
});

describe('paginateArray', () => {
  it('slices the requested page', () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    const r = paginateArray(items, { page: 3, pageSize: 10 });
    expect(r.items).toEqual([20, 21, 22]);
    expect(r.pagination).toEqual({ page: 3, pageSize: 10, total: 23, totalPages: 3 });
  });
});
