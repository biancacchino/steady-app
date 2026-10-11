/** True only when the database URL points at this machine. Anything unparseable counts as not local. */
export function isLocalDatabase(url: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
