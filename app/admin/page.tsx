import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUserPage } from '@/lib/supabase/requireUser'
import { attachUserProfiles } from '@/lib/bookings'

function manilaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function formatDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function statusStyle(status: string) {
  if (status === 'pending') return 'bg-amber-50 text-amber-800 ring-amber-200'
  if (status === 'awaiting_payment') return 'bg-orange-50 text-orange-800 ring-orange-200'
  return 'bg-green-50 text-green-800 ring-green-200'
}

function venueName(relation: unknown): string | null {
  const venue = Array.isArray(relation) ? relation[0] : relation
  if (typeof venue !== 'object' || venue === null || !('name' in venue)) return null
  return typeof venue.name === 'string' ? venue.name : null
}

export default async function AdminPage() {
  const result = await requireUserPage({ roles: ['admin', 'staff'] })
  if ('redirect' in result) redirect(result.redirect)

  const { profile } = result
  const isAdmin = profile.role === 'admin'
  const supabase = await createClient()
  const today = manilaDateKey(new Date())
  const todayLabel = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date())

  const [
    { count: pendingCount },
    { count: paymentCount },
    { count: inquiryCount },
    { count: confirmedCount },
    { data: attentionBookings },
    { data: upcomingEvents },
    { data: activity },
    adminSummary,
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('bookings').select('*', { count: 'exact', head: true })
      .eq('status', 'awaiting_payment').eq('payment_proof_status', 'pending'),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_read', false)
      .or('content.like.Venue inquiry:%,content.like.Package inquiry:%'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('bookings')
      .select('id, user_id, event_type, event_date, status, created_at, venues:venue_id(name)')
      .in('status', ['pending', 'awaiting_payment']).order('created_at', { ascending: true }).limit(6),
    supabase.from('bookings')
      .select('id, user_id, event_type, event_date, venues:venue_id(name)')
      .eq('status', 'confirmed').gte('event_date', today).order('event_date', { ascending: true }).limit(5),
    supabase.from('activity_logs').select('id, action, created_at').order('created_at', { ascending: false }).limit(5),
    isAdmin ? Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('venues').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('review_status', 'approved'),
      supabase.from('bookings').select('total_amount').in('status', ['confirmed', 'completed']),
    ]) : Promise.resolve(null),
  ])

  const [usersQuery, venuesQuery, revenueQuery] = adminSummary ?? []
  const [attentionWithProfiles, upcomingWithProfiles] = await Promise.all([
    attachUserProfiles(supabase, attentionBookings),
    attachUserProfiles(supabase, upcomingEvents),
  ])
  const bookedValue = revenueQuery?.data?.reduce((total, booking) => total + Number(booking.total_amount ?? 0), 0) ?? 0
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || 'there'
  const stats = [
    { label: 'New requests', value: pendingCount ?? 0, hint: 'Waiting for review', href: '/admin/queue?tab=requests', tone: 'amber', icon: '01' },
    { label: 'Payment receipts', value: paymentCount ?? 0, hint: 'Need verification', href: '/admin/queue?tab=payments', tone: 'orange', icon: '02' },
    { label: 'Unread inquiries', value: inquiryCount ?? 0, hint: 'Customer messages', href: '/admin/messages', tone: 'rose', icon: '03' },
    { label: 'Confirmed events', value: confirmedCount ?? 0, hint: 'Bookings on the calendar', href: '/admin/bookings', tone: 'green', icon: '04' },
  ] as const

  return (
    <main className="min-h-screen bg-[#F7F5F2]">
      <div className="mx-auto max-w-[1440px] space-y-7 px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col justify-between gap-5 rounded-3xl bg-[#1D1B1B] px-6 py-7 text-white shadow-sm sm:flex-row sm:items-end sm:px-9 sm:py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{todayLabel}</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Good day, {firstName}</h1>
            <p className="mt-2 text-sm text-white/60">Here&apos;s what needs your attention today.</p>
          </div>
          <Link href="/admin/queue" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#A83152] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#BD3C60]">
            Open review queue <span aria-hidden="true">→</span>
          </Link>
        </header>

        <section aria-label="Operational summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(stat => {
            const tone = stat.tone === 'amber' ? 'bg-amber-50 text-amber-700 ring-amber-100'
              : stat.tone === 'orange' ? 'bg-orange-50 text-orange-700 ring-orange-100'
                : stat.tone === 'rose' ? 'bg-rose-50 text-rose-700 ring-rose-100'
                  : 'bg-emerald-50 text-emerald-700 ring-emerald-100'
            return (
              <Link key={stat.label} href={stat.href} className="group rounded-2xl border border-[#EAE6E2] bg-white p-5 shadow-[0_2px_10px_rgba(28,20,16,0.03)] transition hover:-translate-y-0.5 hover:border-[#D8C5C8] hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-[#68615D]">{stat.label}</span>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider ring-1 ${tone}`}>{stat.icon}</span>
                </div>
                <p className="mt-5 font-display text-4xl font-semibold text-[#211E1D]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#8C8580]">{stat.hint}</p>
              </Link>
            )
          })}
        </section>

        {isAdmin && (
          <section aria-label="Business overview" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Customer accounts', value: usersQuery?.count ?? 0, detail: 'Registered profiles', href: '/admin/users' },
              { label: 'Active venues', value: venuesQuery?.count ?? 0, detail: 'Available to book', href: '/admin/venues' },
              { label: 'Booked value', value: `₱${bookedValue.toLocaleString('en-PH')}`, detail: 'Confirmed and completed', href: '/admin/reports' },
            ].map(item => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-2xl border border-[#EAE6E2] bg-white px-5 py-4 transition hover:border-[#D8C5C8]">
                <div><p className="text-xs font-medium text-[#817975]">{item.label}</p><p className="mt-1 text-xs text-[#A29A95]">{item.detail}</p></div>
                <span className="font-display text-xl font-semibold text-[#211E1D]">{item.value}</span>
              </Link>
            ))}
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-[#EAE6E2] bg-white shadow-[0_2px_10px_rgba(28,20,16,0.03)]">
            <div className="flex items-center justify-between gap-4 border-b border-[#F0ECE9] px-5 py-4 sm:px-6">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A83152]">Priority</p><h2 className="mt-1 font-display text-xl font-semibold text-[#211E1D]">Needs attention</h2></div>
              <Link href="/admin/queue" className="text-xs font-semibold text-[#A83152] hover:underline">View queue →</Link>
            </div>
            {attentionWithProfiles.length ? (
              <div className="divide-y divide-[#F3F0ED]">
                {attentionWithProfiles.map(booking => (
                  <Link key={booking.id} href="/admin/queue" className="flex items-center gap-4 px-5 py-4 transition hover:bg-[#FCFAF9] sm:px-6">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8EEF0] text-xs font-bold text-[#A83152]">{booking.status === 'pending' ? 'NEW' : 'PAY'}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#292523]">{booking.event_type} <span className="font-normal text-[#8C8580]">· {booking.profiles?.full_name ?? 'Customer'}</span></p>
                      <p className="mt-1 truncate text-xs text-[#928A85]">{venueName(booking.venues) ?? 'Venue'} · Event {formatDate(booking.event_date)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ${statusStyle(booking.status)}`}>{booking.status.replaceAll('_', ' ')}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center"><p className="text-sm font-medium text-[#625B56]">You&apos;re all caught up.</p><p className="mt-1 text-xs text-[#A29A95]">New requests and receipts will appear here.</p></div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#EAE6E2] bg-white shadow-[0_2px_10px_rgba(28,20,16,0.03)]">
            <div className="flex items-center justify-between border-b border-[#F0ECE9] px-5 py-4 sm:px-6">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A6B65]">On the calendar</p><h2 className="mt-1 font-display text-xl font-semibold text-[#211E1D]">Upcoming events</h2></div>
              <Link href="/admin/bookings" className="text-xs font-semibold text-[#A83152] hover:underline">All bookings →</Link>
            </div>
            {upcomingWithProfiles.length ? (
              <div className="divide-y divide-[#F3F0ED]">
                {upcomingWithProfiles.map(event => (
                  <div key={event.id} className="flex gap-4 px-5 py-4 sm:px-6">
                    <div className="w-14 shrink-0 rounded-xl bg-[#F7F3EF] px-2 py-2 text-center">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#A83152]">{new Date(`${event.event_date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-PH', { month: 'short' })}</span>
                      <span className="mt-0.5 block font-display text-xl font-semibold text-[#292523]">{new Date(`${event.event_date.slice(0, 10)}T00:00:00`).getDate()}</span>
                    </div>
                    <div className="min-w-0 py-0.5">
                      <p className="truncate text-sm font-semibold text-[#292523]">{event.event_type}</p>
                      <p className="mt-1 truncate text-xs text-[#928A85]">{venueName(event.venues) ?? 'Venue'} · {event.profiles?.full_name ?? 'Customer'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="px-6 py-12 text-center text-sm text-[#A29A95]">No confirmed events coming up.</p>}
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
          <section className="rounded-2xl border border-[#EAE6E2] bg-white p-5 shadow-[0_2px_10px_rgba(28,20,16,0.03)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A6B65]">Shortcuts</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-[#211E1D]">Quick actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: 'Review requests', href: '/admin/queue' },
                { label: 'Open messages', href: '/admin/messages' },
                { label: 'View bookings', href: '/admin/bookings' },
                ...(isAdmin ? [{ label: 'Manage staff', href: '/admin/users' }] : []),
              ].map(action => <Link key={action.href} href={action.href} className="rounded-xl border border-[#EEE9E5] px-3 py-3 text-xs font-semibold text-[#514944] transition hover:border-[#CDAAB3] hover:bg-[#FCF7F8] hover:text-[#A83152]">{action.label} <span aria-hidden="true">↗</span></Link>)}
            </div>
          </section>

          <section className="rounded-2xl border border-[#EAE6E2] bg-white p-5 shadow-[0_2px_10px_rgba(28,20,16,0.03)] sm:p-6">
            <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A6B65]">Team activity</p><h2 className="mt-1 font-display text-xl font-semibold text-[#211E1D]">Recently updated</h2></div></div>
            {activity?.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{activity.map(item => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF8F6] px-4 py-3"><span className="truncate text-xs font-medium capitalize text-[#514944]">{item.action.replaceAll('_', ' ').toLowerCase()}</span><time className="shrink-0 text-[10px] text-[#9A918A]">{new Date(item.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</time></li>)}</ul> : <p className="mt-4 rounded-xl bg-[#FAF8F6] px-4 py-6 text-center text-xs text-[#A29A95]">Activity will appear here as bookings and inquiries are handled.</p>}
          </section>
        </div>
      </div>
    </main>
  )
}
