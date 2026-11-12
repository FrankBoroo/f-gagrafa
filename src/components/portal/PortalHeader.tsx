import Image from "next/image";

export function PortalHeader({
  imageSrc,
  unitName,
  checkIn,
  checkOut,
  nights,
  guests,
  code,
  firstName,
}: {
  imageSrc: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  code: string;
  firstName: string;
}) {
  return (
    <header className="relative isolate overflow-hidden bg-navy text-ivory">
      <Image src={imageSrc} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy/90 via-navy/60 to-navy/30" />
      <div className="container-gagrafa max-w-3xl pb-10 pt-28 sm:pb-14 sm:pt-36">
        <p className="text-[0.7rem] uppercase tracking-[0.25em] text-champagne-light">{code}</p>
        <h1 className="mt-3 text-3xl text-ivory sm:text-4xl">Welcome, {firstName}</h1>
        <p className="mt-2 font-display text-lg text-ivory/90">{unitName}</p>
        <p className="mt-3 text-sm text-ivory/80">
          {checkIn} to {checkOut} · {nights} {nights === 1 ? "night" : "nights"} · {guests}{" "}
          {guests === 1 ? "guest" : "guests"}
        </p>
      </div>
    </header>
  );
}
