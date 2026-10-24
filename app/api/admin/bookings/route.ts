import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity, logAudit } from '@/lib/activity'
import { requireStaff, requireAdmin } from '@/lib/supabase/requireUser'
import { attachUserProfiles, expireOverdueBookings } from '@/lib/bookings'

// Permission matrix:
//   GET    — active staff + admin
//   PATCH  — active staff + admin for booking workflow actions
//   DELETE — admin only

export async function GET(req: NextRequest) {
  const auth = await requireStaff(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  await expireOverdueBookings()
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''
  const search = searchParams.get('search') ?? ''
  const page   = parseInt(searchParams.get('page')  ?? '1')
  const limit  = parseInt(searchParams.get('limit') ?? '10')
  const from   = (page - 1) * limit

  let query = supabase
    .from('bookings')
    .select('*, venues:venue_id(name, location), packages:package_id(name)', { count: 'exact' })
    .range(from, from + limit - 1)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (search) query = query.ilike('event_type', `%${search}%`)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const dataWithProfiles = await attachUserProfiles(supabase, data)
  return NextResponse.json({
    data: dataWithProfiles,
    total: count,
    page,
    limit,
    canManageBookings: auth.profile.role === 'admin' || auth.profile.role === 'staff',
    canDeleteBookings: auth.profile.role === 'admin',
  })
}

export async function PATCH(req: NextRequest) {
  // Staff and admins handle routine booking review without an MFA gate.
  const roleAuth = await requireStaff(req)
  if ('error' in roleAuth) return NextResponse.json({ error: roleAuth.error }, { status: roleAuth.status })

  const supabase = await createClient()
  const { bookingId, status, paymentDecision } = await req.json()
  await expireOverdueBookings()

  if (paymentDecision === 'approve' || paymentDecision === 'reject') {
    if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })
    const { error } = await supabase.rpc('review_booking_payment_proof', {
      p_booking_id: bookingId,
      p_approved: paymentDecision === 'approve',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ message: paymentDecision === 'approve' ? 'Payment verified and booking confirmed.' : 'Payment proof rejected.' })
  }

  const VALID = ['awaiting_payment', 'confirmed', 'cancelled', 'completed'] as const
  if (!bookingId || !VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid bookingId or status' }, { status: 400 })
  }

  const { data: previousStatus, error } = await supabase.rpc('update_booking_status_by_staff', {
    p_booking_id: bookingId,
    p_new_status: status,
  })
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'That venue date has another active hold or confirmed booking.' }, { status: 409 })
  }

  if (error) {
    const statusCode = error.message.includes('Booking not found') ? 404
      : error.message.includes('Cannot transition') ? 422
      : 400
    return NextResponse.json({ error: error.message }, { status: statusCode })
  }

  const { error: notificationError } = await supabase.rpc('notify_booking_status', { p_booking_id: bookingId })
  if (notificationError) console.error('[admin/bookings] Failed to notify customer:', notificationError.message)

  await Promise.all([
    logActivity({ userId: roleAuth.user.id, action: 'STAFF_UPDATE_BOOKING', entity: 'bookings', entityId: bookingId, details: { status } }),
    logAudit({ performedBy: roleAuth.user.id, action: 'UPDATE_BOOKING_STATUS', targetTable: 'bookings', targetId: bookingId, oldData: { status: previousStatus }, newData: { status } }),
  ])

  return NextResponse.json({ message: 'Booking updated' })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  const bookingId = new URL(req.url).searchParams.get('bookingId')
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const { data: current } = await supabase
    .from('bookings').select('status').eq('id', bookingId).single()

  const { error } = await supabase.from('bookings').delete().eq('id', bookingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    logActivity({ userId: auth.user.id, action: 'ADMIN_DELETE_BOOKING', entity: 'bookings', entityId: bookingId }),
    logAudit({ performedBy: auth.user.id, action: 'DELETE_BOOKING', targetTable: 'bookings', targetId: bookingId, oldData: current ?? undefined }),
  ])

  return NextResponse.json({ message: 'Booking deleted' })
}
