"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";

type Props = {
  role: "admin" | "staff";
  fullName: string;
  email: string;
};

const adminLinks = [
  { href: "/admin/queue",     label: "Review Queue", icon: "📥" },
  { href: "/admin",           label: "Dashboard", icon: "🏠" },
  { href: "/admin/users",     label: "Users",     icon: "👥" },
  { href: "/admin/bookings",  label: "Bookings",  icon: "📋" },
  { href: "/admin/venues",    label: "Venues",    icon: "🏛️" },
  { href: "/admin/services",  label: "Services",  icon: "🎉" },
  { href: "/admin/gallery",   label: "Gallery",   icon: "🖼️" },
  { href: "/admin/messages",  label: "Messages",  icon: "💬" },
  { href: "/admin/reports",   label: "Reports",   icon: "📊" },
];

const staffLinks = [
  { href: "/admin/queue",     label: "Review Queue", icon: "📥" },
  { href: "/admin",           label: "Dashboard", icon: "🏠" },
  { href: "/admin/bookings",  label: "Bookings",  icon: "📋" },
  { href: "/admin/venues",    label: "Venues",    icon: "🏛️" },
  { href: "/admin/services",  label: "Services",  icon: "🎉" },
  { href: "/admin/gallery",   label: "Gallery",   icon: "🖼️" },
  { href: "/admin/messages",  label: "Messages",  icon: "💬" },
];

export default function AdminSidebar({ role, fullName, email }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = role === "admin"
    ? [...adminLinks, { href: "/admin/packages", label: "Packages", icon: "📦" }]
    : staffLinks;
  const accent = role === "admin" ? "bg-[#211D1E]" : "bg-[#24202A]";
  const activeAccent = role === "admin" ? "bg-[#A83152]" : "bg-[#7153A1]";

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#EAE6E2] bg-white px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <Image src="/logo.png" alt="" width={36} height={36} className="rounded-full object-cover" />
          <span className="font-display text-sm font-semibold text-[#211D1E]">{role === "admin" ? "Admin workspace" : "Staff workspace"}</span>
        </Link>
        <button type="button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(open => !open)} className="rounded-lg border border-[#EAE6E2] px-3 py-2 text-sm font-semibold text-[#514944]">
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>
      {mobileOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}
      <aside className={`${accent} fixed inset-y-0 left-0 z-40 flex w-[280px] shrink-0 flex-col text-white shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-[264px] lg:translate-x-0 lg:shadow-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-6">
          <Image src="/logo.png" alt="Logo" width={44} height={44} className="shrink-0 rounded-full object-cover ring-2 ring-white/15" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold leading-tight">{role === "admin" ? "Admin workspace" : "Staff workspace"}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider ${role === "admin" ? "bg-[#A83152]/25 text-rose-200" : "bg-violet-300/15 text-violet-100"}`}>
              {role.toUpperCase()}
            </span>
          </div>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Workspace</p>
          {links.map(l => {
            const isActive = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive ? `${activeAccent} text-white shadow-sm` : "text-white/65 hover:bg-white/7 hover:text-white"}`}>
                <span aria-hidden="true" className="w-5 text-center text-base">{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-5">
          <p className="truncate text-sm font-medium text-white">{fullName}</p>
          <p className="mb-4 truncate text-xs text-white/45">{email}</p>
          <LogoutButton className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50" />
        </div>
      </aside>
    </>
  );
}
