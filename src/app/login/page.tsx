import { Suspense } from "react";
import { LoginForm } from "@/components/site/LoginForm";

export const metadata = { title: "Sign in — The Gagrafa" };

export default function LoginPage() {
  return (
    <div className="container-gagrafa max-w-md py-24">
      <h1 className="text-4xl">Sign in</h1>
      <p className="mt-3 text-navy/60">For The Gagrafa team.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
