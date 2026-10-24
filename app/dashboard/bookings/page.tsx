"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string; event_type: string; event_date: string; guest_count: number;
  total_amount: number; deposit_amount: number | null; payment_deadline: string | null;
  payment_instructions: string | null; status: string; notes: string; created_at: string;
  payment_proof_status: "not_submitted" | "pending" | "rejected" | "verified";
  venues: { name: string; location: string; image_url: string } | null;
  packages: { name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  awaiting_payment: "bg-orange-100 text-orange-700 border-orange-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-600 border-red-200",
  expired:   "bg-gray-100 text-gray-600 border-gray-200",
  completed: "bg-blue-100 text-blue-700 border-blue-200",
};

const STATUS_BAR: Record<string, string> = {
  pending:   "bg-yellow-400",
  awaiting_payment: "bg-orange-500",
  confirmed: "bg-green-500",
  cancelled: "bg-red-400",
  expired:   "bg-gray-400",
  completed: "bg-blue-500",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const BOOKING_STEPS = [
  "Request sent",
  "Venue review",
  "Downpayment",
  "Receipt review",
  "Booking confirmed",
];

function BookingProgress({ booking, onHoldExpired }: { booking: Booking; onHoldExpired?: () => void }) {
  const [holdRemaining, setHoldRemaining] = useState("");
  const [retryingNotice, setRetryingNotice] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
  const isTerminal = booking.status === "cancelled" || booking.status === "expired";
  const isConfirmed = booking.status === "confirmed" || booking.status === "completed";
  const activeStep = booking.status === "pending"
    ? 1
    : booking.status === "awaiting_payment"
      ? booking.payment_proof_status === "pending" ? 3 : 2
      : 4;

  const activeDescription = booking.status === "pending"
    ? "The venue team is reviewing your request. Your date is not held yet."
    : booking.status === "awaiting_payment" && booking.payment_proof_status === "pending"
      ? "Your receipt was submitted. The venue team needs to verify it before confirming your date."
      : booking.status === "awaiting_payment" && booking.payment_proof_status === "rejected"
        ? "Your receipt needs attention. Upload a clearer copy before the payment deadline."
        : booking.status === "awaiting_payment"
          ? "Your request was approved. Pay the downpayment and submit your receipt before the deadline."
          : booking.status === "completed"
            ? "Your event is complete. Thank you for booking with us."
            : "Your downpayment was verified and your booking is confirmed.";

  async function resendUpdate() {
    setRetryingNotice(true);
    setNoticeMessage("");
    try {
      const response = await fetch("/api/bookings/notification-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not resend the update.");
      setNoticeMessage(result.message);
    } catch (retryError) {
      setNoticeMessage(retryError instanceof Error ? retryError.message : "Could not resend the update.");
    } finally {
      setRetryingNotice(false);
    }
  }

  useEffect(() => {
    if (booking.status !== "awaiting_payment" || !booking.payment_deadline) {
      setHoldRemaining("");
      return;
    }

    let refreshedAfterDeadline = false;
    const updateRemaining = () => {
      const milliseconds = new Date(booking.payment_deadline!).getTime() - Date.now();
      if (milliseconds <= 0) {
        setHoldRemaining("Deadline passed");
        if (!refreshedAfterDeadline) {
          refreshedAfterDeadline = true;
          onHoldExpired?.();
        }
        return;
      }
      const totalMinutes = Math.ceil(milliseconds / 60_000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      setHoldRemaining(days > 0 ? `${days}d ${hours}h remaining` : hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`);
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 60_000);
    return () => window.clearInterval(interval);
  }, [booking.payment_deadline, booking.status, onHoldExpired]);

  return (
    <section className="mb-4 rounded-xl border border-gray-100 bg-[#FCFAF9] p-4" aria-label="Booking progress">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-800">Booking progress</h3>
        {booking.status === "awaiting_payment" && booking.payment_deadline && (
          <span className="text-right text-[11px] font-medium text-orange-800">
            Hold expires {new Date(booking.payment_deadline).toLocaleString()}
            {holdRemaining && <span className="block">{holdRemaining}</span>}
          </span>
        )}
      </div>
      <ol className="space-y-2.5">
        {BOOKING_STEPS.map((step, index) => {
          const done = isConfirmed || (index < activeStep && !isTerminal);
          const current = !isTerminal && !isConfirmed && index === activeStep;
          return (
            <li key={step} className="flex items-center gap-2.5">
              <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                done ? "border-green-600 bg-green-600 text-white" : current ? "border-[#9B2C4A] bg-white text-[#9B2C4A]" : "border-gray-300 bg-white text-gray-400"
              }`} aria-hidden="true">
                {done ? "✓" : index + 1}
              </span>
              <span className={`text-xs ${done ? "text-gray-600" : current ? "font-semibold text-[#7A1F38]" : "text-gray-400"}`}>
                {step}{current && <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide">Current</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className={`mt-3 text-xs ${isTerminal ? "text-red-700" : "text-gray-600"}`}>
        {isTerminal
          ? booking.status === "expired" ? "This request expired before the payment deadline." : "This booking request was cancelled."
          : activeDescription}
      </p>
      {!isTerminal && booking.status !== "completed" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void resendUpdate()} disabled={retryingNotice}
            className="text-xs font-semibold text-[#9B2C4A] underline disabled:opacity-50">
            {retryingNotice ? "Resending…" : "Resend booking update"}
          </button>
          {noticeMessage && <span role="status" className="text-xs text-gray-600">{noticeMessage}</span>}
        </div>
      )}
    </section>
  );
}

export default function BookingsPage() {
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError]           = useState("");
  const [view, setView]             = useState<"cards" | "timetable">("cards");
  const [proofFiles, setProofFiles] = useState<Record<string, File | undefined>>({});
  const [proofBusy, setProofBusy]   = useState<string | null>(null);
  const expiryRefreshStarted = useRef(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = filter ? `?status=${filter}` : "";
    try {
      const res = await fetch(`/api/bookings${params}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? `Could not load bookings (HTTP ${res.status}).`);
      }
      setBookings(Array.isArray(json?.data) ? json.data : []);
    } catch (loadError) {
      setBookings([]);
      setError(loadError instanceof Error ? loadError.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void loadBookings(); }, [loadBookings]);

  const refreshAfterHoldExpires = useCallback(() => {
    if (expiryRefreshStarted.current) return;
    expiryRefreshStarted.current = true;
    void loadBookings().finally(() => { expiryRefreshStarted.current = false; });
  }, [loadBookings]);

  async function cancelBooking(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancelling(id); setError("");
    const res  = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: id }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); }
    else { loadBookings(); }
    setCancelling(null);
  }

  async function uploadPaymentProof(bookingId: string) {
    const proof = proofFiles[bookingId];
    if (!proof) return;
    setProofBusy(bookingId);
    setError("");
    try {
      const form = new FormData();
      form.set("bookingId", bookingId);
      form.set("proof", proof);
      const response = await fetch("/api/bookings/payment-proof", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not submit payment proof.");
      setProofFiles(current => { const next = { ...current }; delete next[bookingId]; return next; });
      await loadBookings();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not submit payment proof.");
    } finally {
      setProofBusy(null);
    }
  }

  // Group bookings by month+year for timetable
  const grouped = bookings.reduce<Record<string, Booking[]>>((acc, b) => {
    const d   = new Date(b.event_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort();

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <div className="bg-[#9B2C4A] py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <Link href="/dashboard" className="text-white/70 text-sm hover:text-white">← Dashboard</Link>
          <h1 className="text-white font-display text-2xl font-bold mt-1">My Bookings</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Filter + View toggle */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {["", "pending", "awaiting_payment", "confirmed", "cancelled", "expired", "completed"].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors
                  ${filter === s ? "bg-[#9B2C4A] text-white border-[#9B2C4A]" : "bg-white text-gray-600 border-gray-200 hover:border-[#9B2C4A]"}`}>
                {s === "" ? "All" : s.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase())}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 gap-1">
            <button onClick={() => setView("cards")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5
                ${view === "cards" ? "bg-[#9B2C4A] text-white" : "text-gray-500 hover:text-[#9B2C4A]"}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Cards
            </button>
            <button onClick={() => setView("timetable")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5
                ${view === "timetable" ? "bg-[#9B2C4A] text-white" : "text-gray-500 hover:text-[#9B2C4A]"}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Timetable
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm mb-4">No bookings found.</p>
            <Link href="/venue" className="inline-block bg-[#9B2C4A] text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#7A1F38] transition-colors">
              Browse Venues
            </Link>
          </div>
        ) : view === "cards" ? (

          /* ── Card view ── */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bookings.map(b => (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-display font-semibold text-[#1a1a1a]">{b.event_type}</p>
                      <p className="text-xs text-gray-400">{b.venues?.name} · {b.venues?.location}</p>
                      {b.packages?.name && <p className="mt-1 text-xs font-medium text-[#9B2C4A]">Package: {b.packages.name}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {b.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {b.status === "pending" && <p className="mb-3 text-xs text-yellow-800">Waiting for venue review. Your date is not held until the venue approves the request.</p>}
                  <BookingProgress booking={b} onHoldExpired={refreshAfterHoldExpires} />
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4">
                    <span>📅 {new Date(b.event_date).toLocaleDateString()}</span>
                    <span>👥 {b.guest_count} guests</span>
                    <span>💰 ₱{Number(b.total_amount).toLocaleString()}</span>
                    <span>📌 {new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                  {b.notes && <p className="text-xs text-gray-400 italic mb-3">{b.notes}</p>}
                  {b.status === "awaiting_payment" && (
                    <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
                      <p className="font-semibold">Downpayment required: ₱{Number(b.deposit_amount ?? 0).toLocaleString()} (30%)</p>
                      {b.payment_deadline && <p className="mt-1">Please pay by {new Date(b.payment_deadline).toLocaleString()} to keep this date on hold.</p>}
                      <p className="mt-1">{b.payment_instructions}</p>
                      <Link href="/contact" className="mt-2 inline-block font-semibold underline">Contact the venue to arrange payment</Link>
                      {b.payment_proof_status === "pending" ? (
                        <p className="mt-3 rounded-lg bg-white/70 p-2 font-medium">Receipt submitted. Waiting for venue verification.</p>
                      ) : (
                        <div className="mt-3 rounded-lg bg-white/70 p-3">
                          {b.payment_proof_status === "rejected" && <p className="mb-2 font-medium text-red-700">The receipt could not be verified. You can upload a clearer copy before the deadline.</p>}
                          <label className="block font-medium">Upload payment receipt
                            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setProofFiles(current => ({ ...current, [b.id]: e.target.files?.[0] }))} className="mt-2 block w-full text-xs" />
                          </label>
                          <button type="button" onClick={() => uploadPaymentProof(b.id)} disabled={!proofFiles[b.id] || proofBusy === b.id} className="mt-2 rounded-lg bg-[#9B2C4A] px-3 py-2 font-semibold text-white disabled:opacity-50">
                            {proofBusy === b.id ? "Uploading…" : "Submit receipt for review"}
                          </button>
                          <p className="mt-2 text-[11px]">JPG, PNG, WEBP, or PDF, up to 10 MB. If submission fails, the selected file stays here so you can retry.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(b.status === "pending" || b.status === "awaiting_payment") && (
                    <button onClick={() => cancelBooking(b.id)} disabled={cancelling === b.id}
                      className="w-full py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors disabled:opacity-50">
                      {cancelling === b.id ? "Cancelling…" : "Cancel Booking"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        ) : (

          /* ── Timetable view ── */
          <div className="space-y-8">
            {sortedKeys.map(key => {
              const [year, month] = key.split("-").map(Number);
              const monthBookings = grouped[key].sort(
                (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
              );
              return (
                <div key={key}>
                  {/* Month header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-[#9B2C4A] text-white rounded-xl px-4 py-2 text-center min-w-[72px]">
                      <p className="text-xs font-semibold uppercase tracking-wide">{MONTHS[month]}</p>
                      <p className="text-xl font-bold leading-none">{year}</p>
                    </div>
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">{monthBookings.length} booking{monthBookings.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Timeline entries */}
                  <div className="relative ml-9">
                    {/* Vertical line */}
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />

                    <div className="space-y-4">
                      {monthBookings.map((b, idx) => {
                        const d = new Date(b.event_date);
                        const isLast = idx === monthBookings.length - 1;
                        return (
                          <div key={b.id} className="relative pl-8">
                            {/* Dot on timeline */}
                            <div className={`absolute left-[-4.5px] top-4 w-2.5 h-2.5 rounded-full border-2 border-white ${STATUS_BAR[b.status] ?? "bg-gray-400"}`} />

                            {/* Date label */}
                            <div className={`absolute -left-9 top-2.5 text-center ${isLast ? "" : ""}`}>
                              <p className="text-[10px] font-bold text-[#9B2C4A] leading-none">{String(d.getDate()).padStart(2,"0")}</p>
                              <p className="text-[9px] text-gray-400 uppercase">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]}</p>
                            </div>

                            {/* Card */}
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-display font-semibold text-[#1a1a1a] text-sm">{b.event_type}</p>
                                  <p className="text-xs text-gray-400 truncate">{b.venues?.name}{b.venues?.location ? ` · ${b.venues.location}` : ""}</p>
                                  {b.packages?.name && <p className="mt-1 text-xs font-medium text-[#9B2C4A]">Package: {b.packages.name}</p>}
                                </div>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                                  {b.status.replaceAll("_", " ")}
                                </span>
                              </div>

                              {b.status === "pending" && <p className="mt-3 text-xs text-yellow-800">Waiting for venue review. Your date is not held until approved.</p>}
                              <div className="mt-3"><BookingProgress booking={b} onHoldExpired={refreshAfterHoldExpires} /></div>

                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                                <span>👥 {b.guest_count} guests</span>
                                <span>💰 ₱{Number(b.total_amount).toLocaleString()}</span>
                                {b.notes && <span className="italic text-gray-400 w-full truncate">"{b.notes}"</span>}
                              </div>

                              {b.status === "awaiting_payment" && (
                                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
                                  <p className="font-semibold">Downpayment: ₱{Number(b.deposit_amount ?? 0).toLocaleString()} (30%)</p>
                                  {b.payment_deadline && <p className="mt-1">Due {new Date(b.payment_deadline).toLocaleString()}</p>}
                                  <p className="mt-1">{b.payment_instructions}</p>
                                  <Link href="/contact" className="mt-2 inline-block font-semibold underline">Contact venue</Link>
                                  {b.payment_proof_status === "pending" ? (
                                    <p className="mt-2 rounded-lg bg-white/70 p-2 font-medium">Receipt submitted. Waiting for venue verification.</p>
                                  ) : (
                                    <div className="mt-2 rounded-lg bg-white/70 p-3">
                                      {b.payment_proof_status === "rejected" && <p className="mb-2 font-medium text-red-700">Please upload a clearer receipt before the deadline.</p>}
                                      <label className="block font-medium">Upload payment receipt
                                        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setProofFiles(current => ({ ...current, [b.id]: e.target.files?.[0] }))} className="mt-2 block w-full text-xs" />
                                      </label>
                                      <button type="button" onClick={() => uploadPaymentProof(b.id)} disabled={!proofFiles[b.id] || proofBusy === b.id} className="mt-2 rounded-lg bg-[#9B2C4A] px-3 py-2 font-semibold text-white disabled:opacity-50">
                                        {proofBusy === b.id ? "Uploading…" : "Submit receipt for review"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              {(b.status === "pending" || b.status === "awaiting_payment") && (
                                <button onClick={() => cancelBooking(b.id)} disabled={cancelling === b.id}
                                  className="mt-3 w-full py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors disabled:opacity-50">
                                  {cancelling === b.id ? "Cancelling…" : "Cancel Booking"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
