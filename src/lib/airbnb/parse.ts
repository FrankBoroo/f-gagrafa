export interface ImportedReservation {
  uid: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD, exclusive
  summary: string;
}

export type ParseResult =
  | { ok: true; reservations: ImportedReservation[] }
  | { ok: false; error: string };

/** "20261210" or "20261210T000000Z" -> "2026-12-10" (string work only, no Date, no time zones). */
function toDateKey(value: string | undefined): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T\d{6}Z?)?$/.exec((value ?? "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

/** Reads the events of an Airbnb iCal export and returns the ones that are real reservations. */
export function parseAirbnbIcs(text: string): ParseResult {
  const lines = unfold(text);
  if (!lines.some((l: string) => l.trim().toUpperCase() === "BEGIN:VCALENDAR")) {
    return { ok: false, error: "That link did not return an iCal calendar." };
  }

  const reservations: ImportedReservation[] = [];
  let props: Map<string, string> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      props = new Map();
      continue;
    }
    if (upper === "END:VEVENT") {
      if (props) {
        const r = toReservation(props);
        if (r) reservations.push(r);
      }
      props = null;
      continue;
    }
    if (!props) continue;
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const name = line.slice(0, colon).split(";")[0].trim().toUpperCase();
    if (!props.has(name)) props.set(name, line.slice(colon + 1));
  }

  return { ok: true, reservations };
}

function toReservation(props: Map<string, string>): ImportedReservation | null {
  const uid = (props.get("UID") ?? "").trim();
  if (!uid) return null;
  const summary = (props.get("SUMMARY") ?? "").trim();
  const description = props.get("DESCRIPTION") ?? "";
  const isReservation =
    summary.toLowerCase() === "reserved" || description.includes("/hosting/reservations/");
  if (!isReservation) return null;
  const checkIn = toDateKey(props.get("DTSTART"));
  const checkOut = toDateKey(props.get("DTEND"));
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;
  return { uid, checkIn, checkOut, summary };
}
