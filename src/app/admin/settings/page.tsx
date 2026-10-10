import { createServiceClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { isAdmin } from "@/lib/auth";

export default async function AdminSettingsPage() {
  if (!(await isAdmin())) {
    return (
      <div>
        <h1 className="text-3xl">Settings</h1>
        <p className="mt-4 text-sm text-navy/50">Only admins can view property settings.</p>
      </div>
    );
  }

  const supabase = createServiceClient();
  const { data: settings } = await supabase.from("property_settings").select("*").limit(1).maybeSingle();

  if (!settings) {
    return (
      <div>
        <h1 className="text-3xl">Settings</h1>
        <p className="mt-4 max-w-xl text-sm text-navy/50">
          No settings row found. Run the <code>property_settings</code> table creation
          (with its seed insert) from <code>supabase/schema.sql</code> in your Supabase
          SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl">Settings</h1>
      <div className="mt-8 max-w-xl">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
