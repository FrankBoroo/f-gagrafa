// Settings hold the phone numbers as one piece of text, for example "0303 400 535 / 059 381 0182".

export function phoneNumbers(raw: string): string[] {
  return raw
    .split(/[/·]/)
    .map((part: string) => part.trim())
    .filter(Boolean);
}

// A `tel:` link in international form, or null if the text isn't a phone number. Local Ghana numbers start with 0.
export function telHref(phone: string): string | null {
  if (/[a-z]/i.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (phone.trim().startsWith("+")) return `tel:+${digits}`;
  return `tel:+233${digits.replace(/^0/, "")}`;
}

// A WhatsApp chat link (wa.me wants the international number, digits only), or null
// if the text isn't a phone number. Same rules as telHref.
export function whatsappHref(phone: string): string | null {
  const tel = telHref(phone);
  return tel ? `https://wa.me/${tel.replace("tel:+", "")}` : null;
}
