"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={signOut} className="mt-auto rounded-lg px-3 py-2.5 text-left text-sm text-ivory/60 hover:bg-ivory/10 hover:text-ivory">
      Sign out
    </button>
  );
}
