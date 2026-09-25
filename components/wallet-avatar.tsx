"use client";

/**
 * Avatar blockie deterministik dari wallet address — tiap address selalu
 * pola sama (grid 5x5 mirror ala Jazzicon, hue dari hash address).
 * Dipakai navbar profile + dropdown profile, bukan lingkaran warna polos.
 * Tanpa dependency identicon: hash sederhana → sel + hue.
 * Address dinormalisasi ke lowercase dulu: wagmi memberi checksummed
 * (mixed case), halaman profile memberi lowercase — tanpa ini wallet yang
 * sama tampil beda pola di navbar vs profile.
 */
export function WalletAvatar({
  address,
  size = 20,
}: {
  address: string;
  size?: number;
}) {
  const normalized = address.toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  // PRNG mulberry-ish dari hash untuk isi sel grid.
  let seed = hash || 1;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // 3 kolom kiri, mirror ke 5 (kolom 0,1,2,1,0).
  const cells: boolean[] = [];
  for (let row = 0; row < 5; row++) {
    const left = [rand() > 0.42, rand() > 0.42, rand() > 0.42];
    cells.push(left[0], left[1], left[2], left[1], left[0]);
  }
  const fg = `hsl(${hue} 65% 55%)`;
  const bg = `hsl(${hue} 60% 92%)`;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, background: bg }}
    >
      <svg width={size} height={size} viewBox="0 0 5 5">
        {cells.map((filled, i) =>
          filled ? (
            <rect
              key={i}
              x={i % 5}
              y={Math.floor(i / 5)}
              width="1"
              height="1"
              fill={fg}
            />
          ) : null,
        )}
      </svg>
    </span>
  );
}
