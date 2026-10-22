import { createClient } from "@/lib/supabase/server";
import GetInTouchButton from "@/components/GetInTouchButton";

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, icon, title, description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <section className="bg-[#F5E6EA] py-14 text-center">
        <h1 className="font-display text-4xl font-bold text-[#1a1a1a]">Our Services</h1>
        <p className="mt-3 text-gray-500 text-sm max-w-md mx-auto">
          Everything you need for a flawless event, all under one roof. We handle the details so you can enjoy the moment.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services?.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col gap-3">
              <span className="text-4xl">{s.icon}</span>
              <h3 className="font-display text-lg font-semibold text-[#1a1a1a]">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed flex-1">{s.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm mb-4">Have a custom event in mind? Let&apos;s talk about it.</p>
          <GetInTouchButton />
        </div>
      </section>
    </main>
  );
}
