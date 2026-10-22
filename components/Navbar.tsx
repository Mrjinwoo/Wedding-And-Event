"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LoginPanel from "@/components/LoginPanel";

const NAV_LINKS = [
  { label: "Home",     href: "/" },
  { label: "Venue",    href: "/venue" },
  { label: "Package",  href: "/package" },
  { label: "Services", href: "/services" },
  { label: "Gallery",  href: "/gallery" },
  { label: "About Us", href: "/about-us" },
  { label: "Contact",  href: "/contact" },
];

const AUTH_PAGES = [
  "/login", "/signup", "/forgot-password",
  "/reset-password", "/verify-email", "/book/verify",
  "/admin", "/dashboard",
];

type Profile = { full_name: string; role: string } | null;
type Notification = { id: string; title: string; body: string; link: string | null; is_read: boolean };

export default function Navbar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [mounted, setMounted] = useState(false);

  const [menuOpen, setMenuOpen]           = useState(false);
  const [profile, setProfile]             = useState<Profile>(null);
  const [unread, setUnread]               = useState(0);
  const [notifOpen, setNotifOpen]         = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loggingOut, setLoggingOut]       = useState(false);
  const [scrolled, setScrolled]           = useState(false);

  // ── Login popup state ──────────────────────────────────────────────────────
  const [loginOpen, setLoginOpen]         = useState(false);

  // Pathname may differ across the server render and browser on protected routes.
  // Keep the initial markup stable and apply route-based hiding after hydration.
  useEffect(() => setMounted(true), []);

  // Refs
  const notifRef    = useRef<HTMLDivElement>(null);
  const headerRef   = useRef<HTMLElement>(null);
  const triggerRef  = useRef<HTMLButtonElement>(null);  // the Login/Register button
  const popupRef    = useRef<HTMLDivElement>(null);

  // ── Scroll detection ────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Load logged-in user ─────────────────────────────────────────────────────
  const loadUser = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfile(null); setUnread(0); return; }
    const { data } = await supabase
      .from("profiles").select("full_name, role").eq("id", user.id).single();
    setProfile(data);
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("is_read", false);
    setUnread(count ?? 0);
  }, []);

  useEffect(() => { loadUser(); }, [pathname, loadUser]);

  // ── Close notification on outside click ────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Close mobile menu on route change ──────────────────────────────────────
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // ── Close login popup on route change ──────────────────────────────────────
  useEffect(() => { setLoginOpen(false); }, [pathname]);

  // ── Scroll lock + scrollbar-gutter when popup is open ──────────────────────
  useEffect(() => {
    if (loginOpen) {
      // scrollbar-gutter: stable prevents header shift when scrollbar disappears
      document.documentElement.style.scrollbarGutter = "stable";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.scrollbarGutter = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.scrollbarGutter = "";
      document.body.style.overflow = "";
    };
  }, [loginOpen]);

  // ── Sync header height into CSS var so popup can position itself ────────────
  useEffect(() => {
    function syncHeight() {
      if (!headerRef.current) return;
      const h = headerRef.current.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--header-h", `${h}px`);
    }
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, [scrolled]); // re-sync when height changes (scrolled changes h-14↔h-16)

  // ── Focus trap inside popup ─────────────────────────────────────────────────
  useEffect(() => {
    if (!loginOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLoginOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !popupRef.current) return;

      const focusable = popupRef.current.querySelectorAll<HTMLElement>(
        'a,button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loginOpen]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function loadNotifications() {
    if (notifOpen) { setNotifOpen(false); return; }
    const res  = await fetch("/api/notifications");
    const json = await res.json();
    setNotifications(json.data ?? []);
    setNotifOpen(true);
  }

  async function openNotification(event: React.MouseEvent<HTMLAnchorElement>, notification: Notification) {
    event.preventDefault();
    setNotifOpen(false);
    if (!notification.is_read) {
      try {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: notification.id }),
        });
        if (response.ok) {
          setNotifications(current => current.map(item => item.id === notification.id ? { ...item, is_read: true } : item));
          setUnread(current => Math.max(0, current - 1));
        }
      } catch {
        // Keep navigation available even when marking the notification fails.
      }
    }
    router.push(notification.link || (profile?.role === "admin" || profile?.role === "staff" ? "/admin" : "/dashboard"));
  }

  async function handleLogout() {
    setLoggingOut(true); setMenuOpen(false); setLoginOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    setProfile(null); setUnread(0);
    router.push("/"); router.refresh();
    setLoggingOut(false);
  }

  function handleLoginSuccess(role: string) {
    setLoginOpen(false);
    if (role === "admin" || role === "staff") router.push("/admin");
    else router.push("/");
    router.refresh();
  }

  // ── Hide on auth pages (AFTER all hooks) ────────────────────────────────────
  if (mounted && AUTH_PAGES.some(p => pathname.startsWith(p))) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const dashboardHref = profile?.role === "admin" ? "/admin" : "/dashboard";
  const isHome        = pathname === "/";
  const transparent   = isHome && !scrolled;

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────
          HEADER — always on top (z-60), never covered by the popup (z-50)
      ───────────────────────────────────────────────────────────────────── */}
      <header
        ref={headerRef}
        className={`sticky top-0 z-60 transition-all duration-500
          ${transparent
            ? "bg-transparent shadow-none"
            : scrolled
              ? "bg-[#FDF8F5]/95 backdrop-blur-md shadow-md"
              : "bg-[#FDF8F5] shadow-sm"
          }`}
        style={{ zIndex: 60 }}
      >
        <nav className={`max-w-7xl mx-auto px-6 flex items-center justify-between gap-4 transition-all duration-500 ${scrolled ? "h-[4.5rem]" : "h-20"}`}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <div className={`rounded-full overflow-hidden shadow transition-all duration-500 ${scrolled ? "w-12 h-12" : "w-14 h-14"}`}>
              <Image src="/logo.png" alt="Wedding and Event Venue" width={56} height={56} className="w-full h-full object-cover" />
            </div>
            <div className="leading-tight hidden sm:block">
              <p className={`font-display text-sm font-bold tracking-wider uppercase transition-colors duration-500 ${transparent ? "text-white nav-shadow" : "text-[#1a1a1a]"}`}>
                Wedding and Event Venue
              </p>
              <p className={`font-script text-xs italic transition-colors duration-500 ${transparent ? "text-white/90 nav-shadow" : "text-[#9B2C4A]"}`}>
                Make Every Moment Magical
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <ul className="hidden lg:flex items-center gap-5 flex-1 justify-center">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link href={href}
                  className={`text-sm font-medium transition-colors relative pb-0.5
                    ${isActive(href)
                      ? `${transparent ? "text-white nav-shadow" : "text-[#9B2C4A]"} after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-current after:rounded`
                      : transparent
                        ? "text-white/95 hover:text-white nav-shadow"
                        : "text-[#3a3a3a] hover:text-[#9B2C4A]"
                    }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {profile ? (
              <>
                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button onClick={loadNotifications} aria-label="Notifications"
                    className={`relative w-9 h-9 flex items-center justify-center rounded-full transition-colors ${transparent ? "hover:bg-white/20" : "hover:bg-gray-100"}`}>
                    <svg className={`w-5 h-5 transition-colors duration-500 ${transparent ? "text-white" : "text-gray-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unread > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-[#9B2C4A] rounded-full text-[9px] text-white flex items-center justify-center font-bold leading-none">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <p className="font-semibold text-sm text-[#1a1a1a]">Notifications</p>
                        <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                        {notifications.length === 0
                          ? <p className="text-center text-gray-400 text-sm py-8">No notifications</p>
                          : notifications.map(n => (
                            <Link key={n.id} href={n.link || "/dashboard"} onClick={event => void openNotification(event, n)} className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${n.is_read ? "" : "bg-[#FAF7F5]"}`}>
                              <p className="text-sm font-medium text-[#1a1a1a]">{n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                            </Link>
                          ))}
                      </div>
                      <div className="px-4 py-2 border-t border-gray-100 text-center">
                        <Link href="/dashboard/messages" onClick={() => setNotifOpen(false)}
                          className="text-xs text-[#9B2C4A] hover:underline font-medium">
                          View all messages →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* User name */}
                <Link href={dashboardHref}
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${transparent ? "hover:bg-white/20" : "hover:bg-gray-100"}`}>
                  <span className="text-base">👤</span>
                  <span className={`text-sm font-medium max-w-24 truncate transition-colors duration-500 ${transparent ? "text-white" : "text-[#1a1a1a]"}`}>
                    {profile.full_name.split(" ")[0]}
                  </span>
                  {profile.role === "admin" && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">Admin</span>
                  )}
                </Link>

                {profile.role !== "admin" && (
                  <Link href="/dashboard/messages"
                    className={`hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${transparent ? "text-white hover:bg-white/20" : "text-[#1a1a1a] hover:bg-gray-100"}`}>
                    Messages
                  </Link>
                )}

                {/* Logout */}
                <button onClick={handleLogout} disabled={loggingOut}
                  className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap
                    ${transparent ? "bg-white/20 hover:bg-white/30 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}>
                  {loggingOut ? "…" : "Logout"}
                </button>
              </>
            ) : (
              /* ── Login / Register toggle button ── */
              <button
                ref={triggerRef}
                onClick={() => setLoginOpen(o => !o)}
                aria-expanded={loginOpen}
                aria-controls="login-popup"
                aria-haspopup="dialog"
                className={`font-body text-sm font-semibold px-5 py-2 rounded-lg transition-colors shadow-sm whitespace-nowrap
                  ${loginOpen
                    ? "bg-[#9B2C4A] text-white"
                    : transparent
                      ? "bg-white/20 hover:bg-white/30 text-white border border-white/40 backdrop-blur-sm"
                      : "bg-[#9B2C4A] hover:bg-[#7A1F38] text-white"
                  }`}
              >
                {loginOpen ? "✕ Close" : "Login / Register"}
              </button>
            )}

            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu" aria-expanded={menuOpen}
              className={`lg:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 rounded-lg transition-colors ${transparent ? "hover:bg-white/20" : "hover:bg-gray-100"}`}>
              <span className={`block h-0.5 w-5 rounded transition-all duration-200 origin-center ${transparent ? "bg-white" : "bg-[#1a1a1a]"} ${menuOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
              <span className={`block h-0.5 w-5 rounded transition-all duration-200 ${transparent ? "bg-white" : "bg-[#1a1a1a]"} ${menuOpen ? "opacity-0 scale-x-0" : ""}`} />
              <span className={`block h-0.5 w-5 rounded transition-all duration-200 origin-center ${transparent ? "bg-white" : "bg-[#1a1a1a]"} ${menuOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        <div className={`lg:hidden overflow-hidden transition-all duration-300 ${menuOpen ? "max-h-screen" : "max-h-0"}`}>
          <div className="bg-[#FDF8F5] border-t border-[#e8d5d5] shadow-md">
            <ul className="flex flex-col py-2">
              {NAV_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} onClick={() => setMenuOpen(false)}
                    className={`flex items-center px-6 py-3 text-sm font-medium transition-colors border-l-4
                      ${isActive(href)
                        ? "text-[#9B2C4A] border-[#9B2C4A] bg-[#F5E6EA]"
                        : "text-[#1a1a1a] border-transparent hover:text-[#9B2C4A] hover:bg-gray-50"
                      }`}>
                    {label}
                  </Link>
                </li>
              ))}
              <li className="border-t border-gray-100 my-1" />
              {profile ? (
                <>
                  <li>
                    <Link href={dashboardHref} onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-[#1a1a1a] border-l-4 border-transparent hover:text-[#9B2C4A] hover:bg-gray-50 transition-colors">
                      <span>👤</span>
                      <span>{profile.full_name.split(" ")[0]}</span>
                      {profile.role === "admin" && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>
                      )}
                    </Link>
                  </li>
                  {profile.role !== "admin" && (
                    <li>
                      <Link href="/dashboard/messages" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-[#1a1a1a] border-l-4 border-transparent hover:text-[#9B2C4A] hover:bg-gray-50 transition-colors">
                        <span>💬</span>
                        Messages
                      </Link>
                    </li>
                  )}
                  <li>
                    <button onClick={handleLogout} disabled={loggingOut}
                      className="flex w-full items-center gap-2 px-6 py-3 text-sm font-medium text-red-500 border-l-4 border-transparent hover:bg-red-50 transition-colors disabled:opacity-50">
                      <span>🚪</span>
                      {loggingOut ? "Logging out…" : "Logout"}
                    </button>
                  </li>
                </>
              ) : (
                <li>
                  <button onClick={() => { setMenuOpen(false); setLoginOpen(true); }}
                    className="flex w-full items-center gap-2 px-6 py-3 text-sm font-semibold text-[#9B2C4A] border-l-4 border-[#9B2C4A] bg-[#F5E6EA]">
                    Login / Register
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────────
          LOGIN POPUP
          - starts at var(--header-h) so the header is never covered
          - overlay is z-50, header is z-60 → header always on top
          - overlay click closes the popup
          - scroll lock is handled in the useEffect above
      ───────────────────────────────────────────────────────────────────── */}
      {loginOpen && (
        <div
          id="login-popup"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in"
          className="fixed inset-0 z-50"
          style={{ top: "var(--header-h, 64px)" }}
        >
          {/* Dim overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => { setLoginOpen(false); triggerRef.current?.focus(); }}
            aria-hidden="true"
          />

          {/* Two-column modal matching the full login page */}
          <div
            ref={popupRef}
            className="relative z-10 flex w-full h-full sm:h-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:top-6 sm:max-w-3xl sm:rounded-2xl sm:overflow-hidden sm:shadow-2xl sm:max-h-[calc(100vh-var(--header-h,64px)-3rem)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Left: form */}
            <div className="flex flex-col justify-center w-full sm:w-1/2 bg-[#F5E6EA] px-8 py-10 overflow-y-auto">
              {/* Logo */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 rounded-full overflow-hidden shadow-md mb-3">
                  <Image src="/logo.png" alt="Event Venue" width={64} height={64} className="w-full h-full object-cover" />
                </div>
                <p className="font-display text-sm font-bold tracking-widest uppercase text-[#1a1a1a]">Event Venue</p>
                <p className="font-script text-xs italic text-gray-500">Make Every Moment Magical</p>
              </div>
              <LoginPanel
                onSuccess={handleLoginSuccess}
                onClose={() => { setLoginOpen(false); triggerRef.current?.focus(); }}
              />
            </div>

            {/* Right: image panel */}
            <div className="hidden sm:flex sm:w-1/2 relative overflow-hidden">
              <Image src="/wed.jpg" alt="Beautiful wedding venue" fill sizes="50vw" className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
              <div className="absolute bottom-12 left-0 right-0 text-center px-8">
                <span className="text-white text-4xl leading-none opacity-60">&ldquo;</span>
                <p className="text-white font-sans text-lg font-light leading-relaxed mt-1">
                  We don&apos;t just<br />find venues,
                </p>
                <p className="font-script text-white text-2xl italic mt-1">we create memories.</p>
                <div className="mt-3 text-white opacity-70">♥</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
