import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireStaffAal2 } from '@/lib/supabase/requireUser'
import { attachUserProfiles, expireOverdueBookings } from '@/lib/bookings'

export async function GET(req: NextRequest) {
  const auth = await requireStaffAal2(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  await expireOverdueBookings()
  const supabase = await createClient()
  const now = new Date().toISOString()

  const [
    { data: requests, count: requestCount, error: requestError },
    { data: paymentReviews, count: paymentReviewCount, error: paymentError },
    { data: overdueBookings, count: overdueCount, error: overdueError },
    { data: inquiries, count: inquiryCount, error: inquiryError },
  ] = await Promise.all([
    supabase.from('bookings')
      .select('id, user_id, venue_id, event_type, event_date, guest_count, total_amount, created_at', { count: 'exact' })
      .eq('status', 'pending').order('created_at', { ascending: true }).limit(10),
    supabase.from('bookings')
      .select('id, user_id, venue_id, event_type, event_date, guest_count, total_amount, deposit_amount, payment_deadline, payment_proof_path, payment_proof_status, created_at', { count: 'exact' })
      .eq('status', 'awaiting_payment').eq('payment_proof_status', 'pending')
      .order('payment_proof_submitted_at', { ascending: true }).limit(10),
    supabase.from('bookings')
      .select('id, user_id, venue_id, event_type, event_date, payment_deadline, status', { count: 'exact' })
      .or(`status.eq.expired,and(status.eq.awaiting_payment,payment_deadline.lte.${now})`)
      .order('payment_deadline', { ascending: true }).limit(10),
    supabase.from('messages')
      .select('id, sender_id, content, created_at, venue_id', { count: 'exact' })
      .eq('is_read', false)
      .or('content.like.Venue inquiry:%,content.like.Package inquiry:%')
      .order('created_at', { ascending: true }).limit(10),
  ])

  const queryError = requestError ?? paymentError ?? overdueError ?? inquiryError
  if (queryError) {
    console.error('[admin queue] Could not load review queue:', queryError)
    return NextResponse.json({
      error: process.env.NODE_ENV === 'development'
        ? `Could not load the review queue: ${queryError.message}`
        : 'Could not load the review queue.',
    }, { status: 500 })
  }

  const [requestsWithProfiles, paymentsWithProfiles, overdueWithProfiles] = await Promise.all([
    attachUserProfiles(supabase, requests),
    attachUserProfiles(supabase, paymentReviews),
    attachUserProfiles(supabase, overdueBookings),
  ])

  const allVenueIds = [...new Set([
    ...(requests ?? []).map(item => item.venue_id),
    ...(paymentReviews ?? []).map(item => item.venue_id),
    ...(overdueBookings ?? []).map(item => item.venue_id),
    ...(inquiries ?? []).map(item => item.venue_id),
  ].filter((id): id is string => Boolean(id)))]
  const venues = allVenueIds.length
    ? (await supabase.from('venues').select('id, name').in('id', allVenueIds)).data ?? []
    : []
  const venueById = new Map((venues ?? []).map(venue => [venue.id, { name: venue.name }]))
  const withVenue = <T extends { venue_id?: string | null }>(items: T[]) => items.map(item => ({
    ...item,
    venues: item.venue_id ? venueById.get(item.venue_id) ?? null : null,
    packages: null,
  }))
  const senderIds = [...new Set((inquiries ?? []).map(item => item.sender_id).filter(Boolean))]
  const inquiryProfiles = senderIds.length
    ? (await supabase.from('profiles').select('id, full_name').in('id', senderIds)).data ?? []
    : []
  const senderById = new Map(inquiryProfiles.map(profile => [profile.id, { full_name: profile.full_name }]))
  const inquiriesWithDetails = (inquiries ?? []).map(inquiry => ({
    ...inquiry,
    venue: inquiry.venue_id ? venueById.get(inquiry.venue_id) ?? null : null,
    package: null,
    sender: senderById.get(inquiry.sender_id) ?? null,
  }))

  return NextResponse.json({
    canManageBookings: auth.profile.role === 'admin',
    requests: { items: withVenue(requestsWithProfiles), count: requestCount ?? 0 },
    paymentReviews: { items: withVenue(paymentsWithProfiles), count: paymentReviewCount ?? 0 },
    overdueBookings: { items: withVenue(overdueWithProfiles), count: overdueCount ?? 0 },
    inquiries: { items: inquiriesWithDetails, count: inquiryCount ?? 0 },
  })
}
