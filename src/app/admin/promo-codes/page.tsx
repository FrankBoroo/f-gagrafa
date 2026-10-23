import { createServiceClient } from "@/lib/supabase/server";
import { PromoCodeManager } from "@/components/admin/PromoCodeManager";
import { isAdmin } from "@/lib/auth";

export default async function AdminPromoCodesPage() {
  if (!(await isAdmin())) {
    return (
      <div>
        <h1 className="text-3xl">Promo Codes</h1>
        <p className="mt-4 text-sm text-navy/50">Only admins can manage promo codes.</p>
      </div>
    );
  }

  const supabase = createServiceClient();
  const { data: codes } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl">Promo Codes</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy/50">
        Codes apply at checkout. Usage only counts once a booking is actually paid for —
        an abandoned checkout doesn&rsquo;t burn a use.
      </p>
      <div className="mt-8">
        <PromoCodeManager codes={codes ?? []} />
      </div>
    </div>
  );
}
