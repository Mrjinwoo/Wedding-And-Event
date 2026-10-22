import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Package = {
  id: string;
  name: string;
  price: number;
  guest_capacity: number | null;
  features: string[];
  is_popular: boolean;
};

export default async function PackagePage() {
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from("packages")
    .select("id, name, price, guest_capacity, features, is_popular")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (
    <main className="min-h-screen bg-[#FAF7F5]">
      <section className="bg-[#F5E6EA] py-14 text-center">
        <h1 className="font-display text-4xl font-bold text-[#1a1a1a]">Packages</h1>
        <p className="mt-3 text-gray-500 text-sm max-w-md mx-auto">
          Choose a package for your event. Ask our team about availability or customizing an offer.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-14">
        {!packages?.length ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm border border-gray-100">
            <p className="text-gray-500">Packages are not available right now. Please contact our team.</p>
            <Link href="/contact" className="mt-4 inline-block font-semibold text-[#9B2C4A] hover:underline">Contact us</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {packages.map((pkg: Package) => (
              <div key={pkg.id} className={`relative bg-white rounded-2xl border-2 ${pkg.is_popular ? "border-[#9B2C4A]" : "border-gray-200"} shadow-sm hover:shadow-md transition-shadow overflow-hidden`}>
                {pkg.is_popular && <div className="absolute top-4 right-4"><span className="bg-[#9B2C4A] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Most Popular</span></div>}
                <div className="p-7">
                  <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4 ${pkg.is_popular ? "bg-[#9B2C4A] text-white" : "bg-gray-100 text-gray-600"}`}>{pkg.name}</span>
                  <p className="font-display text-3xl font-bold text-[#1a1a1a] mb-1">₱{Number(pkg.price).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mb-6">per event</p>
                  <ul className="space-y-2.5 mb-8">
                    {pkg.guest_capacity && <li className="flex items-start gap-2 text-sm text-gray-600"><span className="text-[#9B2C4A]">✓</span>Up to {pkg.guest_capacity} guests</li>}
                    {(pkg.features ?? []).map((feature) => <li key={feature} className="flex items-start gap-2 text-sm text-gray-600"><span className="text-[#9B2C4A]">✓</span>{feature}</li>)}
                  </ul>
                  <Link href={`/venue?packageId=${pkg.id}`} className={`block text-center w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${pkg.is_popular ? "bg-[#9B2C4A] hover:bg-[#7A1F38] text-white" : "border border-[#9B2C4A] text-[#9B2C4A] hover:bg-[#9B2C4A] hover:text-white"}`}>
                    Choose a venue
                  </Link>
                  <Link href={`/contact?packageId=${pkg.id}`} className="mt-3 block text-center text-sm font-medium text-gray-500 hover:text-[#9B2C4A]">
                    Ask about this package
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
