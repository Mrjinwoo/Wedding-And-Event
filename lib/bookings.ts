import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

let missingExpiryRpcWarned = false

/** Add public profile details without relying on a bookings.user_id FK to profiles. */
export async function attachUserProfiles<T extends { user_id?: string | null }>(
  supabase: SupabaseClient,
  bookings: T[] | null | undefined,
) {
  const rows = bookings ?? []
  const userIds = [...new Set(rows.map(booking => booking.user_id).filter((id): id is string => Boolean(id)))]
  if (!userIds.length) return rows.map(booking => ({ ...booking, profiles: null }))

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds)

  if (error) console.error('[bookings] Could not load booking profile details:', error.message)
  const profiles = new Map((data ?? []).map(profile => [profile.id, profile]))
  return rows.map(booking => ({
    ...booking,
    profiles: booking.user_id ? profiles.get(booking.user_id) ?? null : null,
  }))
}

/** Expire approved bookings whose 48-hour payment hold has elapsed. */
export async function expireOverdueBookings() {
  try {
    // The database function performs only this fixed expiry operation and
    // inserts matching notifications. It runs with the caller's session, so
    // this flow does not depend on the service role key.
    const supabase = await createClient()
    const { error } = await supabase.rpc('expire_overdue_bookings')

    if (error?.code === 'PGRST202') {
      if (!missingExpiryRpcWarned) {
        console.warn('[bookings] Expiry function is not installed in Supabase. Apply supabase/migrations/202610230003_expire_overdue_bookings_rpc.sql and reload the PostgREST schema.')
        missingExpiryRpcWarned = true
      }
    } else if (error) {
      console.error('[bookings] Failed to expire overdue bookings:', error.message)
    }
  } catch (error) {
    console.error('[bookings] Failed to expire overdue bookings:', error)
  }
}
