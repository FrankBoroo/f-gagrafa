// The admin dashboard has its own sidebar, so the public header and footer stay off it.
export function showsSiteChrome(pathname: string): boolean {
  return !(pathname === "/admin" || pathname.startsWith("/admin/"));
}
