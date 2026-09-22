"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import { ATTESTATION_ROLES } from "@/lib/attestations/roles";
import { ATTESTATION_REGISTRY_WRITE_ABI } from "@/lib/chain/vouch-abi";
import { explorerTransactionUrl } from "@/lib/chain/blockscout";
import { robinhoodTestnet } from "@/lib/wallet/chains";
import { THRESHOLDS } from "@/config/thresholds";

type TxState =
  | "idle"
  | "awaiting_signature"
  | "pending"
  | "confirmed"
  | "failed";

const REGISTRY =
  process.env.NEXT_PUBLIC_FATHOM_ATTESTATION_REGISTRY_ADDRESS ?? "";

export function AttestationForm({ subject }: { subject: string }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [role, setRole] = useState<string>(ATTESTATION_ROLES[0]);
  const [relationship, setRelationship] = useState("");
  const [duration, setDuration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const roleId = useId();
  const relationshipId = useId();
  const durationId = useId();
  const errorId = useId();

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: robinhoodTestnet.id });
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const wrongNetwork = chainId !== robinhoodTestnet.id;
  // ponytail: dompet tanpa saldo testnet gagal di estimasi gas dengan error
  // generik ("Unexpected error") dari RPC — tahan sebelum write, bukan sesudah.
  const { data: gasBalance } = useBalance({
    address,
    chainId: robinhoodTestnet.id,
    query: { enabled: isConnected && !wrongNetwork },
  });
  const { isSuccess: confirmed, isError: receiptFailed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}` | undefined,
      chainId: robinhoodTestnet.id,
      query: { enabled: txHash !== null },
    });

  // ponytail: server render cabang not-connected; client auto-reconnect flip ke
  // cabang connected → hydration mismatch. Tahan di cabang server sampai mounted.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // ponytail: setState + router.refresh tidak boleh di fase render (React warn
  // "Cannot update Router while rendering"). Efek, bukan render. Tanpa setTxState
  // di sini (lint react-hooks/set-state-in-effect): tampilan confirmed di-derive
  // dari `confirmed || txState === "confirmed"` di bawah.
  useEffect(() => {
    if (confirmed && txState !== "confirmed") {
      // ponytail: index registry dulu supaya event attestation masuk DB sebelum
      // refresh — tanpa ini data baru tidak muncul sampai indexer jalan.
      void fetch("/api/index", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "attestation" }),
      }).then(
        () => router.refresh(),
        () => router.refresh(),
      );
    }
  }, [confirmed, txState, router]);

  if (REGISTRY === "") {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">Attest to this wallet</h3>
        <p className="mt-1 text-xs text-slate400">
          Attestation registry is not configured. On-chain attestations are
          unavailable until NEXT_PUBLIC_FATHOM_ATTESTATION_REGISTRY_ADDRESS is
          set.
        </p>
      </div>
    );
  }

  if (!mounted || !isConnected || !address) {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">Attest to this wallet</h3>
        <p className="mt-1 text-xs text-slate400">
          Connect your wallet to attest to this profile. Attestations are
          pseudonymous supporting evidence — they never replace on-chain
          behavior, and they do not create reputation on their own.
        </p>
        <div className="mt-4">
          <ConnectButton connectLabel="Connect wallet to attest" />
        </div>
      </div>
    );
  }

  const attester = address.toLowerCase();
  if (attester === subject) return null;

  // ponytail: tanpa chainId yang di-pin, wallet di jaringan salah mensimulasikan
  // attest ke alamat tanpa kode → revert mentah "Unexpected error". Tahan di sini.
  if (wrongNetwork) {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">Attest to this wallet</h3>
        <p className="mt-1 text-xs text-slate400">
          Your wallet is on the wrong network. Switch to Robinhood Testnet to
          attest on-chain.
        </p>
        <button
          type="button"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: robinhoodTestnet.id })}
          className="btn-brutal mt-4 px-4 py-2 text-xs"
        >
          {isSwitching ? "Switching…" : "Switch network"}
        </button>
      </div>
    );
  }

  const busy = txState === "awaiting_signature" || txState === "pending";

  function parseDuration(): number | null {
    if (duration.trim() === "") return null;
    const n = Number.parseInt(duration.trim(), 10);
    if (!Number.isInteger(n) || n < 1) return null;
    if (n > THRESHOLDS.attestation.maxDurationMonths) return null;
    return n;
  }

  // ponytail: petakan custom error kontrak ke pesan aksi, bukan "Unexpected error".
  // Nama error dibawa viem di message hasil simulasi — regex cukup, tanpa decode manual.
  function describeAttestError(e: unknown): string {
    const msg = (e as Error)?.message ?? "";
    if (/reject|denied|cancel/i.test(msg))
      return "Cancelled. Click once more to try again.";
    const hit = msg.match(
      /(SelfAttestation|ZeroAddress|EmptyRole|EmptyRelationship|InvalidDuration)/,
    )?.[1];
    switch (hit) {
      case "SelfAttestation":
        return "Rejected by contract (SelfAttestation): cannot attest to your own wallet.";
      case "ZeroAddress":
        return "Rejected by contract (ZeroAddress): subject or sender is the zero address.";
      case "EmptyRole":
        return "Rejected by contract (EmptyRole): pick a role.";
      case "EmptyRelationship":
        return "Rejected by contract (EmptyRelationship): relationship is required.";
      case "InvalidDuration":
        return "Rejected by contract (InvalidDuration): duration must be at least 1 month.";
      default:
        break;
    }
    // Revert tanpa data = bukan validasi kontrak: alamat registry salah/bukan
    // kontrak di chain ini, atau bytecode deploy beda dari sumber. Tampilkan
    // alamat yang dipakai supaya salah konfigurasi kelihatan.
    if (/revert|Unexpected error|returned no data|empty/i.test(msg)) {
      // ponytail: bandingkan case-insensitive — checksum beda casing bukan
      // mismatch. Alamat sama tapi tetap revert = bytecode deploy beda/RPC.
      if (
        REGISTRY.toLowerCase() ===
        "0x7da53acee8fb02a82e9ca45e7ac4d6000200ac66"
      )
        return "Simulation reverted with no contract reason even though the registry address is correct. The deployed bytecode may differ from the current contract source, or the RPC failed. Check that the address holds contract code on the Robinhood Testnet explorer, then try again.";
      return `Simulation reverted with no contract reason. Check NEXT_PUBLIC_FATHOM_ATTESTATION_REGISTRY_ADDRESS (used: ${REGISTRY}). Expected registry on Robinhood Testnet: 0x7da53acee8fb02a82e9ca45e7ac4d6000200ac66.`;
    }
    return msg || "Transaction failed. Please try again.";
  }

  async function submit() {
    if (!address) return;
    setError(null);
    setTxHash(null);
    if (relationship.trim() === "") {
      setError("Relationship is required.");
      return;
    }
    const durationMonths = parseDuration();
    if (durationMonths === null) {
      setError("Duration must be a whole number of months (at least 1).");
      return;
    }
    // ponytail: saldo nol = estimasi gas gagal dengan error RPC generik.
    // Form tetap tampil; gagal di submit dengan pesan jelas, bukan panel blokir.
    if (gasBalance !== undefined && gasBalance.value === BigInt(0)) {
      setError(
        "This wallet holds no native tokens, so it cannot pay gas for the on-chain attestation. Top it up, then try again.",
      );
      return;
    }
    const args = [
      subject as `0x${string}`,
      role,
      relationship.trim(),
      durationMonths,
    ] as const;
    try {
      // Preflight: simulasi dengan parameter IDENTIK (address/function/args/
      // account/chain) sebelum write — gagal di sini = alasan revert asli,
      // tanpa membakar gas dan tanpa pesan generik dompet.
      if (publicClient) {
        await publicClient.simulateContract({
          address: REGISTRY as `0x${string}`,
          abi: ATTESTATION_REGISTRY_WRITE_ABI,
          functionName: "attest",
          args: [...args],
          account: address,
          chain: robinhoodTestnet,
        });
      }
      setTxState("awaiting_signature");
      const hash = await writeContractAsync({
        address: REGISTRY as `0x${string}`,
        abi: ATTESTATION_REGISTRY_WRITE_ABI,
        functionName: "attest",
        args: [...args],
        chainId: robinhoodTestnet.id,
      });
      setTxHash(hash);
      setTxState("pending");
    } catch (e) {
      setTxState("failed");
      setError(describeAttestError(e));
    }
  }

  if (confirmed || txState === "confirmed") {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">Attest to this wallet</h3>
        <p className="mt-3 text-xs text-accent-ink">
          Attestation confirmed on-chain. It will appear below once indexed.
        </p>
        {txHash && (
          <a
            href={explorerTransactionUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-accent-ink underline"
          >
            View transaction on Robinhood explorer ↗
          </a>
        )}
      </div>
    );
  }

  const buttonLabel =
    txState === "awaiting_signature"
      ? "Confirm in wallet…"
      : txState === "pending"
        ? "Pending…"
        : "Attest on-chain";

  return (
    <div className="panel-brutal mt-4 p-5">
      <h3 className="font-display text-base">Attest to this wallet</h3>
      <p className="mt-1 text-xs text-slate400">
        Attestations are pseudonymous supporting evidence recorded on-chain.
        Your wallet signs the transaction; it does not create reputation.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-4 grid gap-3 sm:grid-cols-3"
      >
        <label htmlFor={roleId} className="sr-only">
          Attestation role
        </label>
        <select
          id={roleId}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="input-brutal px-3 py-2 text-sm"
        >
          {ATTESTATION_ROLES.map((r) => (
            <option key={r} value={r} className="bg-white text-ink">
              {r}
            </option>
          ))}
        </select>
        <label htmlFor={relationshipId} className="sr-only">
          Relationship
        </label>
        <input
          id={relationshipId}
          value={relationship}
          maxLength={THRESHOLDS.attestation.maxRelationshipLength}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="Relationship (e.g. Worked Together)"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input-brutal px-3 py-2 text-sm sm:col-span-2"
        />
        <label htmlFor={durationId} className="sr-only">
          Duration in months
        </label>
        <input
          id={durationId}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duration in months (min 1)"
          inputMode="numeric"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input-brutal px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || relationship.trim() === "" || duration.trim() === ""}
          className="btn-brutal px-4 py-2 text-xs sm:col-span-2"
        >
          {buttonLabel}
        </button>
      </form>
      {receiptFailed && !confirmed && (
        <p role="alert" className="mt-3 text-xs text-red-600">
          Transaction reverted on-chain. Check the explorer for details.
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
