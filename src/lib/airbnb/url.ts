const HOST = /^(www\.)?airbnb\.[a-z]{2,3}(\.[a-z]{2})?$/;

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
  if (!HOST.test(u.hostname.toLowerCase())) return "That link is not on airbnb.com.";
  if (!u.pathname.startsWith("/calendar/ical/")) {
    return "That is not an Airbnb calendar link. Use the Export calendar link from Airbnb.";
  }
  return null;
}
