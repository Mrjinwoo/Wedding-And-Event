import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [
    { count: totalUsers },
    { count: totalBookings },
    { count: pendingBookings },
    { count: awaitingPaymentBookings },
    { count: confirmedBookings },
    { count: cancelledBookings },
    { count: completedBookings },
    { data: revenueData },
    { data: venueStats },
    { data: monthlyData },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'awaiting_payment'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('bookings').select('total_amount').in('status', ['confirmed', 'completed']),
    supabase.from('bookings').select('venue_id, venues:venue_id(name)').eq('status', 'confirmed'),
    supabase.from('bookings').select('created_at, total_amount, status').order('created_at', { ascending: true }),
  ])

  const totalRevenue = revenueData?.reduce((s, b) => s + Number(b.total_amount), 0) ?? 0

  // Venue booking counts
  const venueMap: Record<string, { name: string; count: number }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  venueStats?.forEach((b: any) => {
    const vid = b.venue_id as string
    const venueName = Array.isArray(b.venues) ? b.venues[0]?.name : b.venues?.name
    if (!venueMap[vid]) venueMap[vid] = { name: venueName ?? 'Unknown', count: 0 }
    venueMap[vid].count++
  })
  const topVenues = Object.values(venueMap).sort((a, b) => b.count - a.count).slice(0, 5)
  const maxVenueCount = topVenues[0]?.count ?? 1

  const bookingStatusData = [
    { label: 'Pending', count: pendingBookings ?? 0, color: 'bg-yellow-400' },
    { label: 'Awaiting Payment', count: awaitingPaymentBookings ?? 0, color: 'bg-orange-500' },
    { label: 'Confirmed', count: confirmedBookings ?? 0, color: 'bg-green-500' },
    { label: 'Cancelled', count: cancelledBookings ?? 0, color: 'bg-red-400' },
    { label: 'Completed', count: completedBookings ?? 0, color: 'bg-blue-500' },
  ]
  const maxStatus = Math.max(...bookingStatusData.map(d => d.count), 1)

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <div className="bg-[#1a1a1a] py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/admin" className="text-white/60 text-sm hover:text-white">← Admin</Link>
          <h1 className="text-white font-display text-2xl font-bold mt-1">Reports & Analytics</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: totalUsers ?? 0, icon: '👥', sub: 'registered accounts' },
            { label: 'Total Bookings', value: totalBookings ?? 0, icon: '📋', sub: 'all time' },
            { label: 'Confirmed Booking Value', value: `₱${totalRevenue.toLocaleString()}`, icon: '💰', sub: 'contract value, not payment collected' },
            { label: 'Completion Rate', value: `${totalBookings ? Math.round(((completedBookings ?? 0) / totalBookings) * 100) : 0}%`, icon: '📈', sub: 'of all bookings' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <span className="text-2xl">{stat.icon}</span>
              <p className="font-display text-3xl font-bold text-[#1a1a1a] mt-2">{stat.value}</p>
              <p className="text-xs font-semibold text-[#9B2C4A] mt-1">{stat.label}</p>
              <p className="text-[11px] text-gray-400">{stat.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking Status Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-display text-base font-semibold text-[#1a1a1a] mb-6">Booking Status Breakdown</h2>
            <div className="space-y-4">
              {bookingStatusData.map(item => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-[#1a1a1a]">{item.count}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${(item.count / maxStatus) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Venues */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-display text-base font-semibold text-[#1a1a1a] mb-6">Top Venues by Bookings</h2>
            {topVenues.length > 0 ? (
              <div className="space-y-4">
                {topVenues.map((v, i) => (
                  <div key={v.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{i + 1}. {v.name}</span>
                      <span className="font-semibold text-[#1a1a1a]">{v.count} bookings</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#9B2C4A] rounded-full transition-all"
                        style={{ width: `${(v.count / maxVenueCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-8">No confirmed bookings yet.</p>
            )}
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-display text-base font-semibold text-[#1a1a1a]">Summary</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              {[
                ['Total Registered Users', totalUsers ?? 0],
                ['Total Bookings', totalBookings ?? 0],
                ['Pending Bookings', pendingBookings ?? 0],
                ['Confirmed Bookings', confirmedBookings ?? 0],
                ['Completed Bookings', completedBookings ?? 0],
                ['Cancelled Bookings', cancelledBookings ?? 0],
                ['Confirmed Booking Value (Confirmed + Completed)', `₱${totalRevenue.toLocaleString()}`],
              ].map(([label, value]) => (
                <tr key={String(label)} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-600">{label}</td>
                  <td className="px-6 py-3 font-semibold text-[#1a1a1a] text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
