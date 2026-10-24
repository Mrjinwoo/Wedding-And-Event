import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bookingSchema } from '@/lib/validation'
import { logActivity } from '@/lib/activity'
import { requireUser } from '@/lib/supabase/requireUser'
import { expireOverdueBookings } from '@/lib/bookings'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/bookings — user's own bookings
export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  await expireOverdueBookings()

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''

  let query = supabase
    .from('bookings')
    .select(`*, venues:venue_id ( name, location, image_url, price ), packages:package_id(name)`)
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

// POST /api/bookings — create booking
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()
  await expireOverdueBookings()
  const body = await req.json()
  const parsed = bookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { venueId, packageId, eventType, eventDate, guestCount, notes } = parsed.data

  const { data: venue } = await supabase
    .from('venues').select('price, capacity, is_active, review_status').eq('id', venueId).single()

  if (!venue?.is_active || venue.review_status !== 'approved') {
    return NextResponse.json({ error: 'Venue is not available' }, { status: 400 })
  }

  let packagePrice: number | null = null
  let packageCapacity: number | null = null
  if (packageId) {
    const { data: selectedPackage, error: packageError } = await supabase
      .from('packages')
      .select('id, price, guest_capacity, is_active')
      .eq('id', packageId)
      .single()

    if (packageError || !selectedPackage?.is_active) {
      return NextResponse.json({ error: 'That package is no longer available. Please choose another package.' }, { status: 400 })
    }
    packagePrice = Number(selectedPackage.price)
    packageCapacity = selectedPackage.guest_capacity
  }

  const guestLimit = Math.min(venue.capacity, packageCapacity ?? venue.capacity)
  if (guestCount > guestLimit) {
    return NextResponse.json({ error: `This selection can accommodate up to ${guestLimit} guests.` }, { status: 400 })
  }

  if (eventDate < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Choose a future event date.' }, { status: 400 })
  }

  const { count: overlapping } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('venue_id', venueId)
    .eq('event_date', eventDate)
    .in('status', ['awaiting_payment', 'confirmed'])

  if ((overlapping ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This venue is already booked on that date. Please choose another date.' },
      { status: 409 }
    )
  }

  const { data, error } = await supabase.from('bookings').insert({
    user_id:      auth.user.id,
    venue_id:     venueId,
    package_id:   packageId ?? null,
    event_type:   eventType,
    event_date:   eventDate,
    guest_count:  guestCount,
    total_amount: packagePrice ?? venue.price,
    notes:        notes ?? '',
    status:       'pending',
  }).select().single()

  if (error) {
    if (error.code === '23505' || error.code === '23P01') {
      return NextResponse.json(
        { error: 'This venue is already booked on that date. Please choose another date.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivity({
    userId: auth.user.id,
    action: 'CREATE_BOOKING',
    entity: 'bookings',
    entityId: data.id,
    details: { venueId, packageId: packageId ?? null, eventType, eventDate },
  })

  return NextResponse.json({ data }, { status: 201 })
}

// PATCH /api/bookings — user cancels own booking
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = createServiceClient()
  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const { data: booking, error: bookingLookupError } = await supabase
    .from('bookings').select('user_id, status').eq('id', bookingId).single()

  if (bookingLookupError && bookingLookupError.code !== 'PGRST116') {
    console.error('[bookings] Failed to look up booking for cancellation:', bookingLookupError.message)
    return NextResponse.json({ error: 'Could not verify this booking. Please try again.' }, { status: 500 })
  }

  if (!booking || booking.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (booking.status !== 'pending') {
    if (booking.status !== 'awaiting_payment') {
      return NextResponse.json({ error: 'Only pending or awaiting-payment bookings can be cancelled' }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity({ userId: auth.user.id, action: 'CANCEL_BOOKING', entity: 'bookings', entityId: bookingId })

  return NextResponse.json({ message: 'Booking cancelled' })
}
