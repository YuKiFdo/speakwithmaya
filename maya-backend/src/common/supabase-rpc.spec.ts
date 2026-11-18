import { describe, expect, it } from 'vitest';
import { isMissingFunctionError } from './supabase-rpc.js';

describe('isMissingFunctionError', () => {
  it('detects PostgREST "function not found" errors', () => {
    expect(isMissingFunctionError({ code: 'PGRST202', message: 'Could not find the function public.admin_user_activity_stats without parameters in the schema cache' })).toBe(true);
    expect(isMissingFunctionError({ code: '42883', message: 'function public.admin_session_counts(uuid[]) does not exist' })).toBe(true);
  });

  it('ignores other errors and empty input', () => {
    expect(isMissingFunctionError(null)).toBe(false);
    expect(isMissingFunctionError(undefined)).toBe(false);
    expect(isMissingFunctionError({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false);
    expect(isMissingFunctionError({ message: 'permission denied for function admin_user_activity_stats' })).toBe(false);
  });
});
