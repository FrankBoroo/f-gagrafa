import { publicEnv } from "@/lib/env";
// Reads the embed URL from NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL so it's set in
// one place and shared by both the homepage and the Contact page.
//
// To get the real URL (no API key needed): search your exact address on
// Google Maps -> Share -> "Embed a map" tab -> copy the src="..." value out
// of the iframe code it gives you -> paste it as NEXT_PUBLIC_GOOGLE_MAPS_EMBED_URL
// in .env.local (and in Vercel's project env vars, then redeploy).
export function MapEmbed({ className = "" }: { className?: string }) {
  const src =
    publicEnv.googleMapsEmbedUrl ||
    "https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d417.3380118633103!2d-0.07525128086277177!3d5.653583523475358!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sgh!4v1791056864141!5m2!1sen!2sgh";

  return (
    <iframe
      title="The Gagrafa location"
      src={src}
      className={`h-full w-full ${className}`}
      style={{ border: 0 }}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
