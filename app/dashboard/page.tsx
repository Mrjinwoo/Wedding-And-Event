import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/lib/supabase/server'
import { requireUserPage } from '@/lib/supabase/requireUser'
import { expireOverdueBookings } from '@/lib/bookings'

export default async function DashboardPage() {
  const result = await requireUserPage()
  if ('redirect' in result) redirect(result.redirect)
  const { user, profile } = result

  if (profile.role === 'admin' || profile.role === 'staff') redirect('/admin')

  await expireOverdueBookings()
  const supabase = await createClient()

  // Fetch user data in parallel
  const [
    { data: bookings },
    { data: messages },
    { data: notifications },    { data: activity },
  ] = await Promise.all([
    supabase.from('bookings')
      .select('*, venues:venue_id(name, location, image_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('messages')
      .select('*, sender:sender_id(full_name)')
      .eq('receiver_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .limit(5),
    supabase.from('activity_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    awaiting_payment: 'bg-orange-100 text-orange-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-700',
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      {/* Header */}
      <div className="bg-[#9B2C4A] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-display text-2xl font-bold">
              Welcome back, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            <p className="text-white/70 text-sm mt-1">{user.email}</p>
          </div>
          <LogoutButton className="text-sm font-semibold px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Bookings', value: bookings?.length ?? 0, icon: '📋', color: 'bg-white' },
            { label: 'Open Requests', value: bookings?.filter(b => ['pending', 'awaiting_payment'].includes(b.status)).length ?? 0, icon: '⏳', color: 'bg-yellow-50' },
            { label: 'Confirmed', value: bookings?.filter(b => b.status === 'confirmed').length ?? 0, icon: '✅', color: 'bg-green-50' },
            { label: 'Unread Messages', value: messages?.length ?? 0, icon: '💬', color: 'bg-blue-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.color} rounded-2xl p-5 shadow-sm border border-gray-100`}>
              <span className="text-2xl">{stat.icon}</span>
              <p className="font-display text-3xl font-bold text-[#1a1a1a] mt-2">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Notifications */}
        {notifications && notifications.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <h2 className="font-display text-base font-semibold text-[#1a1a1a] mb-3">🔔 Notifications</h2>
            <div className="space-y-2">
              {notifications.map(n => (
                <Link key={n.id} href={n.link || '/dashboard/bookings'} className="flex items-start gap-3 text-sm hover:bg-blue-100/60 rounded-lg p-2 -m-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-[#1a1a1a]">{n.title}</p>
                    <p className="text-gray-500 text-xs">{n.body}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bookings */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-display text-base font-semibold text-[#1a1a1a]">My Bookings</h2>
              <Link href="/dashboard/bookings" className="text-xs text-[#9B2C4A] hover:underline font-medium">View all →</Link>
            </div>
            {bookings && bookings.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {bookings.map(b => (
                  <div key={b.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[#1a1a1a] truncate">{b.event_type}</p>
                      <p className="text-xs text-gray-400">{(b.venues as {name:string}|null)?.name} · {new Date(b.event_date).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {b.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-gray-400 text-sm">No bookings yet.</p>
                <Link href="/venue" className="mt-3 inline-block text-sm font-medium text-[#9B2C4A] hover:underline">Browse venues →</Link>
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-display text-base font-semibold text-[#1a1a1a]">Recent Activity</h2>
            </div>
            {activity && activity.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {activity.map(a => (
                  <div key={a.id} className="px-5 py-3">
                    <p className="text-xs font-medium text-[#1a1a1a]">{a.action.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-gray-400 text-sm">No activity yet.</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Book a Venue', href: '/venue', icon: '🏛️' },
            { label: 'My Bookings', href: '/dashboard/bookings', icon: '📋' },
            { label: 'Messages', href: '/dashboard/messages', icon: '💬' },
            { label: 'My Profile', href: '/dashboard/profile', icon: '👤' },
          ].map(action => (
            <Link key={action.href} href={action.href}
              className="bg-white hover:bg-[#F5E6EA] rounded-2xl p-5 shadow-sm border border-gray-100 text-center transition-colors group">
              <span className="text-3xl block mb-2">{action.icon}</span>
              <p className="text-sm font-medium text-[#1a1a1a] group-hover:text-[#9B2C4A] transition-colors">{action.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
