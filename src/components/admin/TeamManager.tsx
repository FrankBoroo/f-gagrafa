"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { asResult } from "@/lib/action-result";
import { inviteTeamMember, newSignInLink, changeTeamRole, removeTeamAccess } from "@/app/admin/team/actions";

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "staff";
  lastSignIn: string | null;
}

type LinkResult = { link: string; emailAttempted: boolean; who: string };

export function TeamManager({ members, currentUserId }: { members: TeamMember[]; currentUserId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [issued, setIssued] = useState<LinkResult | null>(null);

  function invite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = asResult<{ link: string; emailAttempted: boolean }>(await inviteTeamMember({ email, fullName, role }));
      if (!result.ok || !result.link) return toast.error(result.error ?? "Could not create the invitation");
      setIssued({ link: result.link, emailAttempted: Boolean(result.emailAttempted), who: email });
      setEmail("");
      setFullName("");
      router.refresh();
    });
  }

  function freshLink(member: TeamMember) {
    startTransition(async () => {
      const result = asResult<{ link: string; emailAttempted: boolean }>(await newSignInLink(member.id));
      if (!result.ok || !result.link) return toast.error(result.error ?? "Could not create a link");
      setIssued({ link: result.link, emailAttempted: Boolean(result.emailAttempted), who: member.email });
    });
  }

  function setMemberRole(member: TeamMember, next: "admin" | "staff") {
    startTransition(async () => {
      const result = asResult(await changeTeamRole(member.id, next));
      if (!result.ok) return toast.error(result.error ?? "Could not change the role");
      toast.success(`${member.email} is now ${next}`);
      router.refresh();
    });
  }

  function remove(member: TeamMember) {
    if (!window.confirm(`Remove ${member.email}'s admin access?`)) return;
    startTransition(async () => {
      const result = asResult(await removeTeamAccess(member.id));
      if (!result.ok) return toast.error(result.error ?? "Could not remove access");
      toast.success("Access removed");
      router.refresh();
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={invite} className="card max-w-2xl space-y-4 p-6">
        <h2 className="text-lg">Invite someone</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-navy/60" htmlFor="invite-email">Email</label>
            <input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
          </div>
          <div>
            <label className="text-sm text-navy/60" htmlFor="invite-name">Name</label>
            <input id="invite-name" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3" />
          </div>
        </div>
        <div>
          <label className="text-sm text-navy/60" htmlFor="invite-role">Role</label>
          <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "staff")}
            className="mt-2 w-full rounded-lg border border-navy/15 px-4 py-3">
            <option value="staff">Staff — bookings, calendar, units, guests, requests, reviews</option>
            <option value="admin">Admin — everything, including payments, refunds, settings and team</option>
          </select>
        </div>
        <button className="btn-primary" disabled={isPending}>{isPending ? "Creating…" : "Create invitation"}</button>
      </form>

      {issued && (
        <div className="card max-w-2xl space-y-3 border-champagne p-6">
          <h2 className="text-lg">Link for {issued.who}</h2>
          <p className="text-sm text-navy/60">
            {issued.emailAttempted
              ? "We've tried to email this. Email can be slow or blocked, so you can also send it yourself, for example on WhatsApp."
              : "Email isn't set up, so send this link yourself, for example on WhatsApp."}{" "}
            It works once and expires within a day; if it stops working, create a new one.
          </p>
          <div className="flex gap-2">
            <input readOnly value={issued.link} onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-navy/15 bg-sand px-3 py-2 text-xs" />
            <button type="button" onClick={() => copy(issued.link)} className="btn-secondary px-4 py-2 text-xs">
              <Copy size={14} className="mr-1" /> Copy
            </button>
          </div>
          <button type="button" className="text-xs text-navy/50 underline" onClick={() => setIssued(null)}>Hide link</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/50">
            <tr>
              <th className="px-5 py-3">Person</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Last sign-in</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isMe = m.id === currentUserId;
              return (
                <tr key={m.id} className="border-b border-navy/5 align-middle">
                  <td className="px-5 py-4">
                    <p>{m.name || m.email}{isMe && <span className="ml-2 text-xs text-navy/40">(you)</span>}</p>
                    {m.name && <p className="text-xs text-navy/50">{m.email}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <select value={m.role} disabled={isMe || isPending} onChange={(e) => setMemberRole(m, e.target.value as "admin" | "staff")}
                      className="rounded-lg border border-navy/15 bg-white px-2 py-1.5 text-sm" aria-label={`Role for ${m.email}`}>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-4 text-navy/60">
                    {m.lastSignIn ? m.lastSignIn.slice(0, 10) : <span className="text-amber-700">Invite pending</span>}
                  </td>
                  <td className="px-5 py-4">
                    {!isMe && (
                      <div className="flex flex-wrap justify-end gap-3 text-xs">
                        <button type="button" disabled={isPending} onClick={() => freshLink(m)} className="text-champagne-dark underline underline-offset-2">
                          New sign-in link
                        </button>
                        <button type="button" disabled={isPending} onClick={() => remove(m)} className="text-red-700 underline underline-offset-2">
                          Remove access
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
