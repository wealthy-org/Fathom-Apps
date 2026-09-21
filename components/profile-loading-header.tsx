"use client";

import { useParams } from "next/navigation";

function shortAddress(address: string) {
  return address.length > 13
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

export function ProfileLoadingHeader() {
  const params = useParams();
  const raw = params?.address;
  const address = typeof raw === "string" ? raw.toLowerCase() : null;

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate400">
        Wallet profile
      </p>
      <h1 className="mt-3 font-display text-3xl font-medium sm:text-4xl">
        {address ? shortAddress(address) : "…"}
      </h1>
      {address && (
        <p className="mt-3 break-all font-mono text-xs text-slate400">
          {address}
        </p>
      )}
    </div>
  );
}
