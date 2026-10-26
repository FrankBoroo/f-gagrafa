import Image from "next/image";

export const metadata = { title: "About — The Gagrafa" };

const pillars = [
  {
    title: "Considered design",
    body: "Every residence is furnished with the same care as a well-kept home — durable materials, calm colour, and nothing that feels temporary.",
  },
  {
    title: "Dependable utilities",
    body: "Backup power and water, fast Wi-Fi, and 24/7 security, so a stay here is never interrupted by the things Accra can sometimes interrupt.",
  },
  {
    title: "Service that anticipates",
    body: "From check-in instructions sent ahead of arrival to a team that responds to requests quickly — without hovering.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <section className="relative h-[50vh] w-full">
        <Image
          src="/tour/open-plan-living.jpg"
          alt="The Gagrafa residence interior"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-navy/40" />
        <div className="container-gagrafa relative z-10 flex h-full flex-col justify-end pb-16 text-ivory">
          <p className="text-xs uppercase tracking-[0.3em] text-champagne">About</p>
          <h1 className="mt-3 max-w-2xl text-4xl md:text-5xl">A quiet residence on Community 20</h1>
        </div>
      </section>

      <section className="container-gagrafa py-20">
        <div className="grid gap-12 md:grid-cols-2">
          <h2 className="text-3xl">Our story</h2>
          <div className="space-y-4 text-navy/70">
            <p>
              The Gagrafa was built for a specific kind of traveller — the one who wants
              the independence of an apartment with the reliability of a well-run hotel.
              Spintex is one of Accra&rsquo;s most connected neighbourhoods, close to the
              business districts without the noise of being in the middle of them, and
              Community 20 sits quietly within it.
            </p>
            <p>
              We furnish every residence ourselves, maintain them ourselves, and keep a
              small team on-site around the clock, so the experience stays consistent
              whether you&rsquo;re here for three nights or three months.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-sand py-20">
        <div className="container-gagrafa">
          <h2 className="text-3xl">What we care about</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {pillars.map((p) => (
              <div key={p.title} className="border-l border-champagne pl-5">
                <p className="text-lg">{p.title}</p>
                <p className="mt-2 text-sm text-navy/60">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-gagrafa py-20">
        <h2 className="text-3xl">The neighbourhood</h2>
        <p className="mt-4 max-w-2xl text-navy/70">
          Spintex connects easily to the Accra Mall, Kotoka International Airport, and
          the Airport City business district, with a growing strip of restaurants,
          gyms, and supermarkets within a short drive of the property.
        </p>
      </section>
    </div>
  );
}
