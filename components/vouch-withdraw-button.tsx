"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { VOUCH_REGISTRY_WRITE_ABI } from "@/lib/chain/vouch-abi";
import { robinhoodTestnet } from "@/lib/wallet/chains";

// ponytail: withdraw hanya untuk vouch yang diberi wallet terhubung
// (voucher), stake masih aktif, dan cooldown terlewati. Cooldown dibaca dari
// kontrak (readWithdrawCooldown), bukan angka UI. Registri tak dikonfigurasi
// atau voucher ≠ connected wallet → tidak render apa pun.

const REGISTRY = process.env.NEXT_PUBLIC_FATHOM_VOUCH_REGISTRY_ADDRESS ?? "";

export function VouchWithdrawButton({
  voucher: vouchVoucher,
  target,
  stakeAmount,
}: {
  voucher: string;
  target: string;
  stakeAmount: string;
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
    chainId: robinhoodTestnet.id,
    query: { enabled: txHash !== null },
  });

  useEffect(() => {
    if (isSuccess) router.refresh();
  }, [isSuccess, router]);

  if (REGISTRY === "" || !isConnected || !address) return null;
  // Only the voucher can withdraw its own stake — connected wallet must match
  // the vouch's voucher address (never overridden by client input).
  const voucher = address.toLowerCase();
  if (voucher !== vouchVoucher) return null;

  async function withdraw() {
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: REGISTRY as `0x${string}`,
        abi: VOUCH_REGISTRY_WRITE_ABI,
        functionName: "withdraw",
        args: [target as `0x${string}`, BigInt(stakeAmount)],
      });
      setTxHash(hash);
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setError(
        /reject|denied|cancel/i.test(msg)
          ? "Cancelled."
          : msg || "Withdraw failed.",
      );
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={isPending || isSuccess}
        onClick={() => void withdraw()}
        className="btn-brutal-light px-3 py-1.5 text-xs"
      >
        {isPending ? "Withdrawing…" : isSuccess ? "Withdrawn" : "Withdraw"}
      </button>
      <span className="font-mono text-[11px] text-slate400">
        vouch by {shortAddress(voucher)} — withdraw returns your stake after the
        registry cooldown
      </span>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
