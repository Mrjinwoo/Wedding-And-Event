import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity, logAudit } from '@/lib/activity'
import { requireAdmin } from '@/lib/supabase/requireUser'
import { createServiceClient } from '@/lib/supabase/service'

// User and role management — admin only, AAL2 required for all methods.
//
// Self-protection rules (enforced in PATCH and DELETE):
//   • An admin cannot change their own role (would lock them out or self-demote)
//   • An admin cannot deactivate their own account
//   These are enforced in application code here AND in the DB trigger
//   (prevent_role_self_change) as a second layer.

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const role   = searchParams.get('role')   ?? ''
  const page   = parseInt(searchParams.get('page')  ?? '1')
  const limit  = parseInt(searchParams.get('limit') ?? '10')
  const from   = (page - 1) * limit

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .range(from, from + limit - 1)
    .order('created_at', { ascending: false })

  if (search) query = query.ilike('full_name', `%${search}%`)
  if (role)   query = query.eq('role', role)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: count, page, limit })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: { fullName?: unknown; email?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Enter the staff member’s name and email.' }, { status: 400 })
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (fullName.length < 2 || fullName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const origin = new URL(req.url).origin
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role: 'staff' },
      redirectTo: `${origin}/auth/callback?next=/set-password`,
    })
    if (error || !data.user) {
      console.error('[admin/users] Staff invitation failed:', error?.message)
      const message = error?.message.toLowerCase() ?? ''
      if (message.includes('already') || message.includes('registered')) {
        return NextResponse.json({ error: 'An account already exists for this email. Find it in the user list and change its role to staff.' }, { status: 409 })
      }
      if (message.includes('invalid api key') || message.includes('service role')) {
        return NextResponse.json({ error: 'Supabase rejected the server key. Set SUPABASE_SECRET_KEY to this project’s sb_secret_ key, or set SUPABASE_SERVICE_ROLE_KEY to its legacy service_role key, then restart the app.' }, { status: 503 })
      }
      return NextResponse.json({ error: 'Could not send the staff invitation. Check Supabase Auth email delivery settings and try again.' }, { status: 502 })
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      full_name: fullName,
      role: 'staff',
      is_active: true,
    }, { onConflict: 'id' })
    if (profileError) {
      console.error('[admin/users] Failed to set invited profile role:', profileError.message)
      return NextResponse.json({ error: 'The invitation was sent, but the staff role could not be saved. Check the profiles table and retry the role change.' }, { status: 500 })
    }

    await logActivity({
      userId: auth.user.id,
      action: 'ADMIN_INVITE_STAFF',
      entity: 'profiles',
      entityId: data.user.id,
      details: { email, role: 'staff' },
    }).catch(() => null)

    return NextResponse.json({ message: `Staff invitation sent to ${email}.` }, { status: 201 })
  } catch (error) {
    console.error('[admin/users] Staff invitation setup failed:', error)
    return NextResponse.json({ error: 'Staff invitations need a valid Supabase server key. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the app.' }, { status: 503 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const { userId, role, isActive } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // ── Self-protection: admins cannot change their own role or deactivate themselves ──
  if (userId === auth.user.id) {
    if (role !== undefined) {
      return NextResponse.json(
        { error: 'You cannot change your own role.' },
        { status: 422 }
      )
    }
    if (isActive === false) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account.' },
        { status: 422 }
      )
    }
  }

  // ── Validate role value if provided ──────────────────────────────────────────
  const VALID_ROLES = ['user', 'client', 'staff', 'admin']
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role '${role}'` }, { status: 400 })
  }

  // ── Fetch current state for audit log ────────────────────────────────────────
  const { data: current } = await supabase
    .from('profiles')
    .select('role, is_active, full_name')
    .eq('id', userId)
    .single()

  if (!current) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (role     !== undefined) updates.role      = role
  if (isActive !== undefined) updates.is_active = isActive

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    logActivity({
      userId:   auth.user.id,
      action:   'ADMIN_UPDATE_USER',
      entity:   'profiles',
      entityId: userId,
      details:  updates,
    }),
    logAudit({
      performedBy:  auth.user.id,
      action:       'UPDATE_USER',
      targetTable:  'profiles',
      targetId:     userId,
      oldData:      { role: current.role, is_active: current.is_active },
      newData:      updates,
    }),
  ])

  return NextResponse.json({ message: 'User updated' })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // ── Self-protection: admins cannot deactivate themselves ──────────────────────
  if (userId === auth.user.id) {
    return NextResponse.json(
      { error: 'You cannot deactivate your own account.' },
      { status: 422 }
    )
  }

  // ── Fetch current state for audit log ────────────────────────────────────────
  const { data: current } = await supabase
    .from('profiles')
    .select('role, is_active, full_name')
    .eq('id', userId)
    .single()

  if (!current) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    logActivity({
      userId:   auth.user.id,
      action:   'ADMIN_DEACTIVATE_USER',
      entity:   'profiles',
      entityId: userId,
    }),
    logAudit({
      performedBy: auth.user.id,
      action:      'DEACTIVATE_USER',
      targetTable: 'profiles',
      targetId:    userId,
      oldData:     { role: current.role, is_active: current.is_active, full_name: current.full_name },
      newData:     { is_active: false },
    }),
  ])

  return NextResponse.json({ message: 'User deactivated' })
}
