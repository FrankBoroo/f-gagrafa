import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "About — The Gagrafa" };

export default function AboutPage() {
  return (
    <div>
      <section className="relative h-[60vh] min-h-[380px] w-full bg-navy">
        <Image
          src="/photos/hero-4.jpg"
          alt="The Gagrafa building seen from its forecourt"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/75 to-navy/15" />
        <div className="container-gagrafa relative z-10 flex h-full flex-col justify-end pb-14 text-ivory">
          <p className="text-[0.7rem] uppercase tracking-[0.25em] text-champagne-light">About</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-normal md:text-6xl">Where modern living meets comfort</h1>
        </div>
      </section>

      <section className="container-gagrafa grid gap-10 py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:py-28">
        <div>
          <h2 className="text-3xl font-normal leading-tight md:text-4xl">Welcome to The Gagrafa</h2>
          <Link href="/units" className="link-underline mt-6">Our apartments</Link>
        </div>
        <div className="space-y-5 text-navy/75">
          <p>
            We offer a unique blend of contemporary design, serene surroundings and easy access to
            the vibrant heart of the city. Whether you&rsquo;re here for a short stay or a long-term
            one, our apartments are designed to give you a peaceful retreat while keeping you
            connected to everything you need.
          </p>
          <p>
            Our thoughtfully designed spaces feature sleek, modern finishes, state-of-the-art
            amenities and flexible living options, including fully and semi-furnished apartments.
            Each detail is crafted for your comfort, convenience and peace of mind.
          </p>
          <p>
            What sets us apart is a lifestyle that balances tranquillity and accessibility. Just a
            short drive from the city&rsquo;s bustling business district, The Gagrafa offers an escape
            from the daily grind without sacrificing connectivity.
          </p>
        </div>
      </section>
    </div>
  );
}
