"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}

// ── How the two-step flow works ───────────────────────────────────────────────
// Step 1 — Enter email  → POST /api/auth/resend-otp  (type: 'signup')
//           (or arrive with ?email= pre-filled from the signup redirect)
// Step 2 — Enter 6-digit code → POST /api/auth/verify-otp → redirect to ?next
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN = 60; // seconds

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?email=  pre-fills the address coming from the signup redirect
  // ?next=   optional destination after verification (defaults to the homepage)
  const prefillEmail = searchParams.get("email") ?? "";
  const nextPath = searchParams.get("next") ?? "/";

  // ── State ──
  const [step, setStep] = useState<"email" | "code">(
    prefillEmail ? "code" : "email"
  );
  const [email, setEmail] = useState(prefillEmail);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // When arriving from /signup with ?email=, Supabase already sent the OTP
  // during signUp() — do NOT call sendCode again or it may invalidate the
  // code the user just received. Just show an info message and the code input.
  useEffect(() => {
    if (prefillEmail) {
      setInfo("A 6-digit code was sent to your email. Enter it below.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cooldown timer ──
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Individual digit inputs ──
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // ── Step 1: send the code ──
  async function sendCode(targetEmail: string) {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, type: "signup" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to send code.");
        if (res.status === 429) setCooldown(RESEND_COOLDOWN);
        return;
      }
      setStep("code");
      setInfo("Check your email — a 6-digit code is on its way.");
      setCooldown(RESEND_COOLDOWN);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    await sendCode(email);
  }

  // ── Step 2: verify the code ──
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
        body: JSON.stringify({ email, token, type: "signup" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Verification failed.");
        return;
      }
      router.push(`${nextPath}?message=email_verified`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // ── Shared layout wrapper ──
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

          {step === "email" ? (
            <>
              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Verify Your Email</h2>
                <p className="text-xs text-gray-500 mt-1">
                  We&apos;ll send a 6-digit code to your address. No password needed.
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
                  disabled={loading || !email}
                  className="w-full bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-display text-base font-semibold tracking-wide py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending…" : "Send Code"}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 mt-6">
                Already have an account?{" "}
                <Link href="/login" className="text-[#9B2C4A] hover:underline font-medium">Log in</Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <button
                  onClick={() => { setStep("email"); setDigits(["","","","","",""]); setError(""); }}
                  className="text-xs text-gray-500 hover:text-[#9B2C4A] mb-3 flex items-center gap-1"
                >
                  ← Change email
                </button>
                <h2 className="font-display text-2xl font-bold text-[#1a1a1a]">Enter Your Code</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Sent to <span className="font-medium text-[#1a1a1a]">{email}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}
              {info && !error && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">{info}</div>
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                {/* 6-digit OTP input grid */}
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-3 text-center">
                    6-Digit Verification Code
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
                        className={`w-11 h-12 text-center text-xl font-bold rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent transition-colors
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
                  {loading ? "Verifying…" : "Verify Email"}
                </button>
              </form>

              {/* Resend */}
              <p className="text-center text-xs text-gray-500 mt-5">
                Didn&apos;t get it?{" "}
                {cooldown > 0 ? (
                  <span className="text-gray-400">Resend in {cooldown}s</span>
                ) : (
                  <button
                    onClick={() => sendCode(email)}
                    disabled={loading}
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
        <Image
          src="/wed.jpg"
          alt="Wedding venue"
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#9B2C4A]/60 to-[#1a1a1a]/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-12 text-center">
          <p className="font-script text-4xl italic mb-3">Your special day</p>
          <p className="font-display text-lg font-semibold tracking-wider uppercase">begins here</p>
        </div>
      </div>
    </div>
  );
}
