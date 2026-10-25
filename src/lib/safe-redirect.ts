// Where to go after signing in. `?next=` comes from the address bar, so anyone can put
// another website there; only paths on this site are followed, anything else goes to /admin.
// "//host" and "/\host" are rejected because browsers treat both as another site.
export function safeNextPath(next: string | null | undefined, fallback = "/admin"): string {
  if (!next || !/^\/(?![/\\])/.test(next) || /[\u0000-\u001f\\]/.test(next)) return fallback;
  return next;
}
