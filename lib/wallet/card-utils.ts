/** Pure display helpers for the Reputation Card. No domain logic, no derivation. */

/** Null → "—"; otherwise stringified. Never fabricates a zero. */
export function metric(value: string | number | null): string {
  if (value === null) return "—";
  return String(value);
}

/** Truncate a wallet alias to `max` chars, append "…". Returns null for empty. */
export function truncateAlias(alias: string | null | undefined, max = 28): string | null {
  if (!alias) return null;
  if (alias.length <= max) return alias;
  return alias.slice(0, Math.max(max - 3, 0)) + "...";
}
