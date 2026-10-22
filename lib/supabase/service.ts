import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — use only in trusted server code (API routes, lib/).
 * NEVER import this in any client component or expose to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Supabase's newer secret key is preferred. Keep the legacy environment
  // variable supported for projects that have not migrated yet.
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or Supabase server secret key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  const validSecretKey = key.startsWith('sb_secret_')
  const validLegacyServiceRoleKey = key.split('.').length === 3
    && !/your|replace|placeholder|example|xxxx/i.test(key)
  if (!validSecretKey && !validLegacyServiceRoleKey) {
    throw new Error(
      'The Supabase server key is not a valid secret key or legacy service_role JWT.'
    )
  }

  return createClient(url, key, {
    auth: {
      // Service role client should never persist sessions
      autoRefreshToken:  false,
      persistSession:    false,
      detectSessionInUrl: false,
    },
  })
}
