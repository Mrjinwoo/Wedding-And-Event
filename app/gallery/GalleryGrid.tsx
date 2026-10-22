"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export type GalleryPhoto = {
  id: string;
  title: string;
  category: "wedding" | "reception" | "birthday" | "corporate" | "venue";
  caption: string;
  image_url: string;
};

const CATEGORIES = [
  { value: "all", label: "All photos" },
  { value: "wedding", label: "Weddings" },
  { value: "reception", label: "Receptions" },
  { value: "birthday", label: "Birthdays" },
  { value: "corporate", label: "Corporate" },
  { value: "venue", label: "Venues" },
] as const;

export default function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("all");
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);
  const visiblePhotos = useMemo(
    () => category === "all" ? photos : photos.filter(photo => photo.category === category),
    [category, photos],
  );
  const selectedIndex = selected ? visiblePhotos.findIndex(photo => photo.id === selected.id) : -1;

  function moveSelection(direction: number) {
    if (selectedIndex < 0 || visiblePhotos.length < 2) return;
    setSelected(visiblePhotos[(selectedIndex + direction + visiblePhotos.length) % visiblePhotos.length]);
  }

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const direction = event.key === "ArrowRight" ? 1 : -1;
        setSelected(current => {
          if (!current || visiblePhotos.length < 2) return current;
          const index = visiblePhotos.findIndex(photo => photo.id === current.id);
          return index < 0 ? current : visiblePhotos[(index + direction + visiblePhotos.length) % visiblePhotos.length];
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, visiblePhotos]);

  return (
    <>
      <div className="mb-8 flex flex-wrap justify-center gap-2" aria-label="Filter gallery by event type">
        {CATEGORIES.map(item => (
          <button key={item.value} type="button" onClick={() => setCategory(item.value)}
            aria-pressed={category === item.value}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${category === item.value ? "bg-[#9B2C4A] text-white" : "border border-[#eadde0] bg-white text-[#55464a] hover:border-[#9B2C4A] hover:text-[#9B2C4A]"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {visiblePhotos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {visiblePhotos.map(photo => (
            <button key={photo.id} type="button" onClick={() => setSelected(photo)}
              aria-label={`View ${photo.title}`} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eadde0] text-left shadow-sm">
              <Image src={photo.image_url} alt={photo.title} fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
              <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold text-white drop-shadow">{photo.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#e4d5d9] bg-white px-6 py-16 text-center">
          <p className="font-display text-xl font-semibold text-[#1a1a1a]">Photos coming soon</p>
          <p className="mt-2 text-sm text-gray-500">We&apos;re getting more moments ready for this collection.</p>
        </div>
      )}

      {selected && (
        <div role="dialog" aria-modal="true" aria-label={selected.title}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
          <button type="button" aria-label="Close photo" onClick={() => setSelected(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25">Close ✕</button>
          <button type="button" aria-label="Previous photo" onClick={() => moveSelection(-1)}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-xl text-white hover:bg-white/25">‹</button>
          <figure className="flex max-h-full w-full max-w-5xl flex-col items-center">
            <div className="relative min-h-[45vh] w-full flex-1">
              <Image src={selected.image_url} alt={selected.title} fill unoptimized sizes="100vw" className="object-contain" />
            </div>
            <figcaption className="mt-4 text-center text-white">
              <p className="font-display text-2xl font-semibold">{selected.title}</p>
              {selected.caption && <p className="mt-1 text-sm text-white/75">{selected.caption}</p>}
            </figcaption>
          </figure>
          <button type="button" aria-label="Next photo" onClick={() => moveSelection(1)}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 px-4 py-3 text-xl text-white hover:bg-white/25">›</button>
        </div>
      )}
    </>
  );
}
