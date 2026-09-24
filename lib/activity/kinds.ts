/**
 * Kind filter untuk network feed — module client-safe (tanpa import db).
 * "all" = urutan waktu murni semua kind. Legacy tab params tetap
 * didukung di lib + API; UI /activity memakai kinds saja.
 */
export const FEED_KINDS = [
  "all",
  "attestation",
  "vouch",
  "dispute",
  "claim",
] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export function isFeedKind(value: unknown): value is FeedKind {
  return (
    typeof value === "string" && (FEED_KINDS as readonly string[]).includes(value)
  );
}
