"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

const QUICK_LINKS = [
  { label: "Home",     href: "/" },
  { label: "Venue",    href: "/venue" },
  { label: "Package",  href: "/package" },
  { label: "Gallery",  href: "/gallery" },
  { label: "About Us", href: "/about-us" },
  { label: "Contact",  href: "/contact" },
];

const SERVICES = [
  { label: "Weddings",          href: "/services" },
  { label: "Debuts & Birthdays", href: "/services" },
  { label: "Corporate Events",  href: "/services" },
  { label: "Receptions & Galas",href: "/services" },
  { label: "Floral & Décor",    href: "/services" },
  { label: "Photo & Video",     href: "/services" },
];

const SOCIALS = [
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => setMounted(true), []);

  if (mounted && (AUTH_PAGES.some(p => pathname.startsWith(p)) || pathname.startsWith("/admin") || pathname.startsWith("/dashboard"))) return null;

  return (
    <footer className="bg-[#1a1a1a] text-white mt-auto">
      {/* ── Main footer content ── */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* ── Column 1: Brand ── */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden shadow-md flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="Wedding and Event Venue Logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="leading-tight">
                <p className="font-display text-sm font-bold tracking-wider uppercase text-white">
                  Wedding and Event Venue
                </p>
                <p className="font-script text-xs italic text-gray-400">
                  Make Every Moment Magical
                </p>
              </div>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Cebu City&apos;s premier event venue, crafting unforgettable celebrations for over a decade.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#9B2C4A] flex items-center justify-center transition-colors duration-200"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* ── Column 2: Quick Links ── */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white mb-5">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {QUICK_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-gray-400 hover:text-[#9B2C4A] text-sm transition-colors duration-200 flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-[#9B2C4A] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Column 3: Services ── */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white mb-5">
              Our Services
            </h3>
            <ul className="space-y-3">
              {SERVICES.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-gray-400 hover:text-[#9B2C4A] text-sm transition-colors duration-200 flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-[#9B2C4A] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Column 4: Contact ── */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-white mb-5">
              Contact Us
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="text-[#9B2C4A] mt-0.5 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <span className="text-gray-400 text-sm leading-relaxed">
                  123 Event Drive,<br />Cebu City, Cebu 6000
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[#9B2C4A] flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <a href="tel:+639171234567" className="text-gray-400 hover:text-[#9B2C4A] text-sm transition-colors">
                  +63 975 940 3511
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[#9B2C4A] flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <a href="mailto:hello@weddingeventvenue.ph"
                  className="text-gray-400 hover:text-[#9B2C4A] text-sm transition-colors">
                  hello@weddingeventvenue.ph
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[#9B2C4A] flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span className="text-gray-400 text-sm">Mon – Sat, 9:00 AM – 12:00 PM</span>
              </li>
            </ul>

            {/* Book now CTA */}
            <Link
              href="/contact"
              className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Book an Event →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-500 text-xs text-center sm:text-left">
            © {currentYear} Wedding and Event Venue. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
              Terms of Service
            </Link>
            <span className="text-gray-700">·</span>
            <Link href="/privacy" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
              Privacy Policy
            </Link>
            <span className="text-gray-700">·</span>
            <Link href="/contact" className="text-gray-500 hover:text-gray-300 text-xs transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
