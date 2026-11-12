import { AdminNav } from "@/components/admin/AdminNav";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { getCurrentProfile } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-sand md:flex print:block print:min-h-0 print:bg-white">
      {/* The menu and tabs are left off printed pages (receipts). */}
      <div className="contents print:hidden">
        <AdminNav role={profile?.role} />
      </div>
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10 print:p-0">
        <div className="contents print:hidden">
          <SectionTabs role={profile?.role} />
        </div>
        {children}
      </div>
    </div>
  );
}
