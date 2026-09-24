"use client";

import { useMemo } from "react";

const SKINS = ["#f6d7b8", "#eebd8d", "#c98d5e", "#8a5a3b", "#f2ecec"];
const BGS = ["#ffe3d9", "#e4d9ff", "#d9f0ff", "#dff5e3", "#fff3c4", "#fbe2ee"];
const INK = "#232427";

interface Face {
  bg: string;
  skin: string;
  eyes: number;
  mouth: number;
  extra: number;
  blush: boolean;
}

function randomFace(): Face {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return {
    bg: pick(BGS),
    skin: pick(SKINS),
    eyes: Math.floor(Math.random() * 3),
    mouth: Math.floor(Math.random() * 3),
    extra: Math.floor(Math.random() * 4),
    blush: Math.random() > 0.5,
  };
}

function Eyes({ kind }: { kind: number }) {
  if (kind === 1) {
    // happy: dua arc
    return (
      <g stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M28 46 Q35 38 42 46" />
        <path d="M58 46 Q65 38 72 46" />
      </g>
    );
  }
  if (kind === 2) {
    // wink: satu bulat + satu arc
    return (
      <g>
        <circle cx="35" cy="44" r="5" fill={INK} />
        <path
          d="M58 46 Q65 40 72 46"
          stroke={INK}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }
  // round
  return (
    <g fill={INK}>
      <circle cx="35" cy="44" r="5" />
      <circle cx="65" cy="44" r="5" />
    </g>
  );
}

function Mouth({ kind }: { kind: number }) {
  if (kind === 1) {
    // open grin
    return <ellipse cx="50" cy="68" rx="9" ry="7" fill={INK} />;
  }
  if (kind === 2) {
    // flat
    return (
      <line
        x1="40"
        y1="68"
        x2="60"
        y2="68"
        stroke={INK}
        strokeWidth="4"
        strokeLinecap="round"
      />
    );
  }
  // smile
  return (
    <path
      d="M36 64 Q50 78 64 64"
      stroke={INK}
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Extra({ kind }: { kind: number }) {
  if (kind === 1) {
    // glasses
    return (
      <g stroke={INK} strokeWidth="3" fill="none">
        <circle cx="35" cy="44" r="11" />
        <circle cx="65" cy="44" r="11" />
        <line x1="46" y1="44" x2="54" y2="44" />
      </g>
    );
  }
  if (kind === 2) {
    // shades
    return (
      <g fill={INK}>
        <rect x="24" y="36" width="22" height="14" rx="7" />
        <rect x="54" y="36" width="22" height="14" rx="7" />
        <rect x="44" y="40" width="12" height="5" />
      </g>
    );
  }
  if (kind === 3) {
    // hat
    return (
      <g>
        <rect x="20" y="26" width="60" height="8" rx="4" fill="#e34a32" />
        <rect x="32" y="8" width="36" height="20" rx="4" fill="#e34a32" />
      </g>
    );
  }
  return null;
}

/**
 * Avatar ilustrasi acak — wajah kartun SVG generatif lokal.
 * Varian dikocok sekali per mount (useMemo) agar stabil antar poll.
 * Tanpa dependency, tanpa request jaringan.
 */
export function RandomAvatar({ size = 40 }: { size?: number }) {
  const face = useMemo(() => randomFace(), []);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
    >
      <circle cx="50" cy="50" r="50" fill={face.bg} />
      <circle cx="50" cy="54" r="30" fill={face.skin} />
      {face.blush && (
        <g fill="#e34a32" opacity="0.35">
          <ellipse cx="30" cy="58" rx="6" ry="4" />
          <ellipse cx="70" cy="58" rx="6" ry="4" />
        </g>
      )}
      <Eyes kind={face.eyes} />
      <Mouth kind={face.mouth} />
      <Extra kind={face.extra} />
    </svg>
  );
}
