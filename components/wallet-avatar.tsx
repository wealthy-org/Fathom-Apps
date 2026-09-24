"use client";

/**
 * Avatar deterministik dari wallet address — tiap address selalu warna sama.
 * Tanpa dependency identicon: hash sederhana → hue gradient.
 */
export function WalletAvatar({
  address,
  size = 20,
}: {
  address: string;
  size?: number;
}) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const hue2 = (hue + 60) % 360;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue2} 70% 45%))`,
      }}
    />
  );
}
