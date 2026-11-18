/**
 * True when a Supabase/PostgREST error means "this SQL function does not exist yet"
 * (the migration that creates it has not been applied). Callers then fall back to the old
 * query path instead of failing the request.
 */
export function isMissingFunctionError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const text = `${err.code || ''} ${err.message || ''}`;
  return /PGRST202|42883|could not find the function|function .* does not exist/i.test(text);
}
