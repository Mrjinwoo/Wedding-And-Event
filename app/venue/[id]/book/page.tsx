import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BookingForm from './BookingForm'

export default async function VenueBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ packageId?: string | string[] }>
}) {
  const { id } = await params
  const query = await searchParams
  const requestedPackageId = typeof query.packageId === 'string' ? query.packageId : ''
  const supabase = await createClient()
  const [{ data: venue }, { data: { user } }, { data: packages }] = await Promise.all([
    supabase.from('venues').select('id, name, location, price, capacity, image_url').eq('id', id).eq('is_active', true).eq('review_status', 'approved').single(),
    supabase.auth.getUser(),
    supabase.from('packages').select('id, name, price, guest_capacity, features').eq('is_active', true).order('sort_order', { ascending: true }),
  ])

  if (!venue) notFound()
  if (!user) {
    return (
      <main className="min-h-screen bg-[#FAF7F5] px-6 py-16">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9B2C4A]">Reserve a venue</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-[#1a1a1a]">{venue.name}</h1>
          <p className="mt-3 text-sm text-gray-600">Please log in to request a booking.</p>
          <Link href="/login" className="mt-6 inline-block rounded-xl bg-[#9B2C4A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7A1F38]">
            Log in to continue
          </Link>
          <Link href={`/venue/${venue.id}`} className="ml-4 text-sm font-medium text-[#9B2C4A] hover:underline">Back to venue</Link>
        </section>
      </main>
    )
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'admin' || profile?.role === 'staff') redirect('/admin/bookings')

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href={`/venue/${venue.id}`} className="text-sm font-medium text-[#9B2C4A] hover:underline">← Back to venue</Link>
        <div className="mt-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9B2C4A]">Booking request</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-[#1a1a1a]">{venue.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{venue.location} · Up to {venue.capacity} guests</p>
          <p className="mt-4 font-display text-2xl font-bold text-[#1a1a1a]">₱{Number(venue.price).toLocaleString()}</p>
          <p className="mb-6 text-xs text-gray-400">Starting price per event day</p>
          <BookingForm
            venueId={venue.id}
            capacity={venue.capacity}
            venuePrice={Number(venue.price)}
            packages={packages ?? []}
            initialPackageId={packages?.some(pkg => pkg.id === requestedPackageId) ? requestedPackageId : ''}
          />
        </div>
      </div>
    </main>
  )
}
