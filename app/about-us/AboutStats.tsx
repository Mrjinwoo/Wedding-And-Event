"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  venues: number;
  guestCapacity: number;
  packages: number;
  services: number;
};

const LABELS: { key: keyof Stats; label: string }[] = [
  { key: "venues", label: "Available Venues" },
  { key: "guestCapacity", label: "Total Guest Capacity" },
  { key: "packages", label: "Event Packages" },
  { key: "services", label: "Services Offered" },
];

export default function AboutStats({ initialStats }: { initialStats: Stats }) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function refreshStats() {
      const [venuesResult, packagesResult, servicesResult] = await Promise.all([
        supabase.from("venues").select("capacity")
          .eq("is_active", true).eq("review_status", "approved"),
        supabase.from("packages").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      if (!active) return;
      setStats(current => ({
        venues: venuesResult.error ? current.venues : venuesResult.data.length,
        guestCapacity: venuesResult.error ? current.guestCapacity : venuesResult.data.reduce((sum, venue) => sum + Number(venue.capacity || 0), 0),
        packages: packagesResult.error ? current.packages : packagesResult.count ?? 0,
        services: servicesResult.error ? current.services : servicesResult.count ?? 0,
      }));
    }

    void refreshStats();
    const channel = supabase.channel("about-live-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "venues" }, () => void refreshStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "packages" }, () => void refreshStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => void refreshStats())
      .subscribe();

    // Keep stats fresh even if Realtime is reconnecting.
    const interval = window.setInterval(() => void refreshStats(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="bg-[#9B2C4A] py-12" aria-label="Live venue and service statistics">
      <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {LABELS.map(({ key, label }) => (
          <div key={key}>
            <p className="font-display text-4xl font-bold text-white">{stats[key].toLocaleString()}</p>
            <p className="text-sm text-white/70 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
