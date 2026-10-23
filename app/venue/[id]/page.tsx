import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ReviewForm from './ReviewForm'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ packageId?: string | string[] }>
}

export default async function VenueDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams
  const packageId = typeof query.packageId === 'string' ? query.packageId : ''
  const bookingUrl = `/venue/${id}/book${packageId ? `?packageId=${encodeURIComponent(packageId)}` : ''}`
  const supabase = await createClient()

  const { data: venue, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .eq('review_status', 'approved')
    .single()

  if (error || !venue) notFound()

  // Check who is viewing — admin/staff see management options, clients see booking
  const { data: { user } } = await supabase.auth.getUser()
  let role = 'guest'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    role = profile?.role ?? 'client'
  }

  const isStaff = role === 'admin' || role === 'staff'
  const [{ data: reviews }, { data: priorReview }, { data: eligibleBooking }] = await Promise.all([
    supabase.from('venue_reviews').select('id, rating, comment, created_at, user_id').eq('venue_id', id).order('created_at', { ascending: false }),
    user ? supabase.from('venue_reviews').select('id').eq('venue_id', id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    user && role === 'client'
      ? supabase.from('bookings').select('id').eq('venue_id', id).eq('user_id', user.id).eq('status', 'confirmed').lt('event_date', new Date().toISOString().slice(0, 10)).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const averageRating = reviews?.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0

  return (
    <main className="min-h-screen bg-[#FAF7F5]">

      {/* ── Hero image ── */}
      <section className="relative w-full h-72 md:h-96 overflow-hidden">
        {venue.image_url ? (
          <Image
            src={venue.image_url}
            alt={venue.name}
            fill
            unoptimized
            sizes="100vw"
            className="object-cover object-center"
            priority
          />
        ) : (
          <div className="w-full h-full bg-[#F5E6EA] flex items-center justify-center text-6xl">🏛️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Back link */}
        <div className="absolute top-4 left-4">
          <Link
            href="/venue"
            className="inline-flex items-center gap-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Venues
          </Link>
        </div>

        {/* Admin badge */}
        {isStaff && (
          <div className="absolute top-4 right-4">
            <Link
              href="/admin/venues"
              className="inline-flex items-center gap-1.5 bg-[#9B2C4A]/90 hover:bg-[#9B2C4A] backdrop-blur-sm text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors shadow"
            >
              ⚙️ Manage in Admin
            </Link>
          </div>
        )}

        {/* Venue name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 md:px-10">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
            {venue.name}
          </h1>
          <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {venue.location}
          </p>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Left: description + highlights ── */}
        <div className="lg:col-span-2 space-y-8">

          {/* Description */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-display text-xl font-bold text-[#1a1a1a] mb-3">About This Venue</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              {venue.description ?? 'A beautiful venue perfect for your special occasion. Contact us for more details.'}
            </p>
          </div>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6" aria-labelledby="reviews-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="reviews-heading" className="font-display text-xl font-bold text-[#1a1a1a]">Customer Reviews</h2>
                <p className="mt-1 text-sm text-gray-500">{reviews?.length ? `${averageRating.toFixed(1)} out of 5 · ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}</p>
              </div>
              {reviews?.length ? <span className="text-amber-500" aria-label={`${averageRating.toFixed(1)} out of 5 stars`}>{'★'.repeat(Math.round(averageRating))}{'☆'.repeat(5 - Math.round(averageRating))}</span> : null}
            </div>
            {eligibleBooking && !priorReview && <ReviewForm venueId={id} />}
            {user && role === 'client' && !eligibleBooking && !priorReview && <p className="mt-4 text-sm text-gray-500">Customers with a past confirmed booking can leave a review after their event.</p>}
            {priorReview && <p className="mt-4 text-sm text-gray-500">You have already reviewed this venue.</p>}
            {!user && <p className="mt-4 text-sm text-gray-500"><Link className="font-semibold text-[#9B2C4A] hover:underline" href={`/login?redirect=${encodeURIComponent(`/venue/${id}`)}`}>Sign in</Link> after a confirmed event to leave a review.</p>}
            <div className="mt-5 divide-y divide-gray-100">
              {reviews?.map(review => <article key={review.id} className="py-4 first:pt-0">
                <div className="flex items-center justify-between gap-3"><span className="text-amber-500" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><time className="text-xs text-gray-400" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString()}</time></div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{review.comment}</p>
              </article>)}
            </div>
          </section>

          {/* Highlights */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-display text-xl font-bold text-[#1a1a1a] mb-4">Venue Highlights</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: '👥', label: 'Capacity',     value: `Up to ${venue.capacity} guests` },
                { icon: '📍', label: 'Location',     value: venue.location },
                { icon: '✅', label: 'Availability', value: 'Check calendar' },
                { icon: '🎨', label: 'Customizable', value: 'Full styling options' },
                { icon: '🍽️', label: 'Catering',    value: 'Available on request' },
                { icon: '🅿️', label: 'Parking',     value: 'Free on-site' },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center text-center p-3 bg-[#FAF7F5] rounded-xl">
                  <span className="text-2xl mb-1">{item.icon}</span>
                  <p className="text-[10px] font-semibold text-[#9B2C4A] uppercase tracking-wide">{item.label}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* What's included */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-display text-xl font-bold text-[#1a1a1a] mb-4">What&apos;s Included</h2>
            <ul className="space-y-2">
              {[
                'Exclusive use of the venue for your chosen date',
                'Tables, chairs, and basic linen',
                'Sound system and microphone',
                'Air conditioning / ventilation',
                'Dedicated event coordinator',
                'Security and parking attendants',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-[#9B2C4A] mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Right: pricing card ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
            <p className="text-xs font-semibold text-[#9B2C4A] uppercase tracking-widest mb-1">Starting at</p>
            <p className="font-display text-3xl font-bold text-[#1a1a1a]">
              ₱{Number(venue.price).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">per event day</p>

            <div className="border-t border-gray-100 my-5" />

            {/* Quick stats */}
            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-500">Capacity</span>
                <span className="font-medium text-[#1a1a1a]">{venue.capacity} guests</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Location</span>
                <span className="font-medium text-[#1a1a1a] text-right max-w-[140px] truncate">{venue.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-green-600">Available</span>
              </div>
            </div>

            {/* ── Role-based CTA ── */}
            {isStaff ? (
              /* Admin/staff: manage buttons, no booking */
              <div className="space-y-3">
                <div className="p-3 bg-[#F5E6EA] rounded-xl text-center">
                  <p className="text-xs font-semibold text-[#9B2C4A]">You are viewing as Admin</p>
                  <p className="text-xs text-gray-500 mt-0.5">Admins cannot book venues</p>
                </div>
                <Link
                  href="/admin/venues"
                  className="block w-full text-center py-3 rounded-xl bg-[#1a1a1a] hover:bg-[#333] text-white font-semibold text-sm transition-colors shadow-md"
                >
                  ⚙️ Edit This Venue
                </Link>
                <Link
                  href="/admin/bookings"
                  className="block w-full text-center py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-[#9B2C4A] hover:text-[#9B2C4A] font-medium text-sm transition-colors"
                >
                  View All Bookings
                </Link>
              </div>
            ) : (
              /* Client / guest: booking CTA */
              <div className="space-y-3">
                <Link
                  href={user ? bookingUrl : `/login?redirect=${encodeURIComponent(bookingUrl)}`}
                  className="block w-full text-center py-3 rounded-xl bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-semibold text-sm transition-colors shadow-md"
                >
                  {user ? 'Book This Venue' : 'Login to Book'}
                </Link>
                <Link
                  href={`/contact?venueId=${venue.id}`}
                  className="block w-full text-center py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-[#9B2C4A] hover:text-[#9B2C4A] font-medium text-sm transition-colors"
                >
                  Send an Inquiry
                </Link>
              </div>
            )}
          </div>

          {/* Help box — only for clients/guests */}
          {!isStaff && (
            <div className="bg-[#F5E6EA] rounded-2xl p-5">
              <p className="font-display text-base font-semibold text-[#1a1a1a] mb-1">Need help choosing?</p>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Our team is happy to walk you through the options and find the perfect fit.
              </p>
              <a href="tel:+639759403511"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#9B2C4A] hover:underline">
                📞 +63 975 940 3511
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
