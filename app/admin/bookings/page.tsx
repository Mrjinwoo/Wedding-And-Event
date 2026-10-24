"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string; event_type: string; event_date: string;
  guest_count: number; total_amount: number; deposit_amount: number | null;
  payment_deadline: string | null; status: string;
  created_at: string;
  profiles: { full_name: string } | null;
  venues: { name: string } | null;
  packages: { name: string } | null;
  payment_proof_path: string | null;
  payment_proof_status: "not_submitted" | "pending" | "rejected" | "verified";
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  awaiting_payment: "bg-orange-100 text-orange-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
  completed: "bg-blue-100 text-blue-700",
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canManageBookings, setCanManageBookings] = useState(false);
  const [canDeleteBookings, setCanDeleteBookings] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/admin/bookings?${params}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? `Could not load bookings (HTTP ${res.status}).`);
      }
      setBookings(Array.isArray(json?.data) ? json.data : []);
      setTotal(typeof json?.total === "number" ? json.total : 0);
      setCanManageBookings(json?.canManageBookings === true);
      setCanDeleteBookings(json?.canDeleteBookings === true);
    } catch (loadError) {
      setBookings([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  async function updateStatus(bookingId: string, newStatus: string) {
    setUpdating(bookingId); setError("");
    const res = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, status: newStatus }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else loadBookings();
    setUpdating(null);
  }

  async function reviewPaymentProof(bookingId: string, paymentDecision: "approve" | "reject") {
    setUpdating(bookingId); setError("");
    const res = await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, paymentDecision }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else loadBookings();
    setUpdating(null);
  }

  async function viewPaymentProof(bookingId: string) {
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

  async function deleteBooking(id: string) {
    if (!confirm("Delete this booking permanently?")) return;
    setUpdating(id); setError("");
    const res = await fetch(`/api/admin/bookings?bookingId=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else loadBookings();
    setUpdating(null);
  }

  const totalPages = Math.ceil(total / 10);

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <div className="bg-[#1a1a1a] py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <Link href="/admin" className="text-white/60 text-sm hover:text-white">← Admin</Link>
          <h1 className="text-white font-display text-2xl font-bold mt-1">Booking Management</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by event type…"
            className="flex-1 min-w-48 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]" />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A]">
            <option value="">All Statuses</option>
            {["pending","awaiting_payment","confirmed","cancelled","expired","completed"].map(s => (
              <option key={s} value={s}>{s.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase())}</option>
            ))}
          </select>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Guest", "Venue", "Event", "Date", "Guests", "Price", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? Array.from({length:5}).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
              )) : bookings.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No bookings found.</td></tr>
              ) : bookings.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1a1a1a]">{b.profiles?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{b.venues?.name ?? "—"}{b.packages?.name && <span className="block text-xs text-[#9B2C4A]">{b.packages.name}</span>}</td>
                  <td className="px-4 py-3 text-gray-700">{b.event_type}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(b.event_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{b.guest_count}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">₱{Number(b.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {b.status.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase())}
                    </span>
                    {b.status === "pending" && canManageBookings && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <button onClick={() => updateStatus(b.id, "awaiting_payment")} disabled={updating === b.id}
                          className="text-left text-xs font-semibold text-[#9B2C4A] hover:underline disabled:opacity-50">
                          Approve · request 30% downpayment
                        </button>
                        <button onClick={() => updateStatus(b.id, "cancelled")} disabled={updating === b.id}
                          className="text-left text-xs text-gray-500 hover:underline disabled:opacity-50">Decline request</button>
                      </div>
                    )}
                    {b.status === "awaiting_payment" && canManageBookings && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <span className="text-xs text-gray-500">Deposit: ₱{Number(b.deposit_amount ?? 0).toLocaleString()}</span>
                        {b.payment_deadline && <span className="text-xs text-gray-500">Due: {new Date(b.payment_deadline).toLocaleString()}</span>}
                        {b.payment_proof_status === "pending" && b.payment_proof_path ? (
                          <>
                            <button onClick={() => viewPaymentProof(b.id)} className="text-left text-xs font-semibold text-[#9B2C4A] hover:underline">View uploaded receipt</button>
                            <button onClick={() => reviewPaymentProof(b.id, "approve")} disabled={updating === b.id} className="text-left text-xs font-semibold text-green-700 hover:underline disabled:opacity-50">Verify receipt and confirm</button>
                            <button onClick={() => reviewPaymentProof(b.id, "reject")} disabled={updating === b.id} className="text-left text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">Reject receipt</button>
                          </>
                        ) : b.payment_proof_status === "rejected" ? (
                          <span className="text-xs text-red-600">Receipt rejected; customer may resubmit.</span>
                        ) : b.payment_proof_status === "not_submitted" ? (
                          <span className="text-xs text-gray-500">Waiting for customer payment proof.</span>
                        ) : null}
                        {b.payment_proof_status !== "pending" && (
                          <button onClick={() => updateStatus(b.id, "confirmed")} disabled={updating === b.id}
                            className="text-left text-xs font-semibold text-green-700 hover:underline disabled:opacity-50">
                            Mark deposit received manually
                          </button>
                        )}
                        <button onClick={() => updateStatus(b.id, "cancelled")} disabled={updating === b.id}
                          className="text-left text-xs text-gray-500 hover:underline disabled:opacity-50">Cancel hold</button>
                      </div>
                    )}
                    {b.status === "confirmed" && canManageBookings && (
                      <button onClick={() => updateStatus(b.id, "completed")} disabled={updating === b.id}
                        className="mt-2 block text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50">Mark completed</button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canDeleteBookings && <button onClick={() => deleteBooking(b.id)} disabled={updating === b.id}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50">
                      Delete
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#9B2C4A] disabled:opacity-40">← Prev</button>
            <span className="px-4 py-2 text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#9B2C4A] disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </main>
  );
}
