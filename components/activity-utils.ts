import type { FeedItem } from "@/lib/activity/feed";

export const WEI_PER_ETH = BigInt(10) ** BigInt(18);

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Format nilai wei ke native unit untuk tampilan (AGENTS §9: hanya di boundary presentasi). */
export function formatNative(wei: string): string {
  try {
    const value = BigInt(wei);
    const whole = value / WEI_PER_ETH;
    const fraction = value % WEI_PER_ETH;
    if (fraction === BigInt(0)) return `${whole} ETH`;
    const padded = fraction.toString().padStart(18, "0").replace(/0+$/, "");
    return `${whole}.${padded} ETH`;
  } catch {
    return `${wei} wei`;
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/** Head of a day-group key, e.g. "SEP 22, 2026" (UTC). */
export function dayKey(iso: string): string {
  return formatDate(iso).toUpperCase();
}

/**
 * Deterministic avatar hue from the address hash. Pure presentation —
 * inline hsl() so no new design token is needed.
 */
export function avatarHue(address: string): number {
  let hash = 0;
  for (let i = 2; i < address.length; i += 1) {
    hash = (hash * 31 + address.charCodeAt(i)) % 360;
  }
  return hash;
}

export function itemKey(item: FeedItem): string {
  // claim.id is the address — include time so same-day re-claims stay distinct.
  return `${item.kind}:${item.id}:${item.occurredAt}`;
}

/** Wallets a focus filter applies to, in display order. */
export function involvedWallets(item: FeedItem): string[] {
  switch (item.kind) {
    case "attestation":
      return [item.attester, item.subject];
    case "dispute":
      return [item.reporter, item.target];
    case "vouch":
      return [item.from, item.to];
    case "claim":
      return [item.address];
  }
}
