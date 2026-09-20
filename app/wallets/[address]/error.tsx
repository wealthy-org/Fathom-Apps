"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function WalletProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const raw = params?.address;
  const address = typeof raw === "string" ? raw.toLowerCase() : null;

  return (
    <div
      role="alert"
      className="panel-brutal mt-6 max-w-2xl p-6"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate400">
        Wallet profile
      </p>
      <h1 className="mt-3 font-display text-2xl font-medium">
        Couldn&apos;t load this wallet
      </h1>
      {address && (
        <p className="mt-3 break-all font-mono text-xs text-slate400">
          {address}
        </p>
      )}
      <p className="mt-3 text-sm text-slate400">
        The wallet data couldn&apos;t be fetched. Your searched address is
        preserved above — check your connection and try again.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="btn-brutal px-4 py-2 text-xs"
        >
          Try again
        </button>
        <Link href="/wallets" className="btn-brutal-light px-4 py-2 text-xs">
          Back to search
        </Link>
      </div>
    </div>
  );
}
