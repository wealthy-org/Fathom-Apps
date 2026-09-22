import { parseAbiItem } from "viem";

/**
 * ABI murni untuk komponen klien (wagmi useWriteContract/useReadContract).
 * Modul client-safe: hanya `viem`, tanpa import DB — jangan tambah
 * import server (db/client, schema) di sini agar tidak bocor ke browser bundle.
 * Lihat `lib/chain/vouch-registry.ts` untuk indexer + readContract server.
 */

/**
 * ABI fungsi tulis registry. Hanya jalur yang ada di kontrak: vouch (native),
 * vouchERC20 (token), withdraw (tarik setelah cooldown). Tidak ada revoke().
 */
export const VOUCH_REGISTRY_WRITE_ABI = [
  parseAbiItem("function vouch(address to) payable"),
  parseAbiItem("function vouchERC20(address to, uint256 amount)"),
  parseAbiItem("function withdraw(address to, uint256 amount)"),
  parseAbiItem("function minStake() view returns (uint256)"),
  parseAbiItem("function cooldownDays() view returns (uint256)"),
] as const;

/** ABI minimal ERC20 untuk alur approve → vouchERC20. */
export const ERC20_ABI = [
  parseAbiItem("function approve(address spender, uint256 amount) returns (bool)"),
  parseAbiItem("function allowance(address owner, address spender) view returns (uint256)"),
] as const;

export const ATTESTATION_REGISTRY_WRITE_ABI = [
  parseAbiItem("function attest(address subject, string role, string relationship, uint32 durationMonths) returns (uint256)"),
  parseAbiItem("function revoke(uint256 attestationId)"),
] as const;

export const DISPUTE_REGISTRY_WRITE_ABI = [
  parseAbiItem("function openDispute(address target, bytes32 reasonHash, bytes32 evidenceRef) returns (uint256)"),
] as const;
