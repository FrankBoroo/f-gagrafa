import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.thegagrafa.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/units`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  let unitRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServiceClient();
    const { data: units } = await supabase.from("units").select("slug").eq("is_active", true);
    unitRoutes = (units ?? []).map((u) => ({
      url: `${siteUrl}/units/${u.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // If the DB is unreachable at build time, still ship the static routes.
  }

  return [...staticRoutes, ...unitRoutes];
}
