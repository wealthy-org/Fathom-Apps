/**
 * Mini-stats wallet untuk expanded event card (feed + my activity).
 * Satu cache modul + dedup in-flight: wallet yang sama di banyak kartu
 * hanya fetch sekali per umur halaman, request serentak digabung jadi
 * satu. Gagal = promise di-evict agar expand berikutnya retry, bukan
 * null abadi. Komponen panggil hanya saat kartu expanded.
 */

export interface WalletMiniStats {
  score: number | null;
  tierLabel: string | null;
  attestations: number | null;
  activeDisputes: number | null;
}

interface ReputationResponse {
  score?: unknown;
  tier?: unknown;
  attestations?: unknown;
  activeDisputes?: unknown;
}

function parseMiniStats(data: unknown): WalletMiniStats {
  const raw = (data ?? {}) as ReputationResponse;
  const tier =
    typeof raw.tier === "object" &&
    raw.tier !== null &&
    typeof (raw.tier as { label?: unknown }).label === "string"
      ? (raw.tier as { label: string }).label
      : null;
  return {
    score: typeof raw.score === "number" ? raw.score : null,
    tierLabel: tier,
    attestations: typeof raw.attestations === "number" ? raw.attestations : null,
    activeDisputes:
      typeof raw.activeDisputes === "number" ? raw.activeDisputes : null,
  };
}

const cache = new Map<string, Promise<WalletMiniStats>>();

export function fetchWalletMiniStats(address: string): Promise<WalletMiniStats> {
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = fetch(`/api/reputation/${key}`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("http"))))
    .then(parseMiniStats);
  // Gagal = evict agar expand berikutnya coba lagi; consumer wajib catch.
  pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key);
  });
  cache.set(key, pending);
  return pending;
}
