"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@/components/connect-button";
import {
  ERC20_ABI,
  VOUCH_REGISTRY_WRITE_ABI,
} from "@/lib/chain/vouch-abi";
import { robinhoodTestnet } from "@/lib/wallet/chains";

// ponytail: alur vouch on-chain. Target = profil yang sedang dilihat (readonly);
// voucher = wallet terhubung (useAccount), tidak pernah dari input klien.
// Asset mode dibaca dari env build-time (NEXT_PUBLIC_*): token kosong → native,
// terisi → ERC20 (approve → vouchERC20). Registri tidak dikonfigurasi → unavailable.

type TxState =
  | "idle"
  | "awaiting_signature"
  | "pending"
  | "confirmed"
  | "failed";

const REGISTRY = process.env.NEXT_PUBLIC_FATHOM_VOUCH_REGISTRY_ADDRESS ?? "";
const TOKEN = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS ?? "";
const isNative = TOKEN === "";

export function VouchForm({ target }: { target: string }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [stake, setStake] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { data: minStake } = useReadContract({
    address: REGISTRY as `0x${string}`,
    abi: VOUCH_REGISTRY_WRITE_ABI,
    functionName: "minStake",
    query: { enabled: REGISTRY !== "" },
  });
  const { isSuccess: confirmed, isError: receiptFailed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}` | undefined,
      chainId: robinhoodTestnet.id,
      query: { enabled: txHash !== null },
    });

  if (REGISTRY === "") {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">Vouch for this wallet</h3>
        <p className="mt-1 text-xs text-slate400">
          Vouch registry is not configured. On-chain vouches are unavailable
          until FATHOM_VOUCH_REGISTRY_ADDRESS is set.
        </p>
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">Vouch for this wallet</h3>
        <p className="mt-1 text-xs text-slate400">
          A vouch is economic-backing evidence: you stake native assets (or the
          configured ERC20 token) behind this wallet. It never creates
          reputation on its own.
        </p>
        <div className="mt-4">
          <ConnectButton connectLabel="Connect wallet to vouch" />
        </div>
      </div>
    );
  }

  const voucher = address.toLowerCase();
  if (voucher === target) return null;

  const minStakeWei = typeof minStake === "bigint" ? minStake : null;
  const busy = txState === "awaiting_signature" || txState === "pending";

  function parseStake(): bigint | null {
    if (stake.trim() === "") return null;
    try {
      return parseEther(stake.trim());
    } catch {
      return null;
    }
  }

  async function submit() {
    if (!address) return;
    setError(null);
    setTxHash(null);
    const amount = parseStake();
    if (amount === null) {
      setError("Enter a valid stake amount.");
      return;
    }
    if (minStakeWei !== null && amount < minStakeWei) {
      setError(`Stake must be at least ${minStakeWei.toString()} wei.`);
      return;
    }
    try {
      setTxState("awaiting_signature");
      if (isNative) {
        const hash = await writeContractAsync({
          address: REGISTRY as `0x${string}`,
          abi: VOUCH_REGISTRY_WRITE_ABI,
          functionName: "vouch",
          args: [target as `0x${string}`],
          value: amount,
        });
        setTxHash(hash);
      } else {
        // ERC20: approve dulu (full amount), lalu vouchERC20. Token decimals
        // diasumsikan 18 (sama dengan ETH) — kontrak token MVP belum ditentukan.
        const approveHash = await writeContractAsync({
          address: TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [REGISTRY as `0x${string}`, amount],
        });
        await writeContractAsync({
          address: REGISTRY as `0x${string}`,
          abi: VOUCH_REGISTRY_WRITE_ABI,
          functionName: "vouchERC20",
          args: [target as `0x${string}`, amount],
        });
        setTxHash(approveHash);
      }
      setTxState("pending");
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setTxState("failed");
      setError(
        /reject|denied|cancel/i.test(msg)
          ? "Cancelled. Click once more to try again."
          : msg || "Transaction failed. Please try again.",
      );
    }
  }

  if (confirmed) {
    if (txState !== "confirmed") {
      setTxState("confirmed");
      router.refresh();
    }
    return (
      <div className="panel-brutal mt-4 p-5">
        <h3 className="font-display text-base">Vouch for this wallet</h3>
        <p className="mt-3 text-xs text-accent-ink">
          Vouch confirmed on-chain. It will appear below once indexed.
        </p>
      </div>
    );
  }

  const buttonLabel =
    txState === "awaiting_signature"
      ? "Confirm in wallet…"
      : txState === "pending"
        ? "Pending…"
        : isNative
          ? "Vouch"
          : "Approve & vouch";

  return (
    <div className="panel-brutal mt-4 p-5">
      <h3 className="font-display text-base">Vouch for this wallet</h3>
      <p className="mt-1 text-xs text-slate400">
        Stake {isNative ? "native assets" : "tokens"} behind this wallet. The
        registry records the vouch; a cooldown applies before withdrawal.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          placeholder={`Stake in ${isNative ? "ETH" : "tokens"}`}
          inputMode="decimal"
          className="input-brutal px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || stake.trim() === ""}
          onClick={() => void submit()}
          className="btn-brutal px-4 py-2 text-xs sm:col-span-2"
        >
          {buttonLabel}
        </button>
      </div>
      {minStakeWei !== null && (
        <p className="mt-2 font-mono text-[11px] text-slate400">
          Minimum stake: {minStakeWei.toString()} wei
        </p>
      )}
      {receiptFailed && !confirmed && (
        <p className="mt-3 text-xs text-red-600">
          Transaction reverted on-chain. Check the explorer for details.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
