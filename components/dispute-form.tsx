"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { keccak256, toHex } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import { DISPUTE_REGISTRY_WRITE_ABI } from "@/lib/chain/vouch-abi";
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
  process.env.NEXT_PUBLIC_FATHOM_DISPUTE_REGISTRY_ADDRESS ?? "";

// ponytail: alamat registry Dispute dari broadcast 46630 — kalau env menunjuk
// kontrak lain, openDispute revert tanpa reason. Tampilkan ekspektasi di error.
const EXPECTED_REGISTRY = "0x8a00a74d3d052b1b480db63aa595c59faafaa748";

/** Petakan custom error FathomDisputeRegistry ke pesan aksi. Tanpa data revert
 *  (fallback kontrak lain / tanpa kode) = kemungkinan besar alamat registry salah. */
function describeDisputeError(e: unknown): string {
  const msg = (e as Error)?.message ?? "";
  if (/SelfDispute/.test(msg))
    return "You cannot file a dispute against your own wallet.";
  if (/ZeroAddress/.test(msg))
    return "Registry rejected a zero address. Check the profile URL and your connection.";
  if (/EmptyReason/.test(msg))
    return "Reason cannot be empty. Fill in the reason field.";
  if (/reverted|Unexpected error|0x/.test(msg) && !/0x[0-9a-fA-F]{2,}/.test(msg))
    return `Transaction reverted without a reason. The registry address may be wrong — in use: ${REGISTRY || "(empty)"}, expected: ${EXPECTED_REGISTRY}.`;
  return msg || "Transaction failed. Please try again.";
}

export function DisputeForm({ target }: { target: string }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const reasonId = useId();
  const evidenceId = useId();
  const errorId = useId();

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: robinhoodTestnet.id });
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const wrongNetwork = chainId !== robinhoodTestnet.id;
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
      // ponytail: index registry dulu supaya event dispute masuk DB sebelum
      // refresh — tanpa ini data baru tidak muncul sampai indexer jalan.
      void fetch("/api/index", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "dispute" }),
      }).then(
        () => router.refresh(),
        () => router.refresh(),
      );
    }
  }, [confirmed, txState, router]);

  if (REGISTRY === "") {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">File a dispute</h3>
        <p className="mt-1 text-xs text-slate400">
          Dispute registry is not configured. On-chain disputes are unavailable
          until NEXT_PUBLIC_FATHOM_DISPUTE_REGISTRY_ADDRESS is set.
        </p>
      </div>
    );
  }

  if (!mounted || !isConnected || !address) {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">File a dispute</h3>
        <p className="mt-1 text-xs text-slate400">
          A dispute is a signed report, not proof of wrongdoing. It does not
          change reputation or risk here. Connect your wallet to file one.
        </p>
        <div className="mt-4">
          <ConnectButton connectLabel="Connect wallet to dispute" />
        </div>
      </div>
    );
  }

  const reporter = address.toLowerCase();
  if (reporter === target) return null;

  // ponytail: tanpa chainId yang di-pin, wallet di jaringan salah mensimulasikan
  // openDispute ke alamat tanpa kode → revert mentah "Unexpected error". Tahan di sini.
  if (wrongNetwork) {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">File a dispute</h3>
        <p className="mt-1 text-xs text-slate400">
          Your wallet is on the wrong network. Switch to Robinhood Testnet to
          file a dispute on-chain.
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

  async function submit() {
    setError(null);
    setTxHash(null);
    if (reason.trim() === "" || evidence.trim() === "") {
      setError("Reason and evidence are both required.");
      return;
    }
    try {
      setTxState("awaiting_signature");
      // ponytail: preflight simulasi dengan argumen identik — kalau revert,
      // viem melempar ContractFunctionExecutionError dengan reason asli
      // (bukan "Unexpected error" generik). Tanpa publicClient = skip.
      if (publicClient && address) {
        try {
          await publicClient.simulateContract({
            address: REGISTRY as `0x${string}`,
            abi: DISPUTE_REGISTRY_WRITE_ABI,
            functionName: "openDispute",
            args: [
              target as `0x${string}`,
              keccak256(toHex(reason.trim())),
              keccak256(toHex(evidence.trim())),
            ],
            account: address,
            chain: robinhoodTestnet,
          });
        } catch (simError) {
          setTxState("failed");
          setError(describeDisputeError(simError));
          return;
        }
      }
      const hash = await writeContractAsync({
        address: REGISTRY as `0x${string}`,
        abi: DISPUTE_REGISTRY_WRITE_ABI,
        functionName: "openDispute",
        args: [
          target as `0x${string}`,
          keccak256(toHex(reason.trim())),
          keccak256(toHex(evidence.trim())),
        ],
        chainId: robinhoodTestnet.id,
      });
      setTxHash(hash);
      setTxState("pending");
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setTxState("failed");
      setError(
        /reject|denied|cancel/i.test(msg)
          ? "Cancelled. Click once more to try again."
          : describeDisputeError(e),
      );
    }
  }

  if (confirmed || txState === "confirmed") {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">File a dispute</h3>
        <p className="mt-3 text-xs text-accent-ink">
          Dispute confirmed on-chain. It will appear below once indexed.
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
        : "Sign & report";

  return (
    <div className="panel-brutal mt-4 p-5">
      <h3 className="font-display text-base">File a dispute</h3>
      <p className="mt-1 text-xs text-slate400">
        A dispute is a signed report, not proof of wrongdoing. It does not
        change reputation or risk here. Reason and evidence are hashed on-chain;
        full text stays off-chain.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-4 grid gap-3"
      >
        <label htmlFor={reasonId} className="sr-only">
          Reason (short summary)
        </label>
        <input
          id={reasonId}
          value={reason}
          maxLength={THRESHOLDS.dispute.maxReasonLength}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (short summary)"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input-brutal px-3 py-2 text-sm"
        />
        <label htmlFor={evidenceId} className="sr-only">
          Evidence (links, tx hashes, context)
        </label>
        <textarea
          id={evidenceId}
          value={evidence}
          maxLength={THRESHOLDS.dispute.maxEvidenceLength}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Evidence (links, tx hashes, context)"
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="input-brutal px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={
            busy || reason.trim() === "" || evidence.trim() === ""
          }
          className="btn-brutal px-4 py-2 text-xs"
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
