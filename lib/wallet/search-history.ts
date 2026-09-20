/**
 * Client-side recent wallet searches (no backend, no auth).
 *
 * Stores the minimum: normalized address + last-searched timestamp.
 * Deduplicated, newest first, capped — never profile data, never a score.
 */

export interface RecentSearch {
  address: `0x${string}`;
  at: number;
}

const KEY = "fathom:recent-searches";
const MAX_ITEMS = 8;

function isValid(entry: unknown): entry is RecentSearch {
  if (typeof entry !== "object" || entry === null) return false;
  const { address, at } = entry as Record<string, unknown>;
  return (
    typeof address === "string" &&
    /^0x[0-9a-f]{40}$/.test(address) &&
    typeof at === "number" &&
    Number.isFinite(at)
  );
}

export function readRecentSearches(): RecentSearch[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValid).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function recordRecentSearch(address: string): RecentSearch[] {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) return readRecentSearches();
  const next = [
    { address: normalized as `0x${string}`, at: Date.now() },
    ...readRecentSearches().filter((entry) => entry.address !== normalized),
  ].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — history is a convenience, not a requirement.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignore — see above.
  }
}

/** "just now" / "12 minutes ago" / "3 hours ago" / "5 days ago". */
export function relativeTime(at: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
