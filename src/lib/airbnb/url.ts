const HOSTS = new Set<string>([
  "airbnb.com", "airbnb.co.uk", "airbnb.ca", "airbnb.com.au", "airbnb.ie", "airbnb.co.za",
  "airbnb.de", "airbnb.fr", "airbnb.es", "airbnb.it", "airbnb.nl",
]);
const PASTE_HINT = "Paste the calendar link Airbnb gives under Availability, Connect calendars, Export.";

/** null when the link is an Airbnb calendar export link; otherwise a sentence saying what is wrong. */
export function airbnbCalendarUrlProblem(url: string): string | null {
  if (url.length > 500) return "That link is too long to be an Airbnb calendar link.";
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "That is not a valid link.";
  }
  if (u.protocol !== "https:") return "The Airbnb calendar link must start with https://.";
  if (u.username || u.password || u.port) return "That does not look like an Airbnb calendar link.";
  if (!HOSTS.has(u.hostname.toLowerCase().replace(/^www\./, ""))) {
    return `That link is not on a known Airbnb site. ${PASTE_HINT}`;
  }
  if (!u.pathname.startsWith("/calendar/ical/")) {
    return `That is not an Airbnb calendar link. ${PASTE_HINT}`;
  }
  return null;
}
