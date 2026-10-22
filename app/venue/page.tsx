import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type Venue = {
  id: string
  name: string
  location: string
  capacity: number
  price: number
  image_url: string | null
  description: string | null
}

export default async function VenuePage({
  searchParams,
}: {
  searchParams: Promise<{ packageId?: string | string[] }>
}) {
  const query = await searchParams
  const packageId = typeof query.packageId === 'string' ? query.packageId : ''
  const supabase = await createClient()

  // Determine the current user's role
  const { data: { user } } = await supabase.auth.getUser()
  let role = 'guest'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    role = profile?.role ?? 'client'
  }
  const isStaff = role === 'admin' || role === 'staff'

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, location, capacity, price, image_url, description')
    .eq('is_active', true)
    .eq('review_status', 'approved')
    .order('created_at', { ascending: false })

  const items: Venue[] = venues ?? []

  return (
    <main className="min-h-screen bg-[#FAF7F5]">

      {/* Page header */}
      <section className="bg-[#F5E6EA] py-14 text-center">
        <p className="font-body text-xs tracking-[0.25em] uppercase text-[#9B2C4A] font-semibold mb-2">Our Spaces</p>
        <h1 className="font-display text-4xl font-bold text-[#1a1a1a]">Our Venues</h1>
        <p className="mt-3 font-body text-gray-500 text-sm max-w-md mx-auto">
          Discover our stunning collection of event spaces in Cebu City.
        </p>
        {/* Admin shortcut */}
        {isStaff && (
          <Link
            href="/admin/venues"
            className="mt-5 inline-flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#333] text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            ⚙️ Manage Venues in Admin
          </Link>
        )}
      </section>

      {/* Venue grid */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map(venue => {
            const img      = venue.image_url ?? '/back.jpg'
            const href     = `/venue/${venue.id}${packageId ? `?packageId=${encodeURIComponent(packageId)}` : ''}`

            return (
              <Link
                key={venue.id}
                href={href}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-shadow duration-300"
              >
                {/* Image */}
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={img}
                    alt={venue.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0" style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)',
                  }} />

                  {/* Price badge */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                    <span className="font-body text-xs font-bold text-[#9B2C4A]">
                      ₱{Number(venue.price).toLocaleString()}
                    </span>
                  </div>

                  {/* Admin badge on card */}
                  {isStaff && (
                    <div className="absolute top-3 left-3 bg-[#1a1a1a]/80 text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                      Admin View
                    </div>
                  )}

                  {/* Name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                    <h3 className="font-display text-lg font-bold text-white leading-tight">
                      {venue.name}
                    </h3>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                    <svg className="w-3.5 h-3.5 text-[#9B2C4A] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {venue.location}
                    <span className="mx-1 text-gray-300">·</span>
                    👥 {venue.capacity} guests
                  </div>

                  {venue.description && (
                    <p className="font-body text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4">
                      {venue.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    {isStaff ? (
                      /* Admin sees "Edit" instead of "View details" */
                      <span className="font-body text-xs font-semibold text-[#1a1a1a] group-hover:text-[#9B2C4A] transition-colors">
                        ⚙️ View & Edit →
                      </span>
                    ) : (
                      <span className="font-body text-xs font-semibold text-[#9B2C4A] group-hover:underline">
                        View details →
                      </span>
                    )}
                    <span className="font-body text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">Available</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {items.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
            <p className="font-display text-xl font-semibold text-[#1a1a1a]">New venues are on the way</p>
            <p className="mt-2 text-sm text-gray-500">There are no published venues available to browse right now. Please check back soon.</p>
          </div>
        )}
      </section>
    </main>
  )
}
