import { createServiceClient } from '@/lib/supabase/service'

// Both functions use the service role client so they bypass RLS.
// activity_logs and audit_log have NO authenticated-user insert policies —
// they are written only from server code via the service role key.

// ── logActivity ───────────────────────────────────────────────────────────────
// Writes to activity_logs (user-visible history). Non-blocking.
export async function logActivity({
  userId,
  action,
  entity,
  entityId,
  details,
}: {
  userId:    string | null
  action:    string
  entity?:   string
  entityId?: string
  details?:  Record<string, unknown>
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from('activity_logs').insert({
      user_id:   userId,
      action,
      entity,
      entity_id: entityId,
      details,
    })
  } catch (err) {
    console.error('[activity] logActivity error:', err)
  }
}

// ── logAudit ──────────────────────────────────────────────────────────────────
// Writes to audit_log (immutable admin audit trail). Non-blocking.
export async function logAudit({
  performedBy,
  action,
  targetTable,
  targetId,
  oldData,
  newData,
  ipAddress,
}: {
  performedBy:  string
  action:       string
  targetTable?: string
  targetId?:    string
  oldData?:     Record<string, unknown>
  newData?:     Record<string, unknown>
  ipAddress?:   string
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from('audit_log').insert({
      performed_by:  performedBy,
      action,
      target_table:  targetTable,
      target_id:     targetId  ?? null,
      old_data:      oldData   ?? null,
      new_data:      newData   ?? null,
      ip_address:    ipAddress ?? null,
    })
  } catch (err) {
    console.error('[activity] logAudit error:', err)
  }
}
