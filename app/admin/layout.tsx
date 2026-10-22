import { redirect } from "next/navigation";
import { requireUserPage } from "@/lib/supabase/requireUser";
import AdminSidebar from "@/components/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await requireUserPage({ roles: ["admin", "staff"] });
  if ("redirect" in result) redirect(result.redirect);
  const { user, profile } = result;

  return (
    <div className="min-h-screen bg-[#FAF7F5] lg:flex">
      <AdminSidebar
        role={profile.role as "admin" | "staff"}
        fullName={profile.full_name ?? ""}
        email={user.email ?? ""}
      />
      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
