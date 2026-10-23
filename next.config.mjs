/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // Hero video and Tour photos rarely change. Names aren't hashed, so cache for a week, not forever.
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }];
    return [
      { source: "/video/:path*", headers: cache },
      { source: "/tour/:path*", headers: cache },
    ];
  },
};

export default nextConfig;
