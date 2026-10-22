"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginPanel from "@/components/LoginPanel";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  function handleSuccess(role: string) {
    if (role === "admin" || role === "staff") router.push("/admin");
    else {
      const requested = searchParams.get("redirect");
      const safeReturnPath = requested?.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/";
      router.push(safeReturnPath);
    }
    router.refresh();
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
            <h1 className="font-display text-xl font-bold tracking-widest uppercase text-[#1a1a1a]">
              Event Venue
            </h1>
            <p className="font-script text-sm italic text-gray-500 mt-0.5">
              Make Every Moment Magical
            </p>
          </div>

          {/* URL-level messages (from auth callback) */}
          {searchParams.get("error") && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {searchParams.get("error") === "auth_callback_failed"
                ? "Something went wrong. Please try again."
                : searchParams.get("error")}
            </div>
          )}
          {searchParams.get("message") === "account_created" && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              ✓ Account created! Please log in.
            </div>
          )}

          {/* Shared login form — no onClose (full-page mode) */}
          <LoginPanel onSuccess={handleSuccess} />

        </div>
      </div>

      {/* ── Right: image panel ── */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
        <Image src="/wed.jpg" alt="Beautiful wedding venue" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        <div className="absolute bottom-16 left-0 right-0 text-center px-10">
          <span className="text-white text-4xl leading-none opacity-60">&ldquo;</span>
          <p className="text-white font-sans text-xl font-light leading-relaxed mt-1">
            We don&apos;t just<br />find venues,
          </p>
          <p className="font-script text-white text-2xl italic mt-1">we create memories.</p>
          <div className="mt-4 text-white text-base opacity-70">♥</div>
        </div>
      </div>
    </div>
  );
}
