"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Those passwords don't match.");

    setLoading(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
      <div>
        <label className="text-sm text-navy/60" htmlFor="new-password">New password</label>
        <input
          id="new-password" type="password" required autoComplete="new-password" minLength={8}
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      <div>
        <label className="text-sm text-navy/60" htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password" type="password" required autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3"
        />
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Saving…" : "Save password and continue"}
      </button>
    </form>
  );
}
