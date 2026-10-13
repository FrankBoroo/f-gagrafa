import { Suspense } from "react";
import { LoginForm } from "@/components/site/LoginForm";

export const metadata = { title: "Sign in — The Gagrafa" };

const NOTICES: Record<string, string> = {
  "link-expired": "That sign-in link has expired or was already used. Ask an admin to send you a new one.",
  "invalid-link": "That sign-in link isn't valid. Ask an admin to send you a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const notice = params.error ? NOTICES[params.error] : undefined;

  return (
    <div className="container-gagrafa max-w-md py-24">
      <h1 className="text-4xl">Sign in</h1>
      <p className="mt-3 text-navy/60">For The Gagrafa team.</p>
      {notice && (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">{notice}</p>
      )}
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
