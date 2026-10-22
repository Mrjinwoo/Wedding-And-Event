"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type BookingItem = {
  id: string;
  event_type: string;
  event_date: string;
  guest_count?: number;
  total_amount?: number;
  deposit_amount?: number | null;
  payment_deadline?: string | null;
  payment_proof_path?: string | null;
  status?: string;
  created_at?: string;
  profiles: { full_name: string } | null;
  venues: { name: string } | null;
  packages?: { name: string } | null;
};

type InquiryItem = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  venue: { name: string } | null;
  package: { name: string } | null;
  sender: { full_name: string } | null;
};

type QueueData = {
  canManageBookings: boolean;
  requests: { items: BookingItem[]; count: number };
  paymentReviews: { items: BookingItem[]; count: number };
  overdueBookings: { items: BookingItem[]; count: number };
  inquiries: { items: InquiryItem[]; count: number };
};

type QueueTab = "requests" | "payments" | "inquiries" | "overdue";

const TABS: { id: QueueTab; label: string; icon: string }[] = [
  { id: "requests", label: "New requests", icon: "📋" },
  { id: "payments", label: "Payment receipts", icon: "🧾" },
  { id: "inquiries", label: "Inquiries", icon: "💬" },
  { id: "overdue", label: "Overdue holds", icon: "⏰" },
];

function formatDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString();
}

function QueueBookingCard({ booking, children }: { booking: BookingItem; children?: ReactNode }) {
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{booking.event_type} · {booking.profiles?.full_name ?? "Customer"}</h3>
          <p className="mt-1 text-sm text-gray-500">{booking.venues?.name ?? "Venue"}{booking.packages?.name ? ` · ${booking.packages.name}` : ""}</p>
          <p className="mt-1 text-xs text-gray-500">Event date: {formatDate(booking.event_date)}{booking.guest_count ? ` · ${booking.guest_count} guests` : ""}</p>
        </div>
        {booking.total_amount !== undefined && (
          <span className="text-sm font-semibold text-[#9B2C4A]">₱{Number(booking.total_amount).toLocaleString()}</span>
        )}
      </div>
      {children && <div className="mt-4 border-t border-gray-100 pt-3">{children}</div>}
    </article>
  );
}

