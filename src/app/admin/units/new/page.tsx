import Link from "next/link";
import { UnitForm } from "@/components/admin/UnitForm";
import { getPublicSettings } from "@/lib/site-settings";

export default async function NewUnitPage() {
  const { pricing } = await getPublicSettings();
  return (
    <div>
      <Link href="/admin/units" className="text-sm text-navy/50 hover:text-navy">← All residences</Link>
      <h1 className="mt-3 text-3xl">New residence</h1>
      <p className="mt-2 max-w-xl text-sm text-navy/50">
        Fill in the details, then you&rsquo;ll be taken to add photos. It starts hidden from the public
        site until you switch it on.
      </p>
      <div className="mt-8 max-w-2xl">
        <UnitForm currency={pricing.currency} />
      </div>
    </div>
  );
}
