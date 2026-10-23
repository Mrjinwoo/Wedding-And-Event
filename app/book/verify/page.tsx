"use client";

import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function BookVerifyPage() {
  return (
    <Suspense>
      <BookVerifyForm />
    </Suspense>
  );
}

// ── Booking OTP Gate ──────────────────────────────────────────────────────────
// Reached when a client tries to confirm a booking but hasn't verified their
// email yet. Flow:
//   1. /book/verify?email=…&venueId=…&next=/dashboard/bookings
//   2. POST /api/auth/send-booking-otp  → code arrives
//   3. POST /api/auth/verify-otp        → session established
//   4. Redirect to ?next (booking form re-submits or redirects back)
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN = 60;

function BookVerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const prefillEmail = searchParams.get("email") ?? "";
  const nextPath = searchParams.get("next") ?? "/dashboard/bookings";
  const venueId = searchParams.get("venueId") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [step, setStep] = useState<"email" | "code">(prefillEmail ? "code" : "email");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-send when email is prefilled
  useEffect(() => {
    if (prefillEmail) {
      sendCode(prefillEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleDigitChange(i: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    setError("");
    if (char && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleDigitKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((c, idx) => { next[idx] = c; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function sendCode(targetEmail: string) {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-booking-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to send code.");
        if (res.status === 429) setCooldown(RESEND_COOLDOWN);
        return;
      }
      if (json.alreadyVerified) {
        // Already logged in with this email — skip straight to the booking
        router.replace(
          venueId ? `${nextPath}?venueId=${venueId}` : nextPath
        );
        return;
      }
      setStep("code");
      setInfo("A 6-digit code has been sent to your email.");
      setCooldown(RESEND_COOLDOWN);
    } finally {
      setSending(false);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    await sendCode(email);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = digits.join("");
    if (token.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, type: "magiclink" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Verification failed.");
        return;
      }
      // Session is now set — redirect back to the booking page
      router.replace(venueId ? `${nextPath}?venueId=${venueId}` : nextPath);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left: form panel ── */}
      <div className="flex flex-col justify-center items-center w-full md:w-1/2 px-8 py-12 bg-[#F5E6EA]">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full overflow-hidden mb-4 shadow-md">
              <Image src="/logo.png" alt="Event Venue Logo" width={80} height={80} className="w-full h-full object-cover" />
            </div>
            <h1 className="font-display text-xl font-bold tracking-widest uppercase text-[#1a1a1a]">Event Venue</h1>
            <p className="font-script text-sm italic text-gray-500 mt-0.5">Make Every Moment Magical</p>
          </div>

          {/* Step: email */}
          {step === "email" && (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Confirm Your Email</h2>
                <p className="text-xs text-gray-500 mt-1">
                  We need to verify your email before confirming your booking. No password required.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Email Address</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✉</span>
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(""); }}
                      required
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending || !email}
                  className="w-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-display text-base font-semibold tracking-wide py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? "Sending…" : "Send Verification Code"}
                </button>
              </form>
            </>
          )}

          {/* Step: code */}
          {step === "code" && (
            <>
              <div className="mb-6">
                <button
                  onClick={() => { setStep("email"); setDigits(["","","","","",""]); setError(""); }}
                  className="text-xs text-gray-500 hover:text-[#9B2C4A] mb-3 flex items-center gap-1"
                >
                  ← Change email
                </button>
                <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Enter the Code</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Sent to <span className="font-medium text-[#1a1a1a]">{email}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}
              {info && !error && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-600">
                  📬 {info}
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-3 text-center">
                    6-Digit Code
                  </label>
                  <div className="flex gap-2 justify-center" onPaste={handleDigitPaste}>
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={el => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={e => handleDigitChange(i, e.target.value)}
                        onKeyDown={e => handleDigitKeyDown(i, e)}
                        className={`w-11 h-13 text-center text-xl font-bold rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent transition-colors
                          ${error ? "border-red-400" : d ? "border-[#9B2C4A]" : "border-gray-300"}`}
                        aria-label={`Digit ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || digits.join("").length < 6}
                  className="w-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-display text-base font-semibold tracking-wide py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying…" : "Confirm & Continue to Booking"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 mt-5">
                Didn&apos;t get it?{" "}
                {cooldown > 0 ? (
                  <span className="text-gray-400">Resend in {cooldown}s</span>
                ) : (
                  <button
                    onClick={() => sendCode(email)}
                    disabled={sending}
                    className="text-[#9B2C4A] hover:underline font-medium disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Right: image panel ── */}
      <div className="hidden md:flex md:w-1/2 relative">
        <Image src="/wed.jpg" alt="Wedding venue" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-br from-[#9B2C4A]/60 to-[#1a1a1a]/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-12 text-center">
          <p className="font-script text-4xl italic mb-3">Almost there</p>
          <p className="font-display text-lg font-semibold tracking-wider uppercase">
            one quick step to lock in your date
          </p>
        </div>
      </div>
    </div>
  );
}
