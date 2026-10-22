"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type VenueOption = { id: string; name: string };
type PackageOption = { id: string; name: string; price: number };

export default function ContactPage() {
  const [customerDetails, setCustomerDetails] = useState({ name: "", email: "", phone: "" });
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    venueId: "",
    packageId: "",
    eventType: "",
    eventDate: "",
    guests: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [error, setError] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    const requestedVenueId = new URLSearchParams(window.location.search).get("venueId") ?? "";
    const requestedPackageId = new URLSearchParams(window.location.search).get("packageId") ?? "";
    if (requestedVenueId || requestedPackageId) setForm(prev => ({ ...prev, venueId: requestedVenueId || prev.venueId, packageId: requestedPackageId || prev.packageId }));

    fetch("/api/venues?limit=100")
      .then(response => response.json())
      .then(result => setVenues((result.data ?? []).map((venue: VenueOption) => ({ id: venue.id, name: venue.name }))))
      .catch(() => setError("Could not load venues. Please refresh and try again."));

    createClient().from("packages").select("id, name, price").eq("is_active", true).order("sort_order")
      .then(({ data }) => setPackages((data ?? []) as PackageOption[]));

    const supabase = createClient();

    async function prefillCustomerDetails(user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]) {
      if (!user) return;
      try {
        const { data: profile } = await supabase
          .from("profiles").select("full_name, phone").eq("id", user.id).single();
        const metadataName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
        const metadataPhone = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : "";
        const details = {
          name: profile?.full_name || metadataName,
          email: user.email || "",
          phone: profile?.phone || metadataPhone,
        };
        setCustomerDetails(details);
        setForm(prev => ({
          ...prev,
          name: prev.name || details.name,
          email: prev.email || details.email,
          phone: prev.phone || details.phone,
        }));
      } catch {
        // The customer can enter these details manually.
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => prefillCustomerDetails(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) setTimeout(() => void prefillCustomerDetails(user), 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // Inquiries are saved as messages so the customer can continue the thread.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setRequiresLogin(false);
    if (!form.venueId && !form.packageId) {
      setError("Choose a venue or a package for your inquiry.");
      return;
    }
    setVerifying(true);

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          venueId: form.venueId || undefined,
          packageId: form.packageId || undefined,
          guests: form.guests ? Number(form.guests) : undefined,
          eventDate: form.eventDate || undefined,
        }),
      });
      const result = await response.json();

      if (response.status === 401) {
        setRequiresLogin(true);
        setError("Log in to send this inquiry and continue the conversation in Messages.");
        return;
      }
      if (!response.ok) {
        setError(result.error ?? "We couldn't send your inquiry. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      {/* Page header */}
      <section className="bg-[#F5E6EA] py-14 text-center">
        <h1 className="font-display text-4xl font-bold text-[#1a1a1a]">Contact Us</h1>
        <p className="mt-3 text-gray-500 text-sm max-w-md mx-auto">
          Ready to plan your perfect event? Reach out and our team will get back to you within 24 hours.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-3 gap-10">

        {/* ── Contact info ── */}
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#1a1a1a] mb-4">
              Get in Touch
            </h2>
            <div className="space-y-4">
              {[
                { icon: "📍", label: "Address",  value: "123 Event Drive, Cebu City, Cebu 6000" },
                { icon: "📞", label: "Phone",    value: "+63 975 940 3511" },
                { icon: "✉",  label: "Email",    value: "hello@weddingeventvenue.ph" },
                { icon: "🕐", label: "Hours",    value: "Mon – Sat, 9:00 AM – 12:00 PM" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-[#9B2C4A] uppercase tracking-wide">
                      {item.label}
                    </p>
                    <p className="text-sm text-gray-600">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social */}
          <div>
            <p className="text-xs font-semibold text-[#9B2C4A] uppercase tracking-wide mb-3">
              Follow Us
            </p>
            <div className="flex gap-3">
              {["Facebook", "Instagram", "TikTok"].map((s) => (
                <span
                  key={s}
                  className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-[#9B2C4A] hover:text-[#9B2C4A] cursor-pointer transition-colors"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Inquiry form ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {submitted ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <span className="text-5xl mb-4">💌</span>
              <h3 className="font-display text-2xl font-semibold text-[#1a1a1a] mb-2">
                Message Received!
              </h3>
              <p className="text-gray-500 text-sm max-w-xs">
                Your inquiry has been sent to the venue team. Continue the conversation from Messages.
              </p>
              <Link href="/dashboard/messages" className="mt-5 inline-block rounded-lg bg-[#9B2C4A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#7A1F38]">
                Continue to Messages
              </Link>
              <button
                onClick={() => { setSubmitted(false); setForm({ ...customerDetails, venueId: "", packageId: "", eventType: "", eventDate: "", guests: "", message: "" }); }}
                className="mt-6 text-sm text-[#9B2C4A] hover:underline font-medium"
              >
                Send another inquiry
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-[#1a1a1a] mb-6">
                Send an Inquiry
              </h2>
              <p className="-mt-4 mb-5 text-sm text-gray-500">
                Ask about availability, pricing, or event details. This does not reserve the date or require payment. Log in to send the inquiry and continue the conversation in Messages.
              </p>
              {error && (
                <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p>{error}</p>
                  {requiresLogin && <Link href="/login" target="_blank" className="mt-1 inline-block font-semibold underline">Open login in a new tab</Link>}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Venue (optional)</label>
                    <select
                      name="venueId" value={form.venueId} onChange={handleChange}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent text-gray-600"
                    >
                      <option value="">Select a venue</option>
                      {venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Package (optional)</label>
                    <select
                      name="packageId" value={form.packageId} onChange={handleChange}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent text-gray-600"
                    >
                      <option value="">Select a package</option>
                      {packages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name} — ₱{Number(pkg.price).toLocaleString()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                    <input
                      type="text" name="name" autoComplete="name" required value={form.name} onChange={handleChange}
                      placeholder="Your full name"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email Address *</label>
                    <input
                      type="email" name="email" autoComplete="email" required value={form.email} onChange={handleChange}
                      placeholder="your@email.com"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
                    <input
                      type="tel" name="phone" autoComplete="tel" value={form.phone} onChange={handleChange}
                      placeholder="+63 9xx xxx xxxx"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Event Type *</label>
                    <select
                      name="eventType" required value={form.eventType} onChange={handleChange}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent text-gray-600"
                    >
                      <option value="">Select event type</option>
                      <option>Wedding</option>
                      <option>Birthday / Debut</option>
                      <option>Corporate Event</option>
                      <option>Graduation Party</option>
                      <option>Reception / Gala</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Event Date</label>
                    <input
                      type="date" name="eventDate" value={form.eventDate} onChange={handleChange}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Expected Guests</label>
                    <input
                      type="number" name="guests" min="1" max="1000" value={form.guests} onChange={handleChange}
                      placeholder="e.g. 200"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                  <textarea
                    name="message" required maxLength={500} value={form.message} onChange={handleChange} rows={4}
                    placeholder="Tell us more about your event vision..."
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full py-3 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifying ? "Sending inquiry…" : "Send Inquiry"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
