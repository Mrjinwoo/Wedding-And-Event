import Image from "next/image";
import GetInTouchButton from "@/components/GetInTouchButton";
import { createClient } from "@/lib/supabase/server";
import AboutStats from "./AboutStats";

export default async function AboutUsPage() {
  const supabase = await createClient();
  const [{ data: venues }, { count: packagesCount }, { count: servicesCount }] = await Promise.all([
    supabase.from("venues").select("capacity").eq("is_active", true).eq("review_status", "approved"),
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const initialStats = {
    venues: venues?.length ?? 0,
    guestCapacity: venues?.reduce((sum, venue) => sum + Number(venue.capacity || 0), 0) ?? 0,
    packages: packagesCount ?? 0,
    services: servicesCount ?? 0,
  };
  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      {/* Page header */}
      <section className="bg-[#F5E6EA] py-14 text-center">
        <h1 className="font-display text-4xl font-bold text-[#1a1a1a]">About Us</h1>
        <p className="mt-3 text-gray-500 text-sm max-w-md mx-auto">
          We are passionate about creating beautiful, meaningful experiences for every milestone in your life.
        </p>
      </section>

      {/* Story section */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="relative h-80 rounded-2xl overflow-hidden shadow-md">
          <Image
            src="/wed.jpg"
            alt="Our story"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="font-display text-3xl font-bold text-[#1a1a1a] mb-4">
            Our Story
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">
            Founded over a decade ago in the heart of Cebu City, Wedding and Event Venue was born from a simple dream — to give every couple and family a place where their most precious memories could be made.
          </p>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            What started with a simple idea has grown into a range of spaces and services for celebrations of all sizes. Explore the current venues and packages to find the right fit for your event.
          </p>
          <GetInTouchButton />
        </div>
      </section>

      <AboutStats initialStats={initialStats} />

    </main>
  );
}
