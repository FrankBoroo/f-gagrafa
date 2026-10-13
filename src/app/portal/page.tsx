import { PortalLookup } from "@/components/site/PortalLookup";

export const metadata = { title: "Guest Portal — The Gagrafa" };

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; verify?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="container-gagrafa max-w-lg py-24">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">Welcome back</p>
      <h1 className="mt-3 text-4xl">Guest Portal</h1>
      <p className="mt-4 text-navy/60">
        Enter your booking code and the email or phone used to book, to view your
        stay details, check-in instructions, and services.
      </p>
      <PortalLookup defaultCode={params.code} needsVerification={params.verify === "1"} />
    </div>
  );
}
