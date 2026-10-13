import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "@/components/site/SetPasswordForm";

export const metadata = { title: "Set your password — The Gagrafa" };

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // No session means the link was never opened, or it expired.
  if (!user) redirect("/login?error=link-expired");

  return (
    <div className="container-gagrafa max-w-md py-24">
      <h1 className="text-4xl">Set your password</h1>
      <p className="mt-3 text-navy/60">
        Choose a password for <span className="text-navy">{user.email}</span>. You'll use it to sign in to the admin.
      </p>
      <SetPasswordForm />
    </div>
  );
}
