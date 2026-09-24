import Link from "next/link";
import { CopyAddressButton } from "@/components/copy-address-button";
import { shortAddress } from "@/components/activity-utils";

/**
 * Hero halaman My Activity — label mono, judul serif, subtitle naratif
 * berisi address, dan aksi cepat ke profil reputasi wallet.
 */
export function MyActivityHero({ address }: { address: string }) {
  return (
    <header>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate400">
        Personal reputation surface
      </p>
      <h1 className="mt-3 font-serif-accent text-4xl text-ink sm:text-5xl">
        My Activity
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate400 sm:text-base">
        <span className="font-mono text-accent-ink">{shortAddress(address)}</span>{" "}
        — every attestation you signed, vouch you backed, and dispute you
        opened, newest first. This trail is public and shapes how others read
        this wallet.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/wallets/${address}`}
          className="btn-brutal px-5 py-2.5 text-sm"
        >
          View reputation
        </Link>
        <CopyAddressButton address={address} />
        <Link
          href={`/wallets/${address}#evidence`}
          className="btn-brutal-light px-5 py-2.5 text-sm"
        >
          View wallet
        </Link>
      </div>
    </header>
  );
}