export default function AdminReviewQueuePage() {
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [tab, setTab] = useState<QueueTab>("requests");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/queue");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load the review queue.");
      setQueue(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the review queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some(item => item.id === requestedTab)) setTab(requestedTab as QueueTab);
  }, [loadQueue]);

  async function updateBooking(bookingId: string, status: "awaiting_payment" | "cancelled") {
    setBusyId(bookingId);
    setError("");
    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update this booking.");
      await loadQueue();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update this booking.");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewReceipt(bookingId: string, paymentDecision: "approve" | "reject") {
    setBusyId(bookingId);
    setError("");
    try {
      const response = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, paymentDecision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not review this receipt.");
      await loadQueue();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not review this receipt.");
    } finally {
      setBusyId(null);
    }
  }

  async function openReceipt(bookingId: string) {
    const preview = window.open("about:blank", "_blank");
    if (preview) preview.opener = null;
    const response = await fetch(`/api/admin/bookings/payment-proof?bookingId=${encodeURIComponent(bookingId)}`);
    const result = await response.json();
    if (!response.ok || !result.signedUrl) {
      preview?.close();
      setError(result.error ?? "Could not open the payment receipt.");
      return;
    }
    if (preview) preview.location.href = result.signedUrl;
    else window.location.href = result.signedUrl;
  }

  const counts: Record<QueueTab, number> = {
    requests: queue?.requests.count ?? 0,
    payments: queue?.paymentReviews.count ?? 0,
    inquiries: queue?.inquiries.count ?? 0,
    overdue: queue?.overdueBookings.count ?? 0,
  };

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <header className="bg-[#1a1a1a] px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-2xl font-bold text-white">Review Queue</h1>
          <p className="mt-1 text-sm text-white/60">New booking requests, payment receipts, inquiries, and expired payment holds.</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TABS.map(item => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${tab === item.id ? "border-[#9B2C4A] bg-[#9B2C4A] text-white" : "border-gray-100 bg-white text-gray-800 hover:border-[#9B2C4A]/40"}`}>
              <span className="text-xl" aria-hidden="true">{item.icon}</span>
              <span className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold">
                {item.label}<span className={`rounded-full px-2 py-0.5 text-xs ${tab === item.id ? "bg-white/20" : "bg-gray-100 text-gray-600"}`}>{counts[item.id]}</span>
              </span>
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-gray-900">{TABS.find(item => item.id === tab)?.label}</h2>
              <p className="mt-0.5 text-xs text-gray-500">{counts[tab]} item{counts[tab] === 1 ? "" : "s"} waiting for attention</p>
            </div>
            <button type="button" onClick={() => void loadQueue()} disabled={loading} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-[#9B2C4A] disabled:opacity-50">
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {loading && !queue ? (
            <div className="space-y-3">{[1, 2, 3].map(row => <div key={row} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}</div>
          ) : tab === "requests" ? (
            <div className="space-y-3">
              {(queue?.requests.items ?? []).length === 0 ? <p className="py-8 text-center text-sm text-gray-400">No new booking requests.</p> : queue?.requests.items.map(booking => (
                <QueueBookingCard key={booking.id} booking={booking}>
                  {queue?.canManageBookings ? (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void updateBooking(booking.id, "awaiting_payment")} disabled={busyId === booking.id} className="rounded-lg bg-[#9B2C4A] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve · request 30% downpayment</button>
                      <button onClick={() => void updateBooking(booking.id, "cancelled")} disabled={busyId === booking.id} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 disabled:opacity-50">Decline</button>
                    </div>
                  ) : <p className="text-xs text-gray-500">Admin approval is required to update booking status.</p>}
                </QueueBookingCard>
              ))}
            </div>
          ) : tab === "payments" ? (
            <div className="space-y-3">
              {(queue?.paymentReviews.items ?? []).length === 0 ? <p className="py-8 text-center text-sm text-gray-400">No payment receipts need review.</p> : queue?.paymentReviews.items.map(booking => (
                <QueueBookingCard key={booking.id} booking={booking}>
                  <p className="mb-3 text-xs text-gray-600">Downpayment: ₱{Number(booking.deposit_amount ?? 0).toLocaleString()} · Event: {formatDate(booking.event_date)}</p>
                  <div className="flex flex-wrap gap-2">
                    {booking.payment_proof_path && <button onClick={() => void openReceipt(booking.id)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-[#9B2C4A]">View receipt</button>}
                    {queue?.canManageBookings && <>
                      <button onClick={() => void reviewReceipt(booking.id, "approve")} disabled={busyId === booking.id} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Verify and confirm</button>
                      <button onClick={() => void reviewReceipt(booking.id, "reject")} disabled={busyId === booking.id} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Reject receipt</button>
                    </>}
                  </div>
                  {!queue?.canManageBookings && <p className="mt-2 text-xs text-gray-500">Admin approval is required to verify payment.</p>}
                </QueueBookingCard>
              ))}
            </div>
          ) : tab === "inquiries" ? (
            <div className="space-y-3">
              {(queue?.inquiries.items ?? []).length === 0 ? <p className="py-8 text-center text-sm text-gray-400">No unread inquiries.</p> : queue?.inquiries.items.map(inquiry => (
                <article key={inquiry.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{inquiry.sender?.full_name ?? "Customer"}</h3>
                      <p className="mt-1 text-sm text-[#9B2C4A]">{[inquiry.venue?.name, inquiry.package?.name].filter(Boolean).join(" · ") || "General inquiry"}</p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-gray-600">{inquiry.content}</p>
                    </div>
                    <Link href={`/admin/messages?userId=${encodeURIComponent(inquiry.sender_id)}`} className="shrink-0 rounded-lg bg-[#9B2C4A] px-3 py-2 text-xs font-semibold text-white">Open conversation</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(queue?.overdueBookings.items ?? []).length === 0 ? <p className="py-8 text-center text-sm text-gray-400">No overdue payment holds.</p> : queue?.overdueBookings.items.map(booking => (
                <QueueBookingCard key={booking.id} booking={booking}>
                  <p className="text-xs font-medium text-amber-800">{booking.status === "expired" ? "Hold expired" : "Payment deadline passed; hold is awaiting expiry processing"}{booking.payment_deadline ? ` · ${new Date(booking.payment_deadline).toLocaleString()}` : ""}</p>
                </QueueBookingCard>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
