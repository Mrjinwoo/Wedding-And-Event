"use client";

/**
 * LoginPanel — the two-step login form (credentials → OTP).
 *
 * Shared by:
 *   - LoginPopup  in Navbar (popup mode, header stays visible)
 *   - /login page (full-page mode)
 *
 * Props:
 *   onSuccess   called after a successful login with the user's role
 *   onClose     optional — show a close button (popup mode)
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LoginPanelProps {
  onSuccess?: (role: string) => void;
  onClose?: () => void;
}

const RESEND_COOLDOWN = 60;

export default function LoginPanel({ onSuccess, onClose }: LoginPanelProps) {
  const router = useRouter();

  const [step, setStep] = useState<"credentials" | "otp">("credentials");

  // Step 1
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);

  // Step 2
  const [digits, setDigits]     = useState(["", "", "", "", "", ""]);
  const [stepToken, setStepToken] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Shared
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "otp") setTimeout(() => inputRefs.current[0]?.focus(), 80);
  }, [step]);

  // ── Digit helpers ───────────────────────────────────────────────────────────
  function handleDigitChange(i: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = char; setDigits(next);
    setError("");
    if (char && i < 5) inputRefs.current[i + 1]?.focus();
  }
  function handleDigitKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus();
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

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error?.toLowerCase().includes("verify your email")) {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`);
          onClose?.();
          return;
        }
        setError(json.error ?? "Invalid email or password.");
        return;
      }
      setStepToken(json.stepToken);
      setStep("otp");
      setInfo(`A 6-digit code was sent to ${email}`);
      setCooldown(RESEND_COOLDOWN);
    } finally {
      setLoading(false);
    }
  }

  // ── Resend ──────────────────────────────────────────────────────────────────
  async function handleResend() {
    setDigits(["", "", "", "", "", ""]); setError(""); setInfo(""); setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email, options: { shouldCreateUser: false },
      });
      if (err) { setError(err.message); return; }
      setInfo("A new code has been sent.");
      setCooldown(RESEND_COOLDOWN);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 ──────────────────────────────────────────────────────────────────
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const token = digits.join("");
    if (token.length < 6) { setError("Please enter all 6 digits."); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, stepToken }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setStep("credentials");
          setDigits(["", "", "", "", "", ""]);
          setStepToken("");
          setError("Session expired. Please enter your password again.");
        } else {
          setError(json.error ?? "Verification failed.");
        }
        return;
      }
      const role = json.role ?? "client";
      if (onSuccess) {
        onSuccess(role);
      } else {
        if (role === "admin" || role === "staff") router.push("/admin");
        else router.push("/");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("credentials");
    setDigits(["", "", "", "", "", ""]);
    setStepToken(""); setError(""); setInfo(""); setCooldown(0);
  }

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputCls =
    "w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400";

  return (
    <div className="w-full">
      {/* Close button (popup mode only) */}
      {onClose && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            aria-label="Close login panel"
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Step 1: credentials ── */}
      {step === "credentials" && (
        <>
          <div className="mb-5">
            <h2 className="font-display text-xl font-bold text-[#1a1a1a]">Welcome Back</h2>
            <p className="text-xs text-gray-500 mt-1">
              Enter your credentials — we&apos;ll send a verification code.
            </p>
          </div>

          {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

          <form onSubmit={handleCredentials} className="space-y-3.5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✉</span>
                <input
                  type="email" placeholder="Enter your email" value={email} required
                  autoComplete="email"
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                <input
                  type={showPw ? "text" : "password"} placeholder="Enter your password"
                  value={password} required autoComplete="current-password"
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent placeholder-gray-400"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs font-medium text-[#9B2C4A] hover:underline">
                Forgot Password?
              </Link>
            </div>

            <button type="submit" disabled={loading || !email || !password}
              className="w-full py-2.5 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Sending code…</>
              ) : "Continue"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/signup" onClick={onClose} className="font-medium text-[#9B2C4A] hover:underline">Sign Up</Link>
          </p>
        </>
      )}

      {/* ── Step 2: OTP ── */}
      {step === "otp" && (
        <>
          <div className="mb-5">
            <button onClick={handleBack}
              className="text-xs text-gray-500 hover:text-[#9B2C4A] mb-2 flex items-center gap-1 transition-colors">
              ← Different account
            </button>
            <h2 className="font-display text-xl font-bold text-[#1a1a1a]">Check Your Email</h2>
            <p className="text-xs text-gray-500 mt-1">
              Code sent to <span className="font-medium text-[#1a1a1a]">{email}</span>
            </p>
          </div>

          {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          {info && !error && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">{info}</div>}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-3 text-center">
                Enter the 6-digit code
              </label>
              <div className="flex gap-2 justify-center" onPaste={handleDigitPaste}>
                {digits.map((d, i) => (
                  <input key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text" inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={1} value={d}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    aria-label={`Digit ${i + 1}`}
                    className={`w-11 h-12 text-center text-xl font-bold rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#9B2C4A] focus:border-transparent transition-colors ${error ? "border-red-400" : d ? "border-[#9B2C4A]" : "border-gray-300"}`}
                  />
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading || digits.join("").length < 6}
              className="w-full py-2.5 rounded-lg bg-[#9B2C4A] hover:bg-[#7A1F38] disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Verifying…</>
              ) : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-4">
            Didn&apos;t get it?{" "}
            {cooldown > 0
              ? <span className="text-gray-400">Resend in {cooldown}s</span>
              : <button onClick={handleResend} disabled={loading}
                  className="text-[#9B2C4A] hover:underline font-medium disabled:opacity-50">
                  Resend code
                </button>
            }
          </p>
        </>
      )}
    </div>
  );
}
