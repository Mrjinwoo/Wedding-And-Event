"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function safeNext(raw: string | null, fallback: string): string {
  if (raw?.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

export default function AuthCallbackPage() {
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function completeAuth() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const type = url.searchParams.get("type") ?? fragment.get("type");
      const fallback = type === "recovery"
        ? "/reset-password"
        : type === "invite"
          ? "/set-password"
          : "/";
      const next = safeNext(url.searchParams.get("next"), fallback);
      const supabase = createClient();

      if (url.searchParams.has("error") || fragment.has("error")) {
        setError("This link is invalid, expired, or already used. Request a fresh email link and try again.");
        return;
      }

      let authError: { message: string } | null = null;
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (tokenHash && type) {
        const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        authError = result.error;
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        authError = result.error;
      } else if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        authError = result.error;
      } else {
        authError = { message: "No authentication token was returned." };
      }

      if (authError) {
        console.error("[auth/callback] Could not complete email authentication:", authError.message);
        setError("This link is invalid, expired, or already used. Request a fresh email link and try again.");
        return;
      }

      // A full navigation ensures the newly written auth cookies are sent to
      // the destination page, including the set-password and reset-password flows.
      window.location.replace(next);
    }

    void completeAuth().catch((caught: unknown) => {
      console.error("[auth/callback] Unexpected callback error:", caught);
      setError("We couldn’t verify this link. Request a fresh email link and try again.");
    });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF7F5] px-6 text-center">
      {error ? (
        <section className="max-w-md rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="font-display text-xl font-bold text-[#1a1a1a]">Link verification failed</h1>
          <p className="mt-3 text-sm text-gray-600">{error}</p>
          <Link href="/login" className="mt-6 inline-block rounded-lg bg-[#9B2C4A] px-5 py-2.5 text-sm font-semibold text-white">
            Return to login
          </Link>
        </section>
      ) : (
        <div role="status" className="flex flex-col items-center gap-4 text-gray-600">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#9B2C4A] border-t-transparent" />
          <p>Verifying your link…</p>
        </div>
      )}
    </main>
  );
}
