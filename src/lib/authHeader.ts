/**
 * Attaches the current Supabase access token to AI-costing API calls, so
 * server.js can identify the caller for the per-user free/paid quota.
 */
import { supabase } from './supabaseClient';

export async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Friendly copy for the two quota-gate response shapes, shared across call sites. */
export function quotaErrorMessage(errorCode: string | undefined): string | null {
  if (errorCode === 'auth_required') return 'Please log in to use this AI feature.';
  if (errorCode === 'quota_exceeded') return "You've used today's free AI credits. Upgrade or come back tomorrow.";
  return null;
}
