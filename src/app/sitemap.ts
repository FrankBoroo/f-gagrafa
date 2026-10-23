import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: site, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/units`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site}/tour`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site}/faq`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${site}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  let unitRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServiceClient();
    const { data: units } = await supabase.from("units").select("slug").eq("is_active", true);
    unitRoutes = (units ?? []).map((u: { slug: string }) => ({
      url: `${site}/units/${u.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // If the DB is unreachable at build time, still ship the static routes.
  }

  return [...staticRoutes, ...unitRoutes];
}
