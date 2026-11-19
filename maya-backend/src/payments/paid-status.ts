import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * True when the learner currently pays for a plan through PayHere (subscription row ACTIVE).
 * Subscriptions are stored as 'ACTIVE'; older rows may be lowercase, so both are accepted.
 * Such a learner must never be treated as an ending Pro Pass trial.
 */
export async function hasActivePaidSubscription(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['ACTIVE', 'active'])
    .limit(1);
  if (error) {
    // Fail safe: if we cannot tell, assume paying so nobody is downgraded by mistake
    return true;
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Status a learner gets when their Pro Pass ends and they go back to Starter.
 * Telco subscribers keep 'active' (their telco Starter subscription continues);
 * everyone else gets 'expired', which drives the one-time "Pro Pass ended" upgrade prompt.
 */
export function trialEndStatus(profile: {
  telco_subscriber_id?: string | null;
  plan_status?: string | null;
}): 'active' | 'expired' {
  return profile.telco_subscriber_id ? 'active' : 'expired';
}
