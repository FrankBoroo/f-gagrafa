import Link from "next/link";

export const metadata = { title: "Page not found — The Gagrafa" };

export default function NotFound() {
  return (
    <div className="container-gagrafa max-w-2xl py-32 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-champagne">404</p>
      <h1 className="mt-3 text-4xl md:text-5xl">This page has checked out</h1>
      <p className="mx-auto mt-6 max-w-md text-navy/60">
        The page you were looking for doesn&apos;t exist or has moved. Our residences are still right where you left them.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link href="/" className="btn-primary">Back to home</Link>
        <Link href="/units" className="btn-secondary">View residences</Link>
      </div>
    </div>
  );
}
