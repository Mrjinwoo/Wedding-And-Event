"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function GetInTouchButton() {
  const router = useRouter();

  async function handleClick() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    router.push(session ? "/contact" : "/login?redirect=/contact");
  }

  return (
    <button
      onClick={handleClick}
      className="inline-block bg-[#9B2C4A] hover:bg-[#7A1F38] text-white font-semibold px-8 py-3 rounded-lg transition-colors"
    >
      Get in Touch
    </button>
  );
}
