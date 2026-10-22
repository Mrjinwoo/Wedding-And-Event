import { createClient } from "@/lib/supabase/server";
import GalleryGrid, { type GalleryPhoto } from "./GalleryGrid";

const STARTER_PHOTOS: GalleryPhoto[] = [
  { id: "starter-wed", title: "Wedding Ceremony", category: "wedding", caption: "A beautiful setting for a once-in-a-lifetime celebration.", image_url: "/wed.jpg" },
  { id: "starter-back", title: "Seaside Event Setup", category: "reception", caption: "An elegant reception setup by the sea.", image_url: "/back.jpg" },
  { id: "starter-birth", title: "Birthday Celebration", category: "birthday", caption: "A joyful space for celebrating together.", image_url: "/birth.jpg" },
  { id: "starter-day", title: "Garden of Love", category: "venue", caption: "A garden setting for special occasions.", image_url: "/day.jpg" },
  { id: "starter-hall", title: "Royal Banquet Hall", category: "reception", caption: "A refined hall prepared for a memorable event.", image_url: "/weeding venue.jpg" },
  { id: "starter-grand", title: "The Grand", category: "wedding", caption: "A grand backdrop for your celebration.", image_url: "/wedd.jpg" },
];

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("gallery_images")
    .select("id, title, category, caption, image_url")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at", { ascending: false });
  const photos = error || !data?.length ? STARTER_PHOTOS : data as GalleryPhoto[];

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <section className="bg-[#F5E6EA] px-6 py-14 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#9B2C4A]">Moments we love</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-[#1a1a1a]">Gallery</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-500">
          Browse weddings, celebrations, and beautiful venue setups. Open a photo to see it up close.
        </p>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:py-16">
        <GalleryGrid photos={photos} />
      </section>
    </main>
  );
}
