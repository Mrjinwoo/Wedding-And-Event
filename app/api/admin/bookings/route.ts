import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity, logAudit } from '@/lib/activity'
import { requireStaff, requireAdmin } from '@/lib/supabase/requireUser'
import { attachUserProfiles, expireOverdueBookings } from '@/lib/bookings'

// Permission matrix:
//   GET    — staff + admin, AAL2
//   PATCH  — admin only,    AAL2
//   DELETE — admin only,    AAL2

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
  return NextResponse.json({ data: dataWithProfiles, total: count, page, limit })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

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

  // Approval requests a deposit; confirmation is allowed only after manual verification.
  const { data: current } = await supabase
    .from('bookings').select('status, total_amount, user_id, event_type, venue_id, event_date').eq('id', bookingId).single()
  if (!current) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })

  const TRANSITIONS: Record<string, string[]> = {
    pending:   ['awaiting_payment', 'cancelled'],
    awaiting_payment: ['confirmed', 'cancelled'],
    confirmed: ['completed', 'cancelled'],
  }
  const allowed = TRANSITIONS[current.status] ?? []
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot transition from '${current?.status}' to '${status}'` },
      { status: 422 }
    )
  }

  const now = new Date()
  const updates: Record<string, string | number | null> = {
    status,
    updated_at: now.toISOString(),
  }
  if (status === 'awaiting_payment') {
    updates.deposit_amount = Math.round(Number(current.total_amount) * 0.3 * 100) / 100
    updates.payment_deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
    updates.payment_instructions = 'Call +63 975 940 3511 or use the Contact page to arrange payment. Include your event date and booking details so the venue can verify your downpayment.'
    updates.deposit_paid_at = null
  }
  if (status === 'confirmed') updates.deposit_paid_at = now.toISOString()

  const { data: updated, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)
    .eq('status', current.status)
    .select('id')
    .maybeSingle()
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'That venue date has another active hold or confirmed booking.' }, { status: 409 })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'This booking changed while you were reviewing it. Reload and try again.' }, { status: 409 })

  const { error: notificationError } = await supabase.rpc('notify_booking_status', { p_booking_id: bookingId })
  if (notificationError) console.error('[admin/bookings] Failed to notify customer:', notificationError.message)

  await Promise.all([
    logActivity({ userId: auth.user.id, action: 'ADMIN_UPDATE_BOOKING', entity: 'bookings', entityId: bookingId, details: { status } }),
    logAudit({ performedBy: auth.user.id, action: 'UPDATE_BOOKING_STATUS', targetTable: 'bookings', targetId: bookingId, oldData: { status: current?.status }, newData: { status } }),
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
