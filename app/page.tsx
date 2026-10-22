import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Fallback cards shown when the DB has no venues yet
const STATIC_CARDS = [
  { label: "Garden Venue",   name: "The Garden Of Love",  image: "/day.jpg"           },
  { label: "Debut Hall",     name: "Royal Banquet Hall",  image: "/weeding venue.jpg" },
  { label: "Beach Wedding",  name: "Seaside View Events", image: "/back.jpg"          },
  { label: "Grand Ballroom", name: "The Grand Pavilion",  image: "/birth.jpg"         },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch up to 4 live venues — each card links to its detail page
  const { data: liveVenues } = await supabase
    .from("venues")
    .select("id, name, image_url")
    .eq("is_active", true)
    .eq("review_status", "approved")
    .order("created_at", { ascending: false })
    .limit(4);

  // Realtime stats
  const [{ count: eventsHosted }, { count: activeVenues }] = await Promise.all([
    supabase.from("bookings").select("*", { count: "exact", head: true }).in("status", ["confirmed", "completed"]),
    supabase.from("venues").select("*", { count: "exact", head: true }).eq("is_active", true).eq("review_status", "approved"),
  ]);

  type Card = { label: string; name: string; image: string; href: string };

  const cards: Card[] = (liveVenues && liveVenues.length > 0)
    ? liveVenues.map((v, i) => ({
        label: STATIC_CARDS[i]?.label ?? "Venue",
        name:  v.name,
        image: v.image_url ?? STATIC_CARDS[i]?.image ?? "/back.jpg",
        href:  `/venue/${v.id}`,
      }))
    : STATIC_CARDS.map(c => ({ ...c, href: "/venue" }));

  return (
    <div className="flex flex-col bg-white">

      {/* ══════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════ */}
      <section
        id="hero"
        className="relative w-full h-[520px] md:h-[580px] -mt-16 overflow-hidden"
      >
        <Image
          src="/background.png"
          alt="Celebrate life's special moments"
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority
        />

        {/* Base dark overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Top gradient — keeps nav readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.05) 60%, transparent 100%)",
          }}
        />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-tight hero-shadow">
            Celebrate life&apos;s
          </h1>
          <h2 className="font-display text-4xl md:text-6xl font-bold text-[#E8A0B0] leading-tight mt-1 hero-shadow">
            Special Moments
          </h2>

          <p
            className="mt-4 text-white/90 text-sm md:text-base leading-relaxed hero-shadow-sm font-body"
            style={{ maxWidth: "600px" }}
          >
            Find the perfect venue for weddings, receptions, debuts,
            corporate events and more — all in one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={user ? "#venues" : "/login?redirect=%2F%23venues"}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-body font-semibold text-sm transition-colors shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Check Availability
            </Link>

            <Link
              href="/venue"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-white/80 text-white hover:bg-white/15 font-body font-semibold text-sm transition-colors backdrop-blur-sm"
            >
              View Venues
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {user && (
            <Link
              href="/dashboard"
              className="mt-3 text-white/70 hover:text-white text-xs font-body underline underline-offset-2 transition-colors"
            >
              Go to my dashboard →
            </Link>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          VENUE CARDS — each links to /venue/[id]
      ══════════════════════════════════════════════════════════════════ */}
      <section id="venues" className="max-w-7xl mx-auto w-full px-6 py-14">

        <div className="text-center mb-10">
          <p className="font-body text-xs tracking-[0.25em] uppercase text-[#9B2C4A] font-semibold mb-2">
            Our Spaces
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#1a1a1a]">
            Featured Venues
          </h2>
          <p className="font-body text-sm text-gray-500 mt-3 max-w-lg mx-auto">
            Each space is thoughtfully designed to make your celebration unforgettable.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <Link
              key={card.name}
              href={card.href}
              className="group relative rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white hover:shadow-xl transition-shadow duration-300"
            >
              {/* Image */}
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src={card.image}
                  alt={card.label}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                />

                {/* Bottom gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)",
                  }}
                />

                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
                  <p className="font-body text-[10px] font-semibold tracking-widest uppercase text-[#C9A96E] mb-0.5">
                    {card.label}
                  </p>
                  <p className="font-display text-base font-semibold text-white leading-snug">
                    {card.name}
                  </p>
                </div>
              </div>

              {/* Bottom strip */}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-body text-xs text-gray-400">Cebu City, Cebu</span>
                <span className="font-body text-xs font-semibold text-[#9B2C4A] group-hover:underline transition-all">
                  Explore →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/venue"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-[#9B2C4A] text-[#9B2C4A] hover:bg-[#9B2C4A] hover:text-white font-body font-semibold text-sm transition-colors"
          >
            View All Venues
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          STATS BANNER
      ══════════════════════════════════════════════════════════════════ */}
      <section className="w-full bg-[#9B2C4A] py-14">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
          {[
            { value: `${eventsHosted ?? 0}+`, label: "Events Hosted" },
            { value: "10+",                   label: "Years of Experience" },
            { value: String(activeVenues ?? 0), label: "Stunning Venues" },
            { value: "98%",                   label: "Client Satisfaction" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="font-display text-4xl md:text-5xl font-bold">{value}</p>
              <p className="font-body text-sm mt-2 text-white/80 tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
