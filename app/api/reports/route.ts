import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/requireUser'
import { attachUserProfiles } from '@/lib/bookings'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const supabase = await createClient()

  // Run all queries in parallel
  const [
    { count: totalUsers },
    { count: totalBookings },
    { count: pendingBookings },
    { count: confirmedBookings },
    { count: cancelledBookings },
    { count: completedBookings },
    { data: revenueData },
    { data: recentBookings },
    { data: venueStats },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('bookings').select('total_amount').in('status', ['confirmed', 'completed']),
    supabase.from('bookings')
      .select('*, venues:venue_id(name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('bookings')
      .select('venue_id, venues:venue_id(name)')
      .eq('status', 'confirmed'),
  ])

  const recentBookingsWithProfiles = await attachUserProfiles(supabase, recentBookings)

  const totalRevenue = revenueData?.reduce((sum, b) => sum + Number(b.total_amount), 0) ?? 0

  // Count bookings per venue
  const venueBookingMap: Record<string, { name: string; count: number }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  venueStats?.forEach((b: any) => {
    const vid = b.venue_id as string
    const venueName = Array.isArray(b.venues) ? b.venues[0]?.name : b.venues?.name
    if (!venueBookingMap[vid]) venueBookingMap[vid] = { name: venueName ?? 'Unknown', count: 0 }
    venueBookingMap[vid].count++
  })
  const topVenues = Object.values(venueBookingMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return NextResponse.json({
    stats: {
      totalUsers,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      completedBookings,
      totalRevenue,
    },
    recentBookings: recentBookingsWithProfiles,
    topVenues,
  })
}
