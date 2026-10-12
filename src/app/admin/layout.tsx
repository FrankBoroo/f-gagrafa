import { AdminNav } from "@/components/admin/AdminNav";
import { getCurrentProfile } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-sand md:flex">
      <AdminNav role={profile?.role} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
